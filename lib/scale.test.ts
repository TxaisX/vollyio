import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calibrate,
  combineReads,
  coverageCap,
  coveragePct,
  distribution,
  finalScore,
  fitAnchors,
  reliability,
  PROVISIONAL_ANCHORS,
  SCALE_MAX,
  SCALE_MIN,
} from "./scale.ts";

test("calibration is monotone: a better raw score never maps lower", () => {
  let prev = -1;
  for (let raw = 0; raw <= 100; raw++) {
    const out = calibrate(raw);
    assert.ok(out >= prev, `raw ${raw} mapped to ${out}, below ${prev}`);
    prev = out;
  }
});

test("both ends of the scale are reachable", () => {
  assert.equal(calibrate(100), SCALE_MAX);
  assert.equal(calibrate(0), SCALE_MIN);
});

test("the observed live window is stretched, not shifted", () => {
  // The whole reason this module exists: every production score sat in 71-92,
  // a 21-point window. After calibration that same window has to span enough
  // of the scale for the number to mean something.
  const before = 92 - 71;
  const after = calibrate(92) - calibrate(71);
  assert.ok(after > before * 2, `window went ${before} -> ${after}, expected a real stretch`);
});

test("a malformed anchor set flattens instead of inverting", () => {
  const bad = [
    { raw: 0, final: 0 },
    { raw: 50, final: 80 },
    { raw: 60, final: 20 }, // inverted on purpose
    { raw: 100, final: 100 },
  ];
  assert.ok(calibrate(60, bad) >= calibrate(50, bad));
});

test("coverage percentage counts only what was visible", () => {
  assert.equal(coveragePct(5, 5), 100);
  assert.equal(coveragePct(2, 5), 40);
  assert.equal(coveragePct(0, 5), 0);
  assert.equal(coveragePct(9, 5), 100, "more visible than declared is clamped");
  assert.equal(coveragePct(1, 0), 0, "no declared checkpoints is no coverage");
});

test("full coverage does not cap, partial coverage does", () => {
  assert.equal(coverageCap(100), SCALE_MAX);
  assert.ok(coverageCap(80) < SCALE_MAX);
  assert.ok(coverageCap(40) < coverageCap(80));
});

test("a thin read cannot claim a top score", () => {
  const seen = finalScore(92, 5, 5);
  const barelySeen = finalScore(92, 2, 5);
  assert.ok(barelySeen.score < seen.score);
  assert.ok(barelySeen.capped);
  assert.ok(barelySeen.low_confidence);
});

test("a bad rep filmed well is not rescued by coverage", () => {
  const bad = finalScore(55, 5, 5);
  assert.ok(bad.score < 30, `expected a failing rep to score low, got ${bad.score}`);
  assert.equal(bad.capped, false);
});

test("raw is preserved so the map can be refitted over stored history", () => {
  const out = finalScore(78, 5, 5);
  assert.equal(out.raw, 78);
  assert.ok(out.scale_version >= 2);
});

test("fitAnchors refuses to fit from too few labels", () => {
  assert.equal(fitAnchors([{ raw: 78, label: 60 }]), null);
});

test("fitAnchors returns a monotone map through the labels", () => {
  const pairs = [
    { raw: 71, label: 40 },
    { raw: 74, label: 45 },
    { raw: 76, label: 55 },
    { raw: 78, label: 50 }, // out of order on purpose; isotonic must pool it
    { raw: 80, label: 62 },
    { raw: 83, label: 70 },
    { raw: 88, label: 80 },
    { raw: 92, label: 88 },
  ];
  const anchors = fitAnchors(pairs);
  assert.ok(anchors, "eight labeled pairs is enough to fit");
  let prev = -1;
  for (const a of anchors!) {
    assert.ok(a.final >= prev, "fitted anchors must not invert");
    prev = a.final;
  }
  assert.equal(anchors![0].raw, SCALE_MIN, "the low end is pinned");
  assert.equal(anchors![anchors!.length - 1].raw, SCALE_MAX, "the high end is pinned");
});

test("fitAnchors averages clips the model scored identically", () => {
  const pairs = [
    { raw: 78, label: 40 },
    { raw: 78, label: 60 },
    ...Array.from({ length: 6 }, (_, i) => ({ raw: 80 + i, label: 70 + i })),
  ];
  const anchors = fitAnchors(pairs)!;
  const at78 = anchors.find((a) => a.raw === 78);
  assert.equal(at78?.final, 50, "two labels on one raw value average");
});

test("three reads combine to their median, not their mean", () => {
  // The real case from the stability sample: 71, 68, 54. A mean answers 64 and
  // lets one disagreeing draw move the player 7 points.
  const out = combineReads([
    { score: 71, ratable: true, visible: 5, declared: 5 },
    { score: 68, ratable: true, visible: 5, declared: 5 },
    { score: 54, ratable: true, visible: 5, declared: 5 },
  ]);
  assert.equal(out.score, 68);
  assert.equal(out.spread, 17);
});

test("a majority of refusals refuses, rather than scoring from the minority", () => {
  const out = combineReads([
    { score: null, ratable: false, visible: 0, declared: 5 },
    { score: null, ratable: false, visible: 0, declared: 5 },
    { score: 80, ratable: true, visible: 5, declared: 5 },
  ]);
  assert.equal(out.ratable, false);
  assert.equal(out.score, null);
});

test("one refusal among three does not sink a scored clip", () => {
  const out = combineReads([
    { score: 78, ratable: true, visible: 5, declared: 5 },
    { score: 82, ratable: true, visible: 5, declared: 5 },
    { score: null, ratable: false, visible: 0, declared: 5 },
  ]);
  assert.equal(out.ratable, true);
  assert.equal(out.score, 80);
});

test("coverage takes the median too, so one blind read does not decide it", () => {
  const out = combineReads([
    { score: 78, ratable: true, visible: 5, declared: 5 },
    { score: 80, ratable: true, visible: 4, declared: 5 },
    { score: 79, ratable: true, visible: 1, declared: 5 },
  ]);
  assert.equal(out.visible, 4);
});

test("a single read still combines, and reports no spread", () => {
  const out = combineReads([{ score: 78, ratable: true, visible: 5, declared: 5 }]);
  assert.equal(out.score, 78);
  assert.equal(out.spread, 0);
  assert.equal(out.reads, 1);
});

test("reliability falls as read noise rises", () => {
  const scores = [71, 74, 76, 78, 81, 83, 88, 92];
  assert.ok(reliability(scores, 1) > reliability(scores, 4));
  assert.equal(reliability(scores, 100), 0, "noise larger than the spread leaves nothing real");
});

test("distribution reports the range a scale actually used", () => {
  const d = distribution([71, 74, 78, 78, 85, 92]);
  assert.equal(d.n, 6);
  assert.equal(d.min, 71);
  assert.equal(d.max, 92);
  assert.equal(d.range, 21);
});

test("the provisional map is itself monotone and spans the scale", () => {
  const finals = PROVISIONAL_ANCHORS.map((a) => a.final);
  assert.deepEqual(finals, [...finals].sort((a, b) => a - b));
  assert.equal(finals[finals.length - 1], SCALE_MAX);
});
