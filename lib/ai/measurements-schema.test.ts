import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeMeasurements } from "./measurements-schema.ts";

// A block whose only surviving metric sits between the noise floor and the old
// per-metric threshold: it is present, low-confidence, and must survive intact.
function lowConfidenceBlock() {
  return {
    version: 1 as const,
    capture: { dense_fps: 30, coverage: "full" as const, engine: "onnx" },
    units: "body-relative",
    reps: [
      {
        start_s: 1.5,
        contact_s: 2.2,
        end_s: 3.0,
        detector: "swing" as const,
        metrics: {
          knee_flexion_at_plant: { value: 168, unit: "deg", confidence: 0.42 },
          jump_height: { value: 0.2, unit: "body_heights", confidence: 0.51 },
        },
      },
    ],
    session: { rep_count: 1 },
    omitted_below_confidence: ["approach_tempo"],
  };
}

test("low-confidence-but-present metrics round-trip through sanitizeMeasurements unchanged", () => {
  const block = lowConfidenceBlock();
  const out = sanitizeMeasurements(block);
  assert.ok(out, "expected a valid block back");
  assert.deepEqual(out, block);
  assert.equal(out.reps[0].metrics.knee_flexion_at_plant.confidence, 0.42);
});

test("sanitizeMeasurements fails open, returning null on an invalid block", () => {
  assert.equal(sanitizeMeasurements(null), null);
  assert.equal(sanitizeMeasurements({ version: 99 }), null);
  // Confidence out of range is dropped, not coerced.
  const bad = lowConfidenceBlock();
  bad.reps[0].metrics.jump_height.confidence = 1.7;
  assert.equal(sanitizeMeasurements(bad), null);
});
