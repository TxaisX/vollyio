import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { MONTHLY_ALLOWANCE, monthlyAllowance, isPlan, PLANS } from "./plans.ts";


// "Did this ever happen" is a different question from "what is the shape now".
// A `drop function` or an `alter table ... add constraint` is a one-time event
// recorded in the migration that performed it, so it must be looked for across
// ALL of them; a later `create or replace` of the same function does not and
// should not repeat it.
async function allMigrations(): Promise<string> {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const bodies = await Promise.all(
    names.map((n) => readFile(new URL(n, dir), "utf8")),
  );
  return bodies.join("\n");
}

// Read the NEWEST migration that defines the allowance, not a fixed filename,
// so a later migration that changes the numbers cannot leave this test
// asserting against a superseded one. Same lesson as D-046.
async function allowanceSql(): Promise<string> {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.plan_monthly_allowance/i.test(body)) sql = body;
  }
  return sql;
}

test("the TypeScript allowance matches the database allowance", async () => {
  const sql = await allowanceSql();
  assert.notEqual(sql, "", "no migration defines plan_monthly_allowance");
  // The number the player is shown and the number the database enforces have to
  // be the same number, or the counter promises reps the reservation refuses.
  assert.match(sql, new RegExp(`when 'pro' then ${MONTHLY_ALLOWANCE.pro}\\b`, "i"));
  assert.match(sql, new RegExp(`else ${MONTHLY_ALLOWANCE.free}\\b`, "i"));
});

test("the allowance window is the UTC calendar month, derived server side", async () => {
  const sql = await allowanceSql();
  assert.match(sql, /date_trunc\('month', p_now at time zone 'utc'\)/i);
  assert.match(sql, /\+ interval '1 month'/i);
  // Counting rows in analyses is what makes a failed clip free. Counting
  // attempts or reservations instead would charge for outages.
  assert.match(sql, /from public\.analyses\s+where user_id = v_user_id\s+and created_at >= v_starts_at/i);
});

test("the reservation stays atomic and the exhausted reason is explicit", async () => {
  const sql = await allowanceSql();
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /'reason', 'month_exhausted'/i);
  assert.match(sql, /'reason', 'in_progress'/i);
  assert.match(sql, /interval '5 minutes'/i);
  // The lifetime-one check this replaced must be gone, or a free player is
  // capped at one analysis forever regardless of the month.
  assert.doesNotMatch(sql, /'reason', 'used'/i);
});

test("only the service role may write a plan", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.set_subscription_plan/i.test(body)) sql = body;
  }
  assert.notEqual(sql, "", "no migration defines set_subscription_plan");
  assert.match(sql, /revoke all on function public\.set_subscription_plan[\s\S]{0,120}from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.set_subscription_plan[\s\S]{0,120}to service_role/i);
  // A player writing their own plan would be player-editable metadata deciding
  // billing entitlement, which AGENTS.md forbids outright.
  assert.doesNotMatch(sql, /grant update \([^)]*plan[^)]*\) on table public\.profiles to authenticated/i);
  // The constraint was added once, by the migration that introduced the column.
  assert.match(await allMigrations(), /check \(plan in \('free', 'pro'\)\)/i);
});

test("an unknown plan falls back to the free allowance rather than throwing", () => {
  assert.equal(monthlyAllowance("free"), 3);
  assert.equal(monthlyAllowance("pro"), 18);
  assert.equal(monthlyAllowance("enterprise"), MONTHLY_ALLOWANCE.free);
  assert.equal(monthlyAllowance(null), MONTHLY_ALLOWANCE.free);
  assert.equal(monthlyAllowance(undefined), MONTHLY_ALLOWANCE.free);
});

test("plan recognition is exact", () => {
  assert.equal(isPlan("pro"), true);
  assert.equal(isPlan("free"), true);
  assert.equal(isPlan("Pro"), false);
  assert.equal(isPlan(""), false);
  assert.equal(isPlan(null), false);
  assert.deepEqual([...PLANS], ["free", "pro"]);
});

test("the plan writer refuses to move a plan backwards on an out-of-order event", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.set_subscription_plan/i.test(body)) sql = body;
  }
  // Webhook delivery is not ordered. Without a staleness guard, a "still
  // active" update arriving after a cancellation restores a subscription the
  // player already ended, and they keep an allowance nobody is charging for.
  assert.match(sql, /p_event_at timestamptz/i);
  assert.match(sql, /last_billing_event_at/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /plan = case when v_stale then plan else p_plan end/i);
  // The identifiers are still recorded on a stale event: dropping the customer
  // id because an event arrived out of order leaves a paying player unable to
  // reach the portal and cancel.
  assert.match(sql, /stripe_customer_id = coalesce\(p_customer_id, stripe_customer_id\)/i);
  // The unguarded five-argument shape must not remain callable. Dropped once,
  // by the migration that introduced the guarded one.
  assert.match(
    await allMigrations(),
    /drop function if exists public\.set_subscription_plan\(uuid, text, timestamptz, text, text\)/i,
  );
});

