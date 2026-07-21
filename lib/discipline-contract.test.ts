import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DISCIPLINES } from "./skills.ts";

test("discipline constraints cover every wire value the app can store", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/014_allow_grass_discipline.sql", import.meta.url),
    "utf8",
  );
  // Every stored wire value must be allowed by every discipline check, or an
  // analysis is read, billed, then rejected at the insert (the D-046 failure
  // family). Tie the constraint text to the app enum so they cannot drift.
  for (const table of ["analyses", "skill_ratings", "profiles"]) {
    const check = sql.match(
      new RegExp(
        `alter table ${table} add constraint ${table}_discipline_check\\s+check \\(discipline in \\(([^)]*)\\)\\)`,
        "i",
      ),
    );
    assert.ok(check, `${table} discipline check present`);
    for (const discipline of DISCIPLINES) {
      assert.match(check[1], new RegExp(`'${discipline}'`), `${table} allows ${discipline}`);
    }
  }
  // Hygiene reconstruction only: no access changes ride along.
  assert.doesNotMatch(sql, /\b(grant|revoke|policy)\b/i);
});
