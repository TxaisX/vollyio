import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { MAX_CLIP_BYTES, MAX_FRAMES } from "./analysis-types.ts";

// The newest migration that redefines the analysis insert trigger. Read by
// name-scan rather than by filename for the reason D-046 records: pinning one
// file meant a later migration could move a ceiling and leave the test still
// asserting against the superseded one.
async function newestDefining(pattern: RegExp): Promise<string> {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let found = "";
  for (const name of names) {
    const sql = await readFile(new URL(name, dir), "utf8");
    if (pattern.test(sql)) found = sql;
  }
  return found;
}

test("security migration keeps quotas atomic and profile authority server-controlled", async () => {
  const expand = await readFile(
    new URL("../supabase/migrations/011_security_hardening.sql", import.meta.url),
    "utf8",
  );
  const contract = await readFile(
    new URL("../supabase/migrations/012_security_contract.sql", import.meta.url),
    "utf8",
  );
  const sql = `${expand}\n${contract}`;
  assert.match(sql, /create table private\.api_rate_limits/i);
  assert.match(sql, /create or replace function public\.consume_api_quota/i);
  assert.match(sql, /create table private\.analysis_entitlement_reservations/i);
  assert.match(
    sql,
    /create or replace function public\.reserve_analysis_entitlement\(\s*p_enforce_free boolean/i,
  );
  assert.match(sql, /create or replace function public\.release_analysis_entitlement/i);
  assert.match(sql, /create or replace function public\.discard_new_analysis/i);
  assert.match(expand, /analysis_id uuid unique references public\.analyses/i);
  assert.match(expand, /set analysis_id = new\.id/i);
  assert.match(
    expand,
    /reservation_id = p_reservation_id[\s\S]*analysis_id = p_analysis_id/i,
  );
  assert.match(sql, /on conflict \(user_id, scope\) do update/i);
  assert.match(sql, /revoke all on function public\.consume_api_quota\(text\) from public/i);
  assert.match(sql, /grant execute on function public\.consume_api_quota\(text\) to authenticated/i);
  assert.match(sql, /revoke all on all tables in schema public from authenticated/i);
  assert.match(sql, /grant update \([^)]*level[^)]*training_consent[^)]*\)/i);
  assert.doesNotMatch(sql, /grant update \([^)]*plan/i);
  assert.match(sql, /allowed_mime_types = array\['image\/jpeg', 'application\/json'\]/i);
  assert.match(sql, /create or replace function private\.enforce_analysis_insert_limit/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /create trigger enforce_analysis_insert_limit/i);
  assert.match(sql, /new\.created_at := v_now/i);
  const analysisInsertGrant = contract.match(
    /grant insert \(([\s\S]*?)\) on table public\.analyses/i,
  );
  assert.ok(analysisInsertGrant);
  assert.doesNotMatch(analysisInsertGrant[1], /created_at/i);
  assert.match(expand, /cardinality\(new\.frame_paths\) <> new\.frame_count/i);
  assert.match(expand, /cardinality\(new\.stored_frame_paths\) > 22/i);
  assert.match(contract, /name = any \(analysis\.frame_paths\)/i);
  assert.match(contract, /name = any \(analysis\.stored_frame_paths\)/i);
  assert.match(contract, /name = analysis\.keypoints_path/i);
  assert.match(contract, /name = analysis\.clip_path/i);
  assert.equal(contract.includes("\\\\."), false);
  assert.doesNotMatch(expand, /drop policy if exists/i);
  assert.match(contract, /drop policy if exists/i);
});

test("coach quota migration pins the hardened limits (D-047)", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/018_coach_quota.sql", import.meta.url),
    "utf8",
  );
  // The daily scope and the tightened hourly cap must both survive any future
  // redefinition of the quota functions, or coach reverts to 60/hr with no
  // day ceiling and no billing gate behind it.
  assert.match(sql, /scope in \('analyze', 'coach', 'coach_daily', 'account_delete'\)/i);
  assert.match(sql, /when 'coach' then\s*v_limit := 20;/i);
  assert.match(sql, /when 'coach_daily' then\s*v_limit := 30;\s*v_window := interval '24 hours';/i);
  assert.match(sql, /create or replace function public\.refund_api_quota/i);
  assert.match(sql, /when 'coach_daily' then v_window := interval '24 hours';/i);
  // The refund floor survives: delete the would-be-zero row, never write zero.
  assert.match(sql, /request_count <= 1/i);
  assert.match(sql, /revoke all on function public\.consume_api_quota\(text\) from public/i);
});

