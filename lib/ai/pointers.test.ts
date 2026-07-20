// The pointer catalog and derivation (D-039).

import assert from "node:assert/strict";
import test from "node:test";

import { METRICS } from "./metrics.ts";
import { SKILLS } from "../skills.ts";
import { POINTERS, deriveMetric, parsePointerStatus, pointerSpec } from "./pointers.ts";

test("every skill's every metric carries a concrete pointer checklist", () => {
  for (const skill of SKILLS) {
    const metricKeys = METRICS[skill].map((m) => m.key);
    assert.deepEqual(
      Object.keys(POINTERS[skill]).sort(),
      [...metricKeys].sort(),
      `${skill}: pointer catalog must cover exactly the metric taxonomy`,
    );
    for (const key of metricKeys) {
      const pointers = POINTERS[skill][key];
      assert.ok(pointers.length >= 3, `${skill}.${key} needs at least 3 pointers`);
      const keys = pointers.map((p) => p.key);
      assert.equal(new Set(keys).size, keys.length, `${skill}.${key} pointer keys must be unique`);
      for (const p of pointers) assert.ok(p.cue.length > 10, "cues are real sentences");
    }
  }
});

test("scores derive from the checklist: all met is elite, all missed is broken", () => {
  const all = (status: string) =>
    POINTERS.attack.arm_swing.map((p) => ({ key: p.key, status }));
  assert.equal(deriveMetric("attack", "arm_swing", all("met")).raw, 95);
  assert.equal(deriveMetric("attack", "arm_swing", all("missed")).raw, 30);
  const half = POINTERS.attack.arm_swing.map((p, i) => ({
    key: p.key,
    status: i % 2 === 0 ? "met" : "missed",
  }));
  const mid = deriveMetric("attack", "arm_swing", half).raw;
  assert.ok(mid > 30 && mid < 95);
});

test("invisibility is excluded from the math, never counted against the athlete", () => {
  const ps = POINTERS.attack.approach_footwork;
  const oneVisible = ps.map((p, i) => ({
    key: p.key,
    status: i === 0 ? "met" : "not_visible",
  }));
  const d = deriveMetric("attack", "approach_footwork", oneVisible);
  assert.equal(d.observed, true);
  assert.equal(d.raw, 95, "one visible met pointer scores as met, not diluted");
  const noneVisible = ps.map((p) => ({ key: p.key, status: "not_visible" }));
  assert.equal(deriveMetric("attack", "approach_footwork", noneVisible).observed, false);
  assert.equal(deriveMetric("attack", "approach_footwork", undefined).observed, false);
});

test("unknown statuses and unknown keys degrade to not_visible instead of failing", () => {
  assert.equal(parsePointerStatus("somewhat"), "not_visible");
  assert.equal(parsePointerStatus(undefined), "not_visible");
  const d = deriveMetric("attack", "arm_swing", [{ key: "invented_key", status: "met" }]);
  assert.equal(d.observed, false, "an invented pointer key cannot manufacture a score");
});

test("the prompt checklist names every pointer key exactly", () => {
  const spec = pointerSpec("serve");
  for (const [metric, pointers] of Object.entries(POINTERS.serve)) {
    assert.ok(spec.includes(`${metric}:`));
    for (const p of pointers) assert.ok(spec.includes(p.key), `${p.key} must be in the prompt`);
  }
});
