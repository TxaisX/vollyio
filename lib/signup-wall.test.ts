import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { claimDestination } from "./signup-destination.ts";

// D-121. The wall's return address is caller-controlled (a hidden form field),
// so the allowlist below is the whole difference between "back to your
// breakdown" and an open redirect on the signup action.
test("the claim destination admits exactly one shape", () => {
  assert.equal(
    claimDestination("/analysis/0f8fad5b-d9cb-469f-a165-70867728950e"),
    "/analysis/0f8fad5b-d9cb-469f-a165-70867728950e",
  );
});

test("everything else falls back to /welcome", () => {
  const rejected = [
    null,
    undefined,
    "",
    "/dashboard",
    "/analysis/",
    "/analysis/not-a-uuid",
    "/analysis/0f8fad5b-d9cb-469f-a165-70867728950e/extra",
    "/analysis/0f8fad5b-d9cb-469f-a165-70867728950e?x=1",
    "https://evil.example/analysis/0f8fad5b-d9cb-469f-a165-70867728950e",
    "//evil.example/analysis/0f8fad5b-d9cb-469f-a165-70867728950e",
    "/ANALYSIS/0F8FAD5B-D9CB-469F-A165-70867728950E",
  ];
  for (const value of rejected) {
    assert.equal(claimDestination(value), "/welcome", `admitted: ${String(value)}`);
  }
});

// The share link is the one artifact that would carry a walled breakdown past
// the wall: /share/[token] renders the FULL result to anyone holding the link,
// and an anonymous session owns its row like any other player, so the refusal
// has to live in the policy, not in which buttons the page renders. Same
// posture as the anonymous analysis cap above it in plans.test.ts: an
// anonymous session IS `authenticated` in Postgres.
test("an anonymous session cannot mint a share link, in SQL", async () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  let sql = "";
  for (const name of names) {
    const body = await readFile(new URL(name, dir), "utf8");
    if (/create policy "own share links"/i.test(body)) sql = body;
  }
  assert.notEqual(sql, "", "no migration defines the own share links policy");

  // The LAST definition of the policy is the live one, and it must read the
  // is_anonymous claim off the JWT inside its write check.
  const policyAt = sql.lastIndexOf('create policy "own share links"');
  const policy = sql.slice(policyAt);
  assert.match(policy, /with check/i);
  assert.match(policy, /is_anonymous/i);
  assert.match(policy, /auth\.jwt\(\)/i);
});
