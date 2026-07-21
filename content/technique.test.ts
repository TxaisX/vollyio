// Grass derives from the authored beach variant, the outdoor base (D-048):
// outdoor lessons must read nothing like indoor, and grass must read as sand.

import assert from "node:assert/strict";
import test from "node:test";

import { SKILLS } from "../lib/skills.ts";
import { TECHNIQUE, techniqueProblems } from "./technique.ts";

test("the knowledge core holds its authoring invariants", () => {
  assert.deepEqual(techniqueProblems(), []);
});

test("grass is the authored outdoor variant, not an indoor clone (D-048)", () => {
  for (const skill of SKILLS) {
    const { indoor, beach, grass } = TECHNIQUE[skill].byDiscipline;
    assert.notEqual(
      grass.overview,
      indoor.overview,
      `${skill}: grass overview must not repeat indoor`,
    );
    assert.equal(
      grass.overview,
      beach.overview,
      `${skill}: grass overview matches the outdoor base`,
    );
    assert.deepEqual(grass.phases, beach.phases, `${skill}: grass phases match the outdoor base`);
    assert.deepEqual(
      grass.metrics,
      beach.metrics,
      `${skill}: grass metrics match the outdoor base`,
    );
    for (const key of Object.keys(indoor.metrics)) {
      assert.ok(key in grass.metrics, `${skill}: indoor metric "${key}" is missing from grass`);
    }
  }
});
