import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analysisByShareToken } from "./share-read.ts";
import { SHARE_LINK_TTL_DAYS } from "./share-constants.ts";

test("share migration keeps the anon surface bounded (D-049)", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/019_share_links.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create table public\.share_links/i);
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /alter table public\.share_links enable row level security/i);
  assert.match(sql, /create policy "own share links"/i);
  // Anonymous access is the function and the scoped clip policy, nothing else.
  assert.doesNotMatch(sql, /grant [^;]* on table public\.share_links to [^;]*anon/i);
  assert.match(sql, /grant execute on function public\.analysis_by_share_token\(text\) to anon/i);
  assert.match(sql, /security definer/i);
  // A dead link is dead everywhere: both the function and the storage policy
  // filter on revocation and expiry.
  const guards = sql.match(/revoked_at is null/gi) ?? [];
  assert.equal(guards.length >= 2, true);
  const expiry = sql.match(/expires_at > pg_catalog\.clock_timestamp\(\)/gi) ?? [];
  assert.equal(expiry.length >= 2, true);
  // The projection never leaks identity or media paths beyond the clip.
  const projection = sql.match(/jsonb_build_object\(([\s\S]*?)\)\s*from/i);
  assert.ok(projection);
  assert.doesNotMatch(projection[1], /user_id/i);
  assert.doesNotMatch(projection[1], /frame_paths/i);
  assert.doesNotMatch(projection[1], /stored_frame_paths/i);
  assert.doesNotMatch(projection[1], /telemetry/i);
  // Clips only; the frames bucket never gets an anon path.
  assert.match(sql, /bucket_id = 'clips'/i);
  assert.doesNotMatch(sql, /bucket_id = 'frames'/i);
});

test("share copy and DDL agree on the link lifetime (D-049)", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/019_share_links.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, new RegExp(`interval '${SHARE_LINK_TTL_DAYS} days'`));
});

test("the clip policy goes through the shared-clip predicate only (D-049)", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/020_share_clip_policy_fix.sql", import.meta.url),
    "utf8",
  );
  // The predicate is SECURITY DEFINER because RLS policy subqueries run with
  // the caller's privileges, and anon has none on share_links/analyses.
  assert.match(sql, /create or replace function public\.clip_is_shared/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  // Still zero anon table grants; the predicate is the only new anon surface.
  assert.doesNotMatch(sql, /grant [^;]* on table/i);
  // A dead link stays dead in the predicate too.
  assert.match(sql, /revoked_at is null/i);
  assert.match(sql, /expires_at > pg_catalog\.clock_timestamp\(\)/i);
  // Clips only, checked through the predicate.
  assert.match(sql, /bucket_id = 'clips'/i);
  assert.match(sql, /public\.clip_is_shared\(name\)/);
  assert.doesNotMatch(sql, /bucket_id = 'frames'/i);
});

test("the share reader fails closed on malformed responses and tokens", async () => {
  const nullClient = {
    rpc: async () => ({ data: null, error: null }),
  };
  assert.equal(await analysisByShareToken(nullClient, "x".repeat(43)), null);

  const errorClient = {
    rpc: async () => ({ data: { skill: "serve" }, error: { message: "boom" } }),
  };
  assert.equal(await analysisByShareToken(errorClient, "x".repeat(43)), null);

  const throwingClient = {
    rpc: async (): Promise<never> => {
      throw new Error("network");
    },
  };
  assert.equal(await analysisByShareToken(throwingClient, "x".repeat(43)), null);

  // Absurd tokens never reach the database.
  let called = false;
  const spyClient = {
    rpc: async () => {
      called = true;
      return { data: null, error: null };
    },
  };
  assert.equal(await analysisByShareToken(spyClient, "short"), null);
  assert.equal(await analysisByShareToken(spyClient, "y".repeat(4000)), null);
  assert.equal(called, false);
});
