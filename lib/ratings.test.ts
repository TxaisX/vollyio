import { test } from "node:test";
import assert from "node:assert/strict";
import { updateRating, overallScore, ALPHA } from "./ratings.ts";

test("first rating seeds with the score", () => {
  assert.equal(updateRating(null, 72), 72);
});

test("EWMA moves toward the new score by ALPHA", () => {
  assert.equal(updateRating(60, 80), Math.round((60 + ALPHA * 20) * 10) / 10);
});

test("EWMA is stable against one bad rep", () => {
  const dropped = updateRating(80, 40);
  assert.ok(dropped > 60, `expected > 60, got ${dropped}`);
});

test("EWMA converges upward across reps", () => {
  let r: number | null = null;
  for (let i = 0; i < 6; i++) r = updateRating(r, 85);
  assert.ok(r! > 82, `expected > 82 after convergence, got ${r}`);
});

test("overall ignores unrated skills", () => {
  assert.equal(overallScore([70, null, 90, null]), 80);
});

test("overall is null when nothing is rated", () => {
  assert.equal(overallScore([null, null]), null);
});
