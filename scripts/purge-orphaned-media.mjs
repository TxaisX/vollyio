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

// Every file under a user's folder: {user}/{analysis}/{file}, plus any file
// sitting directly in the user folder.
async function filesUnder(bucket, userFolder) {
  const out = [];
  const { data: entries, error } = await db.storage.from(bucket).list(userFolder, { limit: PAGE });
  if (error) throw new Error(`list ${bucket}/${userFolder} failed: ${error.message}`);
  for (const entry of entries ?? []) {
    const path = `${userFolder}/${entry.name}`;
    if (entry.id) {
      out.push(path);
      continue;
    }
    const { data: files, error: err2 } = await db.storage.from(bucket).list(path, { limit: PAGE });
    if (err2) throw new Error(`list ${bucket}/${path} failed: ${err2.message}`);
    for (const f of files ?? []) out.push(`${path}/${f.name}`);
  }
  return out;
}

const live = await liveUserIds();
console.log(`${live.size} live account(s).`);
if (!confirm) console.log("DRY RUN. Nothing will be deleted. Pass --confirm to purge.\n");

let totalFiles = 0;
let totalRemoved = 0;

for (const bucket of BUCKETS) {
  const { data: folders, error } = await db.storage.from(bucket).list("", { limit: PAGE });
  if (error) throw new Error(`list ${bucket} failed: ${error.message}`);

  const orphans = (folders ?? []).filter((f) => !f.id && !live.has(f.name));
  const kept = (folders ?? []).filter((f) => !f.id && live.has(f.name));
  console.log(`[${bucket}] ${orphans.length} orphaned folder(s), ${kept.length} kept (live owner).`);

  for (const folder of orphans) {
    const paths = await filesUnder(bucket, folder.name);
    totalFiles += paths.length;
    console.log(`  ${folder.name}: ${paths.length} file(s)${confirm ? "" : " [would delete]"}`);
    if (!confirm || paths.length === 0) continue;

    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error: rmErr } = await db.storage.from(bucket).remove(batch);
      if (rmErr) {
        console.error(`  ! remove failed for ${batch.length} file(s): ${rmErr.message}`);
        continue;
      }
      totalRemoved += batch.length;
    }
    console.log(`  ${folder.name}: removed`);
  }
}

console.log(
  confirm
    ? `\nRemoved ${totalRemoved}/${totalFiles} orphaned file(s).`
    : `\n${totalFiles} orphaned file(s) would be removed. Re-run with --confirm.`,
);
