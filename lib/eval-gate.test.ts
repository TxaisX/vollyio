import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TARGETS, gateVerdict, runGates, type RunSummary } from "./eval-gate.ts";

/** A run with nothing wrong with it, used as the base for each failure case. */
function healthy(): RunSummary {
  return {
    scores: [12, 22, 31, 38, 45, 52, 58, 63, 69, 74, 81, 88, 94],
    refusedRatable: 0,
    scoredRatable: 40,
    refusedUnratable: 9,
    scoredUnratable: 1,
    fullVisibility: 20,
    visibilityReads: 50,
    spreads: [2, 4, 6, 3],
    rawScores: [40, 48, 55, 60, 66, 70, 75, 80, 85, 88, 92, 95, 98],
    noiseSd: 2,
  };
}

function statusOf(summary: RunSummary, name: string) {
  return runGates(summary).find((g) => g.name === name)?.status;
}

test("a healthy run passes every gate", () => {
  const gates = runGates(healthy());
  const failed = gates.filter((g) => g.status === "fail");
  assert.deepEqual(failed, [], `expected no failures, got ${failed.map((f) => f.detail).join("; ")}`);
  assert.equal(gateVerdict(gates), "pass");
});

test("the build measured on 2026-08-13 fails the gates", () => {
  // This is the point of the gate. The live scale sat at median 78 over a
  // 21-point range with 96% of reads claiming full visibility. A gate that
  // green-lights that has not gated anything.
  const live: RunSummary = {
    ...healthy(),
    scores: [71, 74, 74, 76, 76, 78, 78, 78, 79, 81, 83, 88, 92],
    fullVisibility: 48,
    visibilityReads: 50,
  };
  const gates = runGates(live);
  const failedNames = gates.filter((g) => g.status === "fail").map((g) => g.name);
  assert.ok(failedNames.includes("median_in_target"), "median 78 must fail");
  assert.ok(failedNames.includes("range_used"), "a 21-point range must fail");
  assert.ok(failedNames.includes("spread_not_collapsed"), "sd 5 must fail");
  assert.ok(failedNames.includes("abstain_lane_alive"), "96% full visibility must fail");
  assert.equal(gateVerdict(gates), "fail");
});

test("a run with no distribution to describe skips rather than passes", () => {
  const thin = { ...healthy(), scores: [60, 62, 64] };
  assert.equal(statusOf(thin, "distribution"), "skipped");
});

test("refusing clips a coach called ratable fails, because it costs a player a good rep", () => {
  const trigger = { ...healthy(), refusedRatable: 6, scoredRatable: 34 };
  assert.equal(statusOf(trigger, "false_refusals"), "fail");
});

test("scoring clips a coach called unratable fails, because that is the invented number", () => {
  const trigger = { ...healthy(), refusedUnratable: 2, scoredUnratable: 8 };
  assert.equal(statusOf(trigger, "missed_refusals"), "fail");
});

test("an untested refusal lane is unverified, never a pass", () => {
  const noLabels: RunSummary = {
    ...healthy(),
    refusedRatable: 0,
    scoredRatable: 0,
    refusedUnratable: 0,
    scoredUnratable: 0,
  };
  const gates = runGates(noLabels);
  assert.equal(gates.find((g) => g.name === "false_refusals")?.status, "skipped");
  assert.equal(gates.find((g) => g.name === "missed_refusals")?.status, "skipped");
  assert.equal(gateVerdict(gates), "unverified", "shape without labels proves nothing about correctness");
});

test("a single-run suite skips stability instead of claiming it", () => {
  assert.equal(statusOf({ ...healthy(), spreads: [] }, "stability"), "skipped");
});

test("a clip that swings across runs fails stability", () => {
  assert.equal(statusOf({ ...healthy(), spreads: [14, 11, 9] }, "stability"), "fail");
});

test("noise the size of the signal fails, even when every spread is small", () => {
  // The 2026-08-13 measurement: mean spread 4.9 against a between-clip sd of
  // 5.4. Every individual spread clears the 8-point stability bar, and the
  // score still cannot tell two reps apart.
  const noisy = {
    ...healthy(),
    spreads: [4, 5, 5, 6],
    noiseSd: 3.53,
    rawScores: [71, 74, 74, 76, 78, 78, 79, 81, 81, 83, 85, 88, 92],
  };
  assert.equal(statusOf(noisy, "stability"), "pass", "each clip is individually stable");
  assert.equal(statusOf(noisy, "noise_below_signal"), "fail", "but the noise is the signal");
});

test("noise cannot be judged without repeated runs", () => {
  assert.equal(statusOf({ ...healthy(), spreads: [] }, "noise_below_signal"), "skipped");
});

test("the targets are the ones the failure was measured against", () => {
  assert.ok(DEFAULT_TARGETS.minRange > 21, "the live range must not clear the bar");
  assert.ok(DEFAULT_TARGETS.medianMax < 78, "the live median must not clear the bar");
  assert.ok(DEFAULT_TARGETS.maxFullVisibilityRate < 0.96, "the live visibility rate must not clear the bar");
  assert.ok(DEFAULT_TARGETS.minReliability > 0.58, "the live reliability must not clear the bar");
});
