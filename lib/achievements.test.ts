import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_KEY,
  isAchievementKey,
} from "./achievements.ts";

// Same pin as lib/plans.test.ts, same reason: the catalog is what the player
// is promised, the SQL is what the database pays, and the two are written in
// different languages in different files. Read the NEWEST migration that
// defines `claim_achievements`, so a later rebalance cannot leave this test
// asserting against a superseded price list.
async function claimSql(): Promise<string> {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create or replace function public\.claim_achievements/i.test(body)) {
      sql = body;
    }
  }
  return sql;
}

// The `(key, xp, earned)` tuples from the function's values list. The earned
// expression is free-form SQL; the key and the price are the contract.
function sqlBadges(sql: string): Map<string, number> {
  const out = new Map<string, number>();
  const tuple = /\('([a-z_]+)',\s*(\d+)\s*,/g;
  for (const m of sql.matchAll(tuple)) out.set(m[1], Number(m[2]));
  return out;
}

test("every catalog badge exists in SQL at the same price, and nothing extra", async () => {
  const sql = await claimSql();
  assert.notEqual(sql, "", "no migration defines claim_achievements");
  const paid = sqlBadges(sql);
  for (const badge of ACHIEVEMENTS) {
    assert.equal(
      paid.get(badge.key),
      badge.xp,
      `${badge.key}: catalog says ${badge.xp} XP, SQL says ${paid.get(badge.key) ?? "nothing"}`,
    );
  }
  // A badge the database pays but the catalog cannot name would earn silently
  // and render as nothing. Neither list is allowed to drift past the other.
  assert.equal(
    paid.size,
    ACHIEVEMENTS.length,
    `SQL pays ${paid.size} badges, catalog names ${ACHIEVEMENTS.length}`,
  );
});

test("badge XP flows through the ledger with a reason the reader can price", async () => {
  const sql = await claimSql();
  // The XP insert must write the `badge:<key>` reason so xp_events stays an
  // auditable record, and it must be guarded by the achievements primary key
  // (the insert only fires when the badge row was new), because xp_events has
  // no unique constraint of its own on (user_id, reason).
  assert.match(sql, /'badge:' \|\| /);
  assert.match(sql, /on conflict \(user_id, key\) do nothing/i);
  assert.match(sql, /if not found then/i);
});

test("keys are unique, priced above zero, and shaped for reasons", () => {
  const seen = new Set<string>();
  for (const badge of ACHIEVEMENTS) {
    assert.ok(!seen.has(badge.key), `duplicate key ${badge.key}`);
    seen.add(badge.key);
    assert.ok(badge.xp > 0, `${badge.key} pays nothing`);
    // Reason strings become `badge:<key>`; keep keys in the same shape as
    // every other reason token so the ledger stays greppable.
    assert.match(badge.key, /^[a-z][a-z_]*$/, badge.key);
    assert.ok(badge.name.length > 0 && badge.description.length > 0, badge.key);
  }
});

test("the lookup and the guard agree with the list", () => {
  for (const badge of ACHIEVEMENTS) {
    assert.equal(ACHIEVEMENT_BY_KEY[badge.key], badge);
    assert.ok(isAchievementKey(badge.key));
  }
  assert.ok(!isAchievementKey("badge_that_does_not_exist"));
  assert.ok(!isAchievementKey(42));
});
