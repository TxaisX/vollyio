import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedOverall } from "./derive.ts";
import { METRICS } from "./metrics.ts";

test("every skill's metric weights sum to 100", () => {
  for (const [skill, metrics] of Object.entries(METRICS)) {
    const sum = metrics.reduce((s, m) => s + m.weight, 0);
    assert.equal(sum, 100, `${skill} weights sum to ${sum}, expected 100`);
  }
});

test("overall is the weighted mean over observed metrics; coverage is the observed weight", () => {
  const r = weightedOverall([
    { score: 80, observed: true, weight: 30 },
    { score: 60, observed: true, weight: 20 },
    { score: 90, observed: false, weight: 30 },
    { score: 40, observed: false, weight: 20 },
  ]);
  // (80*30 + 60*20) / 50 = 3600 / 50 = 72
  assert.equal(r.overall, 72);
  assert.equal(r.coveragePct, 50);
  assert.equal(r.lowConfidence, true); // 50 < 60
});

test("full coverage is not low-confidence and the heavier metric moves the number more", () => {
  const r = weightedOverall([
    { score: 90, observed: true, weight: 70 },
    { score: 50, observed: true, weight: 30 },
  ]);
  // (90*70 + 50*30) / 100 = 7800 / 100 = 78, pulled toward the weight-70 metric
  assert.equal(r.overall, 78);
  assert.equal(r.coveragePct, 100);
  assert.equal(r.lowConfidence, false);
});

test("nothing observed yields a null overall and zero coverage", () => {
  const r = weightedOverall([
    { score: 80, observed: false, weight: 50 },
    { score: 60, observed: false, weight: 50 },
  ]);
  assert.equal(r.overall, null);
  assert.equal(r.coveragePct, 0);
  assert.equal(r.lowConfidence, true);
});