test("the newest quota definition carries every scope, including billing (migration 028)", async () => {
  // 018's pins above assert against 018's own file, which a later migration can
  // legitimately supersede. This reads the NEWEST migration that redefines
  // consume_api_quota, the same pattern the frame-cap test uses, so the full
  // scope list and the billing limit can never silently drop out of a future
  // redefinition. Until this existed, docs/security.md spent a month claiming
  // the billing scope did not exist while 028 sat applied in production.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let quota = "";
  for (const name of names) {
    const sql = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.consume_api_quota/i.test(sql)) quota = sql;
  }
  assert.notEqual(quota, "", "no migration defines consume_api_quota");
  assert.match(
    quota,
    /scope in \('analyze', 'coach', 'coach_daily', 'account_delete', 'billing'\)/i,
  );
  assert.match(quota, /when 'analyze' then\s*v_limit := 20;/i);
  assert.match(quota, /when 'coach' then\s*v_limit := 20;/i);
  assert.match(quota, /when 'coach_daily' then\s*v_limit := 30;\s*v_window := interval '24 hours';/i);
  assert.match(quota, /when 'account_delete' then\s*v_limit := 3;/i);
  // Generous for a human deciding whether to subscribe, tight enough that a
  // script cannot mint provider objects in a loop (10/hr).
  assert.match(quota, /when 'billing' then\s*v_limit := 10;/i);
  // An unknown scope raises rather than falling through to some default limit.
  assert.match(quota, /raise invalid_parameter_value using message = 'unknown quota scope'/i);
});

test("the one-argument quota refund is dropped and stays dropped", async () => {
  // 018 shipped `refund_api_quota(text)` granted to `authenticated`. Because
  // PostgREST publishes every SECURITY DEFINER function, a player could call it
  // with their own token, and the `request_count <= 1` branch DELETED the row
  // so the next consume began a fresh window. The 20 per hour analyze cap
  // therefore never fired, and each extra request still paid for a coaching
  // call before the insert trigger refused the row. This pin reads the NEWEST
  // definition, so a later migration cannot quietly restore the old shape.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const bodies = await Promise.all(names.map((n) => readFile(new URL(n, dir), "utf8")));
  const all = bodies.join("\n");

  let newest = "";
  for (const body of bodies) {
    if (/create or replace function public\.refund_api_quota/i.test(body)) newest = body;
  }
  assert.notEqual(newest, "", "no migration defines refund_api_quota");

  // The drop is a one-time event, recorded in the migration that performed it.
  // A later `create or replace` of the same function neither repeats it nor
  // needs to, so this looks across every migration rather than at the newest.
  assert.match(all, /drop function if exists public\.refund_api_quota\(text\)/i);
  // The shape, though, is whatever the NEWEST definition says it is, and the
  // grant that goes with it must name the two-argument signature. Asserting the
  // one-argument grant is absent from every migration would be asserting that
  // history did not happen: 018 really did grant it, and 030 really did drop
  // the function out from under that grant, which is what makes it moot.
  assert.match(newest, /refund_api_quota\(\s*p_user_id uuid,\s*p_scope text/i);
  assert.match(newest, /grant execute on function public\.refund_api_quota\(uuid, text\) to service_role/i);
  // No client role may reach it in ANY shape. This is the assertion that would
  // have caught 030 shipping a gate that only looked like one.
  assert.doesNotMatch(newest, /grant execute on function public\.refund_api_quota[^;]*to authenticated/i);
});

test("frame-cap alignment migration matches the MAX_FRAMES send budget (D-046)", async () => {
  // Read the NEWEST migration that redefines the trigger, not a fixed filename.
  // Pinning 017 by name meant a later migration could raise the ceiling and
  // leave this test still asserting against the superseded one, which is the
  // exact drift D-046 was about.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let align = "";
  for (const name of names) {
    const sql = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function private\.enforce_analysis_insert_limit/i.test(sql)) align = sql;
  }
  assert.notEqual(align, "", "no migration defines enforce_analysis_insert_limit");
  assert.match(align, /create or replace function private\.enforce_analysis_insert_limit/i);
  // The DB media-count ceiling must equal the app send budget, or a dense clip is
  // read, billed, then rejected at the insert (D-046). Tie it to the constant so
  // the two can never drift again.
  assert.match(align, new RegExp(`new\\.frame_count > ${MAX_FRAMES}\\b`, "i"));
  assert.doesNotMatch(align, /new\.frame_count > 12\b/i);
  // The stored-extras cap and every other guardrail survive the redefinition.
  assert.match(align, /cardinality\(new\.stored_frame_paths\) > 22/i);
  assert.match(align, /new\.user_id <> v_user_id/i);
  assert.match(align, /pg_advisory_xact_lock/i);
  assert.match(align, /raise check_violation using message = 'invalid frame path'/i);
  assert.match(align, /new\.created_at := v_now/i);
});

