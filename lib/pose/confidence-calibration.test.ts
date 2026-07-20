// Pins the confidence gate to the engine it was calibrated against (D-028).
//
// This file exists because of a near-miss. D-026 anchored the visibility remap
// to RTMPose's scale; D-028 swapped the engine back to MediaPipe, whose clean
// joints read ~0.95 instead of ~0.70. Under the old constants that mapped to
// 1.35, clamped to 1.0 — every metric would have passed the floor and the
// abstain lane would have silently stopped abstaining. Nothing would have
// thrown, no test would have failed, and the model would have been handed
// unreliable measurements labelled as confident.
//
// So these assertions are deliberately about MEANING, not arithmetic: a clean
// joint must pass, occlusion must fail at every reliability, and the engine
// the app actually loads must be one these anchors describe.

import assert from "node:assert/strict";
import test from "node:test";

import {
  CALIBRATED_ENGINES,
  NOISE_FLOOR,
  VISIBILITY_ANCHORS,
  confidenceScore,
  isCalibratedFor,
} from "./metrics.ts";
import { POSE_MODELS } from "./model-manifest.ts";

test("a cleanly seen joint clears the floor and lands near its anchor", () => {
  const conf = confidenceScore(VISIBILITY_ANCHORS.cleanVis, 1, 1);
  assert.ok(
    Math.abs(conf - VISIBILITY_ANCHORS.cleanConfidence) < 1e-9,
    `clean joint should map to its documented anchor, got ${conf}`,
  );
  assert.ok(conf > NOISE_FLOOR, "a clean joint must be transmitted, not omitted");
});

test("occlusion is omitted at every reliability", () => {
  for (const reliability of [0.1, 0.25, 0.5, 0.78, 0.9, 1]) {
    const conf = confidenceScore(VISIBILITY_ANCHORS.occludedVis, 1, reliability);
    assert.ok(
      conf < NOISE_FLOOR,
      `occluded landmark must stay below the floor at reliability ${reliability}, got ${conf}`,
    );
  }
});

test("confidence rises monotonically with visibility", () => {
  let previous = -1;
  for (const vis of [0, 0.2, 0.4, 0.6, 0.8, 0.95, 1]) {
    const conf = confidenceScore(vis, 1, 1);
    assert.ok(conf >= previous, `confidence must not fall as visibility rises (at vis=${vis})`);
    previous = conf;
  }
});

test("fit and reliability can only attenuate, never promote", () => {
  const full = confidenceScore(VISIBILITY_ANCHORS.cleanVis, 1, 1);
  assert.ok(confidenceScore(VISIBILITY_ANCHORS.cleanVis, 0, 1) <= full);
  assert.ok(confidenceScore(VISIBILITY_ANCHORS.cleanVis, 1, 0.5) <= full);
  assert.equal(confidenceScore(VISIBILITY_ANCHORS.cleanVis, 1, 0), 0);
});

// The guard against the D-026 -> D-028 failure mode recurring: if someone swaps
// the pose engine and does not re-derive the anchors above, this fails.
test("every shipped pose model is covered by the calibration", () => {
  for (const model of POSE_MODELS) {
    assert.ok(
      isCalibratedFor(model.name),
      `${model.name} is shipped but the confidence gate was not calibrated for it — ` +
        `re-derive VISIBILITY_ANCHORS against this engine's visibility scale, ` +
        `then add it to CALIBRATED_ENGINES (currently: ${CALIBRATED_ENGINES.join(", ")})`,
    );
  }
});

test("an unknown engine is reported as uncalibrated", () => {
  assert.equal(isCalibratedFor("rtm-body7-m/webgpu"), false);
  assert.equal(isCalibratedFor("some-future-engine/gpu"), false);
});
