import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProbeTimes,
  findPeaks,
  planFrameTimes,
} from "./frame-select.ts";

const MAX_FRAMES = 12;

// A flat baseline with triangular bumps at the given probe indices.
function motionWith(length: number, bumps: { at: number; height: number }[]): number[] {
  const m = new Array(length).fill(1);
  for (const { at, height } of bumps) {
    for (let d = -2; d <= 2; d++) {
      const i = at + d;
      if (i >= 0 && i < length) {
        m[i] = Math.max(m[i], 1 + height * Math.max(0, 1 - Math.abs(d) / 2.5));
      }
    }
  }
  return m;
}

test("buildProbeTimes spans the trustworthy middle, ascending", () => {
  const p = buildProbeTimes(24, 24);
  assert.equal(p.length, 24);
  assert.ok(p[0] > 1.0 && p[0] < 1.4, `first ${p[0]}`);
  assert.ok(p[23] > 22.6 && p[23] < 23, `last ${p[23]}`);
  for (let i = 1; i < p.length; i++) assert.ok(p[i] > p[i - 1]);
});

test("findPeaks locates a single contact spike", () => {
  const probes = buildProbeTimes(24, 24);
  const peaks = findPeaks(motionWith(24, [{ at: 12, height: 25 }]), probes);
  assert.equal(peaks.length, 1);
  assert.ok(Math.abs(peaks[0].timeS - probes[12]) < probes[1] - probes[0]);
});

test("findPeaks returns two peaks for a multi-rep clip", () => {
  const probes = buildProbeTimes(24, 24);
  const peaks = findPeaks(
    motionWith(24, [{ at: 6, height: 25 }, { at: 18, height: 22 }]),
    probes,
  );
  assert.equal(peaks.length, 2);
});

test("findPeaks suppresses two peaks closer than the separation window", () => {
  // duration 8 → coarse interval ~0.31s, so bumps 2 probes apart are <1s apart.
  const probes = buildProbeTimes(8, 24);
  const peaks = findPeaks(
    motionWith(24, [{ at: 11, height: 20 }, { at: 13, height: 22 }]),
    probes,
  );
  assert.equal(peaks.length, 1);
});

test("findPeaks rejects a flat curve (→ fallback)", () => {
  const probes = buildProbeTimes(24, 24);
  assert.deepEqual(findPeaks(new Array(24).fill(5), probes), []);
  assert.deepEqual(findPeaks(new Array(24).fill(0), probes), []);
});

test("planFrameTimes clusters around the peak, within budget and sorted", () => {
  const probes = buildProbeTimes(24, 24);
  const coarse = probes[1] - probes[0];
  const plan = planFrameTimes(24, [{ timeS: 12, score: 20 }], coarse, MAX_FRAMES);
  assert.ok(plan.length >= 2 && plan.length <= MAX_FRAMES);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].timeS >= plan[i - 1].timeS);
  assert.ok(plan.some((f) => f.kind === "peak" && Math.abs(f.timeS - 12) < 0.3));
  assert.ok(plan.every((f) => f.timeS >= 0.05 && f.timeS <= 24));
});

test("planFrameTimes never exceeds the frame budget with multiple peaks", () => {
  const coarse = 0.94;
  const peaks = [
    { timeS: 5, score: 20 },
    { timeS: 12, score: 15 },
    { timeS: 19, score: 10 },
  ];
  assert.ok(planFrameTimes(24, peaks, coarse, MAX_FRAMES).length <= MAX_FRAMES);
});

test("planFrameTimes returns nothing without peaks", () => {
  assert.deepEqual(planFrameTimes(24, [], 0.94, MAX_FRAMES), []);
});
