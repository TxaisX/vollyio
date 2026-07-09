import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCase, checkStability } from "./eval-score.ts";

const metrics = [
  { key: "toss_quality", score: 40 },
  { key: "arm_swing", score: 82 },
  { key: "contact_point", score: 60 },
];

function pass(checks: { ok: boolean }[]) {
  return checks.every((c) => c.ok);
}

test("overall in range passes; out of range fails", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0, 1], frameCount: 8 };
  assert.ok(pass(checkCase(input, { overall_min: 55, overall_max: 70 })));
  assert.ok(!pass(checkCase(input, { overall_min: 70, overall_max: 90 })));
});

test("weakest & strongest metric matching", () => {
  const input = { overall_score: 61, metrics, frameIndices: [0], frameCount: 8 };
  assert.ok(pass(checkCase(input, { weakest_metric: "toss_quality" })));
  assert.ok(!pass(checkCase(input, { weakest_metric: "contact_point" })));
  assert.ok(pass(checkCase(input, { strongest_metric: "arm_swing" })));
});

test("citation validity catches out-of-range frame indices", () => {
  const good = { overall_score: 61, metrics, frameIndices: [0, 7], frameCount: 8 };
  const bad = { overall_score: 61, metrics, frameIndices: [0, 8], frameCount: 8 };
  assert.ok(pass(checkCase(good, {})));
  assert.ok(!pass(checkCase(bad, {})));
});

test("stability flags a wide score spread", () => {
  assert.ok(checkStability([70, 72, 68]).ok);
  assert.ok(!checkStability([60, 80]).ok);
  assert.ok(checkStability([75]).ok); // single run is trivially stable
});
