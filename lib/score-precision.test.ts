import test from "node:test";
import assert from "node:assert/strict";
import {
  MEANINGFUL_SCORE_DELTA,
  SCORE_READ_NOISE_SD,
  SCORE_STEP,
  beats,
  displayScore,
  scorePrecisionNote,
  scoresDiffer,
} from "./score-precision.ts";

test("the display step hides the digit that is pure noise", () => {
  assert.equal(displayScore(81), 80);
  assert.equal(displayScore(78), 80);
  assert.equal(displayScore(71), 70);
  assert.equal(displayScore(74), 75);
  // The whole point: the spread of a single clip read three times collapses to
  // one displayed value instead of three.
  const oneClipReadThrice = [78, 81, 82].map(displayScore);
  assert.deepEqual(oneClipReadThrice, [80, 80, 80]);
});

test("a displayed score never leaves the scale", () => {
  assert.equal(displayScore(0), 0);
  assert.equal(displayScore(100), 100);
  assert.equal(displayScore(-12), 0);
  assert.equal(displayScore(137), 100);
  assert.equal(displayScore(Number.NaN), 0);
  for (let raw = 0; raw <= 100; raw++) {
    const shown = displayScore(raw);
    assert.ok(shown >= 0 && shown <= 100, `${raw} displayed as ${shown}`);
    assert.equal(shown % SCORE_STEP, 0, `${raw} displayed off-step as ${shown}`);
  }
});

test("the display step is finer than the line the product may speak across", () => {
  // These two numbers do different jobs and the smaller one must stay smaller:
  // the step governs how the number LOOKS, the delta governs what may be SAID.
  // If the step ever grew past the delta, two adjacent displayed values would
  // be a difference the product is allowed to assert, which is backwards.
  assert.ok(
    SCORE_STEP < MEANINGFUL_SCORE_DELTA,
    "the display step must stay finer than the assertion floor",
  );
});

test("the assertion floor is not below the measured noise", () => {
  // The floor exists to sit ABOVE a single read's noise. If someone tunes the
  // noise estimate up after a re-measurement and leaves the floor alone, this
  // fails rather than letting the product quietly start speaking inside it.
  assert.ok(
    MEANINGFUL_SCORE_DELTA > SCORE_READ_NOISE_SD,
    `a ${MEANINGFUL_SCORE_DELTA}-point floor is inside a ${SCORE_READ_NOISE_SD}-point noise band`,
  );
});

test("two reps inside the noise band are not called different", () => {
  assert.equal(scoresDiffer(78, 81), false);
  assert.equal(scoresDiffer(81, 78), false);
  assert.equal(scoresDiffer(75, 82), false, "exactly 7 apart is still the same rep");
  assert.equal(scoresDiffer(75, 83), true);
  assert.equal(scoresDiffer(60, 90), true);
  assert.equal(scoresDiffer(80, 80), false);
});

test("a personal best has to actually beat the old one", () => {
  // The bug this prevents: a 79 becomes an 80 and the player is told it is
  // their best rep yet, when re-reading either clip would flip the order.
  assert.equal(beats(80, 79), false);
  assert.equal(beats(86, 79), false, "exactly 7 better is still the same rep");
  assert.equal(beats(87, 79), true);
  assert.equal(beats(70, 85), false);
  assert.equal(beats(62, null), true, "a first rep is always the best so far");
});

test("nothing here is asymmetric or NaN-permissive", () => {
  assert.equal(scoresDiffer(Number.NaN, 80), false);
  assert.equal(beats(Number.NaN, 80), false);
  assert.equal(beats(80, Number.NaN), false);
  for (const [a, b] of [[71, 89], [80, 80], [55, 62]] as const) {
    assert.equal(scoresDiffer(a, b), scoresDiffer(b, a), `${a} vs ${b} is asymmetric`);
  }
});

test("the precision note states the limit in the player's terms, not in sigma", () => {
  const note = scorePrecisionNote();
  assert.match(note, new RegExp(String(SCORE_STEP)));
  assert.match(note, new RegExp(String(MEANINGFUL_SCORE_DELTA)));
  assert.doesNotMatch(note, /deviation|sigma|sd\b|variance|reliability/i);
});
