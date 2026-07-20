import { test } from "node:test";
import assert from "node:assert/strict";
import { outputSpec } from "./output-spec.ts";

test("subject check binds the ring marker across the whole sequence", () => {
  const spec = outputSpec("attack", "intermediate");
  assert.ok(spec.includes("SUBJECT CHECK"));
  assert.ok(spec.includes("ring marker"), "the marker is a ring, not a skeleton overlay");
  assert.ok(
    spec.includes("EVERY frame, not only the marked one"),
    "the model must follow the ringed athlete across frames, not just in the marked frame",
  );
  assert.ok(
    spec.includes("rather than guessing"),
    "losing the subject must be said, never papered over",
  );
});

test("no measurement language survives the engine removal (D-033)", () => {
  const spec = outputSpec("attack", "intermediate");
  assert.ok(!spec.includes("MEASURED DATA"), "the measured-data section is gone");
  assert.ok(!spec.includes("on-device motion tracking"));
  assert.ok(!spec.includes("omitted_below_confidence"));
});

test("ball positions stay visual estimates with an honest abstain lane", () => {
  const spec = outputSpec("serve", "beginner");
  assert.ok(spec.includes("Never invent a confident position you cannot see"));
});
