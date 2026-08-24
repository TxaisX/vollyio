import { test } from "node:test";
import assert from "node:assert/strict";
import { skillTrend, meanBySkill, TREND_MARGIN } from "./skill-trend.ts";

// The arrow is a claim about a player's form, printed in green or red on the
// first page they see. These tests exist because the two ways to get it wrong
// are both silent: an arrow that points the wrong way, and an arrow drawn at
// all when there is nothing to say.

test("the week beating the rating points up, and losing to it points down", () => {
  assert.equal(skillTrend(64, 70), "up");
  assert.equal(skillTrend(64, 58), "down");
});

test("movement inside the margin draws no arrow in either direction", () => {
  assert.equal(skillTrend(64, 64), "flat");
  assert.equal(skillTrend(64, 64 + TREND_MARGIN), "flat", "the margin itself is not movement");
  assert.equal(skillTrend(64, 64 - TREND_MARGIN), "flat");
  // Just outside it is.
  assert.equal(skillTrend(64, 64 + TREND_MARGIN + 0.01), "up");
  assert.equal(skillTrend(64, 64 - TREND_MARGIN - 0.01), "down");
});

test("nothing filmed this week is flat, not a guess in either direction", () => {
  assert.equal(skillTrend(64, null), "flat");
  assert.equal(skillTrend(64, undefined), "flat");
});

test("an unrated skill is flat however good this week's reps were", () => {
  assert.equal(skillTrend(null, 90), "flat");
  assert.equal(skillTrend(undefined, 90), "flat");
  assert.equal(skillTrend(Number.NaN, 90), "flat");
});

test("a mean is a mean, and one rep is enough to have one", () => {
  const means = meanBySkill([
    { skill: "serve", overall_score: 70 },
    { skill: "serve", overall_score: 80 },
    { skill: "pass", overall_score: 61 },
  ]);
  assert.equal(means.serve, 75);
  assert.equal(means.pass, 61);
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
