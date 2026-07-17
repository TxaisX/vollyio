// Purge a deleted player's stored footage.
//
// The Privacy Policy promises a player's film goes when their account goes.
// /api/account/delete clears storage in-app, but an account removed any other
// way (SQL, dashboard, an admin tool) would skip that and strand the media.
// A database trigger cannot clean it up either: storage.protect_delete refuses
// any delete from storage.objects, because dropping the row leaves the bytes
// with nothing pointing at them. The Storage API is the only correct path, so
// the AFTER DELETE hook on auth.users calls this over pg_net.
//
// Authorization is the account's own absence: this refuses any user_id that
// still has an account, so it can only ever finish a deletion the policy
// already requires, and a live player's film is unreachable through it. That
// beats holding a shared secret, which would have to live in the database for
// the hook to present it. The gateway's verify_jwt still means a caller needs
// a valid project key to reach this at all.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKETS = ["frames", "clips"] as const;
const PAGE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey || !url) return json({ error: "not configured" }, 503);

  let userId = "";
  try {
    const body = await req.json();
    userId = String(body?.user_id ?? "");
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (!UUID.test(userId)) return json({ error: "bad user_id" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Refuse anyone who still holds an account. Only the already-deleted get
  // swept, so this endpoint can never take a live player's film.
  const { data: existing, error: lookupError } = await db.auth.admin.getUserById(userId);
  if (lookupError && lookupError.status !== 404) {
    return json({ error: "lookup failed" }, 503);
  }
  if (existing?.user) return json({ error: "account still exists" }, 403);

  let removed = 0;
  let failed = 0;
  for (const bucket of BUCKETS) {
    const { data: entries, error } = await db.storage.from(bucket).list(userId, { limit: PAGE });
    if (error) {
      failed++;
      continue;
    }

    // {user}/{analysis}/{file}, plus any file sitting in the user folder.
    const paths: string[] = [];
    for (const entry of entries ?? []) {
      const path = `${userId}/${entry.name}`;
      if (entry.id) {
        paths.push(path);
        continue;
      }
      const { data: files } = await db.storage.from(bucket).list(path, { limit: PAGE });
      for (const file of files ?? []) paths.push(`${path}/${file.name}`);
    }

    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error: rmErr } = await db.storage.from(bucket).remove(batch);
      if (rmErr) {
        failed += batch.length;
        continue;
      }
      removed += batch.length;
    }
  }

  console.log(`[purge-user-media] user=${userId} removed=${removed} failed=${failed}`);
  return json({ ok: failed === 0, removed, failed });
});
