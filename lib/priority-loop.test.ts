import { test } from "node:test";
import assert from "node:assert/strict";
import { lastTimeFix } from "./priority-loop.ts";

type M = { key: string; score: number; observed: boolean };
const rep = (targetMetric: string, fixTitle: string, metrics: M[]) => ({
  priority_fix: { title: fixTitle },
  changes: [{ target_metric: targetMetric }],
  metrics,
});

test("the checkpoint behind last time's fix reports its then->now movement", () => {
  const prev = rep("arm_swing", "Snap the wrist through contact", [
    { key: "arm_swing", score: 60, observed: true },
  ]);
  const now = rep("arm_swing", "Load the elbow earlier", [
    { key: "arm_swing", score: 71, observed: true },
  ]);
  assert.deepEqual(lastTimeFix(prev, now), {
    fixTitle: "Snap the wrist through contact",
    metricKey: "arm_swing",
    then: 60,
    now: 71,
    movement: "up",
  });

  const regressed = rep("arm_swing", "x", [{ key: "arm_swing", score: 52, observed: true }]);
  assert.equal(lastTimeFix(prev, regressed)!.movement, "down");

  const held = rep("arm_swing", "x", [{ key: "arm_swing", score: 60, observed: true }]);
  assert.equal(lastTimeFix(prev, held)!.movement, "same");
});

test("a checkpoint not visible this rep is 'unseen', never a fabricated delta", () => {
  const prev = rep("toss_quality", "Toss in front", [
    { key: "toss_quality", score: 55, observed: true },
  ]);
  const now = rep("toss_quality", "x", [
    { key: "toss_quality", score: 80, observed: false },
  ]);
  const out = lastTimeFix(prev, now)!;
  assert.equal(out.movement, "unseen");
  assert.equal(out.now, null);
  assert.equal(out.then, 55);
});

test("no prior score to compare against reads as a baseline, not an improvement", () => {
  const prev = rep("contact_point", "Reach higher", [
    { key: "contact_point", score: 70, observed: false },
  ]);
  const now = rep("contact_point", "x", [
    { key: "contact_point", score: 74, observed: true },
  ]);
  const out = lastTimeFix(prev, now)!;
  assert.equal(out.movement, "baseline");
  assert.equal(out.then, null);
  assert.equal(out.now, 74);
});

test("returns null when there is nothing comparable to show", () => {
  const now = rep("arm_swing", "x", [{ key: "arm_swing", score: 60, observed: true }]);
  assert.equal(lastTimeFix(null, now), null);
  assert.equal(lastTimeFix({ metrics: [] }, now), null); // no fix/changes
  assert.equal(
    lastTimeFix({ priority_fix: { title: "x" }, changes: [], metrics: [] }, now),
    null,
  ); // no target metric
});