test("the payment routes have their own quota scope and never borrow the analyze one", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.consume_api_quota/i.test(body)) sql = body;
  }
  assert.match(sql, /scope in \('analyze', 'coach', 'coach_daily', 'account_delete', 'billing'\)/i);
  assert.match(sql, /when 'billing' then\s*v_limit := 10;/i);
  // Every scope that existed before must survive the redefinition, or a
  // redeploy quietly removes a limit that is holding something back.
  assert.match(sql, /when 'analyze' then\s*v_limit := 20;/i);
  assert.match(sql, /when 'coach_daily' then\s*v_limit := 30;/i);
});

test("player-written telemetry cannot move the platform spend estimate far", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/analyses_telemetry_bounds_check/i.test(body)) sql = body;
  }
  // analyses.telemetry is inserted with the PLAYER'S credentials, and
  // analyze_usage_month() sums it into the number that trips the platform
  // budget guard for everyone. Unbounded, one account can 503 the product.
  assert.notEqual(sql, "", "no migration bounds the telemetry a player can write");
  assert.match(sql, /input_tokens.*between 0 and 5000000/i);
  assert.match(sql, /output_tokens.*between 0 and 1000000/i);
  assert.match(sql, /duration_ms.*between 0 and 600000/i);
});

test("the quota refund cannot be driven by a player", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.refund_api_quota/i.test(body)) sql = body;
  }
  assert.notEqual(sql, "", "no migration defines refund_api_quota");
  // Migration 033: the boundary is the ROLE, not a value. 030's reservation-id
  // gate was unsound because reserve_analysis_entitlement is granted to
  // `authenticated` and returns the id, so a player could fetch one.
  assert.match(sql, /refund_api_quota\(\s*p_user_id uuid,\s*p_scope text/i);
  assert.match(sql, /grant execute on function public\.refund_api_quota\(uuid, text\) to service_role/i);
  assert.doesNotMatch(sql, /to authenticated/i);
  // Deleting the row was the escape: the next consume then started a fresh
  // window, so the hourly cap never fired.
  assert.doesNotMatch(sql, /delete from private\.api_rate_limits/i);
  assert.match(sql, /greatest\(0, request_count - 1\)/i);
  assert.match(await allMigrations(), /drop function if exists public\.refund_api_quota\(text\)/i);
});

test("GREATEST and LEAST are never schema-qualified in any migration", async () => {
  // `pg_catalog.greatest(...)` parses at creation and raises 42883 at execution,
  // because GREATEST is a SQL construct handled by the grammar rather than a
  // function in the catalog. It shipped in three functions and every gate stayed
  // green, because the other pins in this file assert migration TEXT and a text
  // pin cannot see a function that throws only when called.
  //
  // The qualification is never needed: the grammar resolves both regardless of
  // search_path, which is exactly why `set search_path = ''` is safe.
  // Scoped to the definition IN EFFECT for each function, not to every file
  // that ever existed. 026, 027 and 030 still contain the broken form and are
  // left alone on purpose: they are applied, and the repo has to keep matching
  // what ran. 032 supersedes all three, and a replay from scratch ends correct
  // because it runs last.
  //
  // Comments are stripped because 032 names the construct in prose to explain
  // the failure, and a guard that trips on its own post-mortem would have to be
  // deleted to stay green.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const effective = new Map<string, string>();
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    const code = body
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const match of code.matchAll(
      /create or replace function\s+([a-z_]+\.[a-z_]+)/gi,
    )) {
      // Everything from this definition to the next one, which is the body the
      // database would end up holding.
      const from = code.indexOf(match[0]);
      const rest = code.slice(from);
      const next = rest.slice(match[0].length).search(/create or replace function/i);
      effective.set(match[1].toLowerCase(), next === -1 ? rest : rest.slice(0, next));
    }
  }

  assert.ok(effective.size > 0, "no function definitions found");
  for (const [fn, body] of effective) {
    assert.doesNotMatch(body, /pg_catalog\.greatest/i, `${fn} qualifies GREATEST`);
    assert.doesNotMatch(body, /pg_catalog\.least/i, `${fn} qualifies LEAST`);
  }
});
