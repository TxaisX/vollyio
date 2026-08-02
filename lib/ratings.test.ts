import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateRating,
  overallScore,
  scoreBand,
  coherentOverall,
  ALPHA_UP,
  ALPHA_DOWN,
} from "./ratings.ts";

test("first rating seeds with the score", () => {
  assert.equal(updateRating(null, 72), 72);
});

test("EWMA moves toward a better score by ALPHA_UP", () => {
  assert.equal(updateRating(60, 80), Math.round((60 + ALPHA_UP * 20) * 10) / 10);
});

test("EWMA moves toward a worse score by the smaller ALPHA_DOWN", () => {
  assert.equal(updateRating(80, 40), Math.round((80 + ALPHA_DOWN * -40) * 10) / 10);
});

test("the same gap moves the rating further up than down", () => {
  const up = updateRating(60, 80) - 60;
  const down = 80 - updateRating(80, 60);
  assert.ok(up > down, `up ${up} should exceed down ${down}`);
});

test("EWMA is stable against one bad rep", () => {
  const dropped = updateRating(80, 40);
  assert.ok(dropped > 70, `one bad rep must stay a nudge, got ${dropped}`);
});

test("sustained decline still shows honestly", () => {
  let r: number | null = 80;
  for (let i = 0; i < 8; i++) r = updateRating(r, 45);
  assert.ok(r! < 60, `eight bad reps must move the trend, got ${r}`);
});

test("EWMA converges upward across reps", () => {
  let r: number | null = null;
  for (let i = 0; i < 6; i++) r = updateRating(r, 85);
  assert.ok(r! > 82, `expected > 82 after convergence, got ${r}`);
});

test("a low-coverage rep moves the rating less than a full-coverage one", () => {
  const full = updateRating(70, 90, 100);
  const half = updateRating(70, 90, 50);
  const none = updateRating(70, 90, 0);
  assert.equal(full, Math.round((70 + ALPHA_UP * 1 * 20) * 10) / 10); // 77
  assert.equal(half, Math.round((70 + ALPHA_UP * 0.5 * 20) * 10) / 10); // 73.5
  assert.ok(half < full && half > 70, `half ${half} should sit between 70 and ${full}`);
  assert.equal(none, 70); // zero coverage cannot move the rating at all
});

test("coverage defaults to a full read and the first rating ignores it", () => {
  assert.equal(updateRating(70, 90), updateRating(70, 90, 100));
  assert.equal(updateRating(null, 84, 40), 84);
});

test("overall ignores unrated skills", () => {
  assert.equal(overallScore([70, null, 90, null]), 80);
});

test("overall is null when nothing is rated", () => {
  assert.equal(overallScore([null, null]), null);
});

test("score bands follow the rubric anchors", () => {
  assert.equal(scoreBand(40), "Developing");
  assert.equal(scoreBand(54), "Developing");
  assert.equal(scoreBand(55), "Solid");
  assert.equal(scoreBand(70), "Solid");
  assert.equal(scoreBand(79), "Solid");
  assert.equal(scoreBand(80), "Advanced");
  assert.equal(scoreBand(91), "Advanced");
  assert.equal(scoreBand(92), "Elite");
  assert.equal(scoreBand(100), "Elite");
});

test("coherent overall keeps a headline near the metric mean", () => {
  // Within tolerance: the model's number stands.
  assert.equal(coherentOverall(70, [65, 70, 72, 68, 71]), 70);
  // Inflated headline over mid-60s metrics snaps back to the mean.
  assert.equal(coherentOverall(84, [64, 66, 70, 62, 68]), 66);
  // Deflated headline under strong metrics snaps up the same way.
  assert.equal(coherentOverall(60, [80, 82, 78, 84, 76]), 80);
  // No metrics: nothing to reconcile against.
  assert.equal(coherentOverall(75, []), 75);
});
