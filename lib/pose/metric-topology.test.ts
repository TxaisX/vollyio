// Guards metric definitions against the engine's actual landmark topology
// (D-028).
//
// Why this exists: `visibilityMean` divides by the NUMBER of landmarks a metric
// declares, but a landmark the engine never emits contributes 0 to the sum. So
// declaring a phantom landmark does not throw, does not warn, and does not show
// up in review — it just quietly halves that metric's confidence and can push
// it under the abstain floor forever.
//
// That is not hypothetical. Under the previous 17-keypoint engine,
// serve.contact_height and attack.jump_height each declared two heel landmarks
// that were never populated. A clean 0.95 visibility mean became 0.475, which
// maps below NOISE_FLOOR, so both metrics were omitted from every single
// analysis — silently, for the life of that engine.

import assert from "node:assert/strict";
import test from "node:test";

import { SKILLS } from "../skills.ts";
import { keyJointsForSkill } from "./metrics.ts";
import { EMITTED_LANDMARKS } from "./model-manifest.ts";
import { LM, POSE_LANDMARK_COUNT } from "./types.ts";

test("every metric landmark is actually emitted by the engine", () => {
  const emitted = new Set(EMITTED_LANDMARKS);
  for (const skill of SKILLS) {
    for (const index of keyJointsForSkill(skill)) {
      assert.ok(
        emitted.has(index),
        `${skill} declares landmark ${index}, which the pose engine does not emit — ` +
          `its confidence will be silently diluted and the metric may never be reported`,
      );
    }
  }
});

test("the emitted topology covers the full landmark contract", () => {
  assert.equal(
    EMITTED_LANDMARKS.length,
    POSE_LANDMARK_COUNT,
    "engine topology and the landmark contract must agree",
  );
});

// The specific landmarks the previous engine dropped. Pinned by name so a
// future engine swap that loses feet fails here rather than in production.
test("foot landmarks are emitted (the pair the old engine dropped)", () => {
  const emitted = new Set(EMITTED_LANDMARKS);
  for (const [name, index] of [
    ["leftHeel", LM.leftHeel],
    ["rightHeel", LM.rightHeel],
    ["leftFootIndex", LM.leftFootIndex],
    ["rightFootIndex", LM.rightFootIndex],
  ] as const) {
    assert.ok(emitted.has(index), `${name} (${index}) must be emitted`);
  }
});
