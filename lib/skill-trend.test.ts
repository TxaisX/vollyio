import { test } from "node:test";
import assert from "node:assert/strict";
import { skillTrend, meanBySkill, trendMargin, TREND_MIN_REPS } from "./skill-trend.ts";
import { SCORE_READ_NOISE_SD } from "./score-precision.ts";

// The arrow is a claim about a player's form, printed in green or red on the
// first page they see. These tests exist because the two ways to get it wrong
// are both silent: an arrow that points the wrong way, and an arrow drawn at
// all when there is nothing to say.

/** A week's worth of reps at one mean, for readability below. */
const week = (mean: number, n = TREND_MIN_REPS) => ({ mean, n });

test("the week beating the rating points up, and losing to it points down", () => {
  assert.equal(skillTrend(64, week(74)), "up");
  assert.equal(skillTrend(64, week(54)), "down");
});

test("movement inside the margin draws no arrow in either direction", () => {
  const margin = trendMargin(TREND_MIN_REPS);
  assert.equal(skillTrend(64, week(64)), "flat");
  // Just inside the margin is silence, just outside it is an arrow. The exact
  // boundary is not asserted: `64 + margin` does not round-trip through
  // floating point to exactly `margin`, and a claim that turns on the
  // fifteenth decimal place is not a claim worth pinning.
  assert.equal(skillTrend(64, week(64 + margin - 0.01)), "flat");
  assert.equal(skillTrend(64, week(64 - margin + 0.01)), "flat");
  assert.equal(skillTrend(64, week(64 + margin + 0.01)), "up");
  assert.equal(skillTrend(64, week(64 - margin - 0.01)), "down");
});

// THE BUG THIS PINS. `TREND_MARGIN` was a flat 1 point, against a measured
// within-clip read noise of 3.5 (evals/CALIBRATION.md). A single rep landing
// two points under a player's rating painted a red arrow beside that skill,
// and a re-read of the very same clip would have painted it green.
test("one rep never paints an arrow, however far it lands from the rating", () => {
  assert.equal(skillTrend(64, { mean: 90, n: 1 }), "flat");
  assert.equal(skillTrend(64, { mean: 20, n: 1 }), "flat");
  assert.equal(skillTrend(64, { mean: 90, n: TREND_MIN_REPS - 1 }), "flat");
  assert.equal(skillTrend(64, { mean: 90, n: TREND_MIN_REPS }), "up");
});

test("the margin never drops inside the noise of the mean it is judging", () => {
  // Two standard errors of a mean of n reads. If someone lowers this, the
  // arithmetic below fails rather than the arrows quietly getting louder.
  for (const n of [1, 2, 3, 4, 7, 12, 40]) {
    const expected = (2 * SCORE_READ_NOISE_SD) / Math.sqrt(n);
    assert.equal(trendMargin(n), expected, `margin at n=${n}`);
    assert.ok(trendMargin(n) >= expected, `margin at n=${n} is inside the noise`);
  }
  // More evidence buys a finer margin, never a coarser one.
  assert.ok(trendMargin(12) < trendMargin(3), "more reps must not raise the bar");
  assert.ok(trendMargin(0) === trendMargin(1), "an empty window cannot divide by zero");
});

test("nothing filmed this week is flat, not a guess in either direction", () => {
  assert.equal(skillTrend(64, null), "flat");
  assert.equal(skillTrend(64, undefined), "flat");
});

test("an unrated skill is flat however good this week's reps were", () => {
  assert.equal(skillTrend(null, week(90)), "flat");
  assert.equal(skillTrend(undefined, week(90)), "flat");
  assert.equal(skillTrend(Number.NaN, week(90)), "flat");
});

test("the count travels with the mean, because the margin depends on it", () => {
  const means = meanBySkill([
    { skill: "serve", overall_score: 70 },
    { skill: "serve", overall_score: 80 },
    { skill: "pass", overall_score: 61 },
  ]);
  assert.deepEqual(means.serve, { mean: 75, n: 2 });
  assert.deepEqual(means.pass, { mean: 61, n: 1 });
});

// A skill nobody filmed must be ABSENT rather than 0: `skillTrend` reads
// absence as "nothing to say" and 0 as "they scored zero", and those paint
// different arrows.
test("a skill with no reps in the window is absent, never zero", () => {
  const means = meanBySkill([{ skill: "serve", overall_score: 70 }]);
  assert.equal("block" in means, false);
  assert.equal(means.block, undefined);
  assert.equal(skillTrend(55, means.block), "flat");
});

test("an empty window produces no means at all", () => {
  assert.deepEqual(meanBySkill([]), {});
});
