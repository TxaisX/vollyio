import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  updateRating,
  overallScore,
  SCORE_BANDS,
  scoreBand,
  scoreScaleCaption,
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

// The floors moved on 2026-08-25 to match lib/ai/output-spec.ts, which tells
// the read that 70-84 is sound repeatable mechanics, 85-93 is standout and
// 94-100 is near-flawless. They previously started Solid at 55 and Advanced at
// 80, so the label contradicted the instruction the number came from.
test("score bands follow the standard the read is scored against", () => {
  assert.equal(scoreBand(40), "Developing");
  assert.equal(scoreBand(69), "Developing");
  assert.equal(scoreBand(70), "Solid");
  assert.equal(scoreBand(81), "Solid", "the production median is sound mechanics, not advanced");
  assert.equal(scoreBand(84), "Solid");
  assert.equal(scoreBand(85), "Advanced");
  assert.equal(scoreBand(93), "Advanced");
  assert.equal(scoreBand(94), "Elite");
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

// THE LABEL AND THE SCALE PRINTED UNDER IT HAVE TO AGREE.
//
// Every surface showing a score also printed "40 developing / 70 solid /
// 90 advanced", which are the RUBRIC's anchors and not these bands. A rep
// scoring 56 was therefore labelled Solid beside a caption saying solid starts
// at 70, and an 85 was labelled Advanced beside a caption putting advanced at
// 90. Both edges disagreed, on the one screen the whole product exists to
// deliver. This pins the caption to the same table the naming reads.
test("the printed scale names the boundary each band actually starts at", () => {
  for (const band of SCORE_BANDS) {
    if (band.floor === 0) continue;
    assert.equal(
      scoreBand(band.floor),
      band.name,
      `the caption claims ${band.name} starts at ${band.floor}, and scoreBand disagrees`,
    );
    assert.notEqual(
      scoreBand(band.floor - 1),
      band.name,
      `${band.floor - 1} is already ${band.name}, so the caption understates the band`,
    );
    assert.match(scoreScaleCaption(), new RegExp(`${band.floor} ${band.name.toLowerCase()}`));
  }
});

test("the caption never advertises the rubric anchors as band boundaries", () => {
  // The exact string that was once on screen: 40/70/90 are the RUBRIC's
  // anchors, the numbers the model is told a developing or solid rep looks
  // like, and they were being printed as if they were band boundaries.
  //
  // Asserted as the whole triple rather than term by term, because "70 solid"
  // is now a legitimate boundary in its own right (SCORE_BANDS starts Solid
  // there). What must never come back is the anchor SET.
  const caption = scoreScaleCaption();
  assert.doesNotMatch(caption, /40 developing/);
  assert.doesNotMatch(caption, /90 advanced/);
  // And it is generated, never typed: every floor in the array appears.
  for (const band of SCORE_BANDS.filter((b) => b.floor > 0)) {
    assert.match(caption, new RegExp(`${band.floor} ${band.name.toLowerCase()}`));
  }
});

// THE LABEL MUST MEAN WHAT THE MODEL WAS TOLD IT MEANS.
//
// `lib/ai/output-spec.ts` is the instruction the read is scored against: 70-84
// is sound repeatable mechanics, 85-93 is standout, 94-100 is near-flawless.
// The bands are what the player is shown. When they disagreed, a rep the model
// judged merely sound came back labelled "Advanced", and a faulted one came
// back "Solid". Nothing in the suite noticed, because each file was internally
// consistent.
test("the score bands line up with the scoring standard the model is given", async () => {
  const spec = await readFile(new URL("./ai/output-spec.ts", import.meta.url), "utf8");
  const floor = (name: string) =>
    SCORE_BANDS.find((b) => b.name === name)?.floor ?? -1;

  assert.equal(floor("Solid"), 70, "the standard calls 70-84 sound repeatable mechanics");
  assert.equal(floor("Advanced"), 85, "the standard reserves 85-93 for standout execution");
  assert.equal(floor("Elite"), 94, "the standard reserves 94-100 for near-flawless");

  // And the standard still says those things. If someone retunes the prompt's
  // numbers, this fails rather than letting the labels drift off them again.
  assert.match(spec, /72-84/, "the sound-mechanics range moved in the prompt");
  assert.match(spec, /85-93/, "the standout range moved in the prompt");
  assert.match(spec, /94-100/, "the near-flawless range moved in the prompt");
});

test("no band claims territory the read has never once used", () => {
  // Production, 20 reads from the shipped engine: 71 to 89. A band whose floor
  // sits above the highest score ever produced is a label nobody can earn, and
  // one whose ceiling sits below the lowest is a label nobody can avoid.
  const solid = SCORE_BANDS.find((b) => b.name === "Solid")!.floor;
  assert.ok(solid <= 71, "every real read would be Developing");
  const elite = SCORE_BANDS.find((b) => b.name === "Elite")!.floor;
  assert.ok(elite > 89, "Elite must stay genuinely out of reach of an ordinary rep");
});
