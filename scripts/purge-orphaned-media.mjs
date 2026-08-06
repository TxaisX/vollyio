// Purge stored footage whose owner account no longer exists.
//
// The Privacy Policy promises a player's film goes when their account goes.
// /api/account/delete keeps that promise for anyone deleting in-app, but an
// account removed out of band (SQL, dashboard) leaves its media behind. This
// sweeps those leftovers.
//
// Postgres refuses `delete from storage.objects` (storage.protect_delete:
// "Direct deletion from storage tables is not allowed. Use the Storage API
// instead."), because dropping the row would strand the bytes in the object
// store with nothing left pointing at them. So this goes through the Storage
// API, which removes the row and the blob together.
//
// Needs a service-role key: the owners are gone, so nobody's session can
// reach their folders. Reads it from .env.local (gitignored) or the env.
//
//   node scripts/purge-orphaned-media.mjs            # dry run, deletes nothing
//   node scripts/purge-orphaned-media.mjs --confirm  # actually deletes

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["frames", "clips"];
const PAGE = 1000;

function fromEnvFile(key) {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).replace(/^["']|["']$/g, "").trim() : null;
  } catch {
    return null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromEnvFile("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard: Project Settings -> API).",
  );
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function liveUserIds() {
  const ids = new Set();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) ids.add(u.id);
    if (data.users.length < PAGE) break;
  }
  return ids;
}

// Every file under a prefix, to any depth. Was two levels, which was exactly
// the shape media had: {user}/{analysis}/{file}. The pending clip prefix added
// a third, {user}/pending/{uuid}/clip.mp4, and a fixed depth walked past it and
// reported the DIRECTORY as a file, which the Storage API then declined to
// remove. Recursion costs one extra list per directory and cannot be wrong
// again the next time a prefix grows.
async function filesUnder(bucket, prefix, depth = 0) {
  // Nothing legitimate nests this far. A guard rather than a limit: a listing
  // that somehow cycles must not spin against the API forever.
  if (depth > 6) return [];
  const out = [];
  const { data: entries, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE });
  if (error) throw new Error(`list ${bucket}/${prefix} failed: ${error.message}`);
  for (const entry of entries ?? []) {
    const path = `${prefix}/${entry.name}`;
    // `id` is null for a synthetic directory row and set for a real object.
    if (entry.id) out.push({ path, createdAt: entry.created_at ?? null });
    else out.push(...(await filesUnder(bucket, path, depth + 1)));
  }
  return out;
}

// A pending clip is the input to an analysis that has not been created yet
// (D-097). The route copies it to the analysis path and deletes it, and the
// client deletes it when a run fails, so a live one is a request in flight and
// must not be touched. What survives is the case neither of those covers: a
// browser closed between the upload and the post, or a function killed between
// the two.
//
// One hour, against a route bounded at 120 seconds. The margin is deliberate:
// deleting a clip out from under a request that is still running would cost the
// player the analysis they are waiting for, and the cost of waiting instead is
// one small file sitting in storage for an extra hour.
const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

function isStalePending(path, createdAt, now) {
  if (!/^[^/]+\/pending\/[^/]+\/clip\.(mp4|webm|mov)$/.test(path)) return false;
  const at = Date.parse(createdAt ?? "");
  if (!Number.isFinite(at)) return false;
  return now - at > PENDING_MAX_AGE_MS;
}

const live = await liveUserIds();
console.log(`${live.size} live account(s).`);
if (!confirm) console.log("DRY RUN. Nothing will be deleted. Pass --confirm to purge.\n");

let totalFiles = 0;
let totalRemoved = 0;
const now = Date.now();

async function removeAll(bucket, paths, label) {
  totalFiles += paths.length;
  console.log(`  ${label}: ${paths.length} file(s)${confirm ? "" : " [would delete]"}`);
  if (!confirm || paths.length === 0) return;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error: rmErr } = await db.storage.from(bucket).remove(batch);
    if (rmErr) {
      console.error(`  ! remove failed for ${batch.length} file(s): ${rmErr.message}`);
      continue;
    }
    totalRemoved += batch.length;
  }
  console.log(`  ${label}: removed`);
}

for (const bucket of BUCKETS) {
  const { data: folders, error } = await db.storage.from(bucket).list("", { limit: PAGE });
  if (error) throw new Error(`list ${bucket} failed: ${error.message}`);

  const orphans = (folders ?? []).filter((f) => !f.id && !live.has(f.name));
  const kept = (folders ?? []).filter((f) => !f.id && live.has(f.name));
  console.log(`[${bucket}] ${orphans.length} orphaned folder(s), ${kept.length} kept (live owner).`);

  for (const folder of orphans) {
    const files = await filesUnder(bucket, folder.name);
    await removeAll(bucket, files.map((f) => f.path), folder.name);
  }

  // The live accounts too, for one thing only: a pending clip whose analysis
  // never happened (D-097). Everything else under a live owner is theirs and
  // is never touched here, which is why this filters on the pending path shape
  // and an age rather than on anything about the account.
  if (bucket !== "clips") continue;
  for (const folder of kept) {
    const stale = (await filesUnder(bucket, `${folder.name}/pending`)).filter((f) =>
      isStalePending(f.path, f.createdAt, now),
    );
    if (stale.length === 0) continue;
    await removeAll(bucket, stale.map((f) => f.path), `${folder.name}/pending`);
  }
}

console.log(
  confirm
    ? `\nRemoved ${totalRemoved}/${totalFiles} file(s).`
    : `\n${totalFiles} file(s) would be removed. Re-run with --confirm.`,
);