test("a zero-frame video row is allowed, but only with a clip behind it (D-097)", async () => {
  const align = await newestDefining(
    /create or replace function private\.enforce_analysis_insert_limit/i,
  );
  assert.notEqual(align, "", "no migration defines enforce_analysis_insert_limit");
  // The video path stores no frames: the read is performed on the clip, so
  // shipping stills alongside would upload pixels no model looks at. The old
  // floor of 2 rejected exactly that row.
  assert.doesNotMatch(align, /new\.frame_count < 2\s*$/im);
  assert.match(align, /new\.frame_count > 0 and new\.frame_count < 2/i);
  // A row with neither frames nor a clip is an analysis with no evidence behind
  // it that nothing can render and nothing can ever re-derive. Removing this
  // line would make the relaxation above unbounded.
  assert.match(align, /new\.frame_count = 0 and new\.clip_path is null/i);
  assert.match(align, /raise check_violation using message = 'analysis has no media'/i);
  // The thumbnail rule is what forces a zero-frame row's thumb_path to null,
  // and it is unchanged from 025. Stated here so a future edit that "fixes"
  // the null case knows it is load-bearing.
  assert.match(align, /new\.thumb_path is distinct from new\.frame_paths\[1\]/i);
});

test("the pending clip prefix stays owner-scoped, typed and capped (D-097)", async () => {
  const sql = await newestDefining(/create policy "pending clip objects insert"/i);
  assert.notEqual(sql, "", "no migration defines the pending clip policies");

  // Three policies, and the delete one is not optional: without it the prefix
  // only ever grows and every failed analysis strands a clip its owner can read
  // but not remove.
  for (const verb of ["insert", "select", "delete"]) {
    assert.match(sql, new RegExp(`create policy "pending clip objects ${verb}"`, "i"));
  }

  // The WHOLE path is matched against the caller's verified id, not just its
  // first folder segment. This is the one clip write with no analysis row
  // behind it to constrain the rest of the path, so the literal `pending`
  // segment, the UUID-shaped directory and the single filename are what stop
  // the prefix becoming a general-purpose owner-scoped file drop.
  const anchors = sql.match(
    /'\^' \|\| \(select auth\.uid\(\)::text\)\s*\|\| '\/pending\/\[0-9a-f\]\{8\}-/gi,
  );
  assert.equal(anchors?.length, 3, "every pending policy must anchor on the caller's own id");
  assert.match(sql, /\/clip\[\.\]\(webm\|mp4\|mov\)\$/i);

  // Type and size. The analysis-anchored policies inherit their ceiling from a
  // row the player could not write; this one has no row behind it, so it states
  // its own, and it must agree with what the route will read into memory.
  assert.match(sql, /metadata ->> 'mimetype' = 'video\/mp4'/i);
  assert.match(sql, /metadata ->> 'mimetype' = 'video\/webm'/i);
  assert.match(sql, /metadata ->> 'mimetype' = 'video\/quicktime'/i);
  assert.match(
    sql,
    new RegExp(`metadata ->> 'size'\\)::bigint, 0\\) <= ${MAX_CLIP_BYTES}\\b`, "i"),
    "the pending size cap must equal MAX_CLIP_BYTES",
  );

  // Reads and deletes additionally require ownership of the object itself, the
  // same posture every other clip policy takes.
  const scoped = sql.match(/owner_id = \(select auth\.uid\(\)::text\)/gi);
  assert.equal(scoped?.length, 2, "select and delete must both check owner_id");
});
