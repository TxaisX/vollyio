import { test } from "node:test";
import assert from "node:assert/strict";
import { outputSpec } from "./output-spec.ts";

test("one advanced coaching voice and an unseen-mechanics summary note (D-053)", () => {
  const spec = outputSpec("attack");
  assert.ok(spec.includes("high-performance coach"), "the single advanced voice is present");
  assert.ok(!spec.includes("This player is a beginner"), "per-level framing is gone");
  assert.ok(!spec.includes("professional tier"), "per-level framing is gone");
  assert.ok(
    spec.includes("uncertainty must never lower a score"),
    "unclear evidence goes to not_visible, never partial",
  );
  assert.ok(
    spec.includes("Not visible in this clip"),
    "unseen mechanics land as a summary note",
  );
  assert.ok(
    spec.includes("never lower a score"),
    "not_visible is excluded from every number",
  );
});

test("subject check binds the ring marker across the whole sequence", () => {
  const spec = outputSpec("attack");
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
  const spec = outputSpec("attack");
  assert.ok(!spec.includes("MEASURED DATA"), "the measured-data section is gone");
  assert.ok(!spec.includes("on-device motion tracking"));
  assert.ok(!spec.includes("omitted_below_confidence"));
});

test("no ball-tracking output survives its removal", () => {
  const spec = outputSpec("serve");
  assert.ok(!spec.includes("BALL TRACKING"));
  assert.ok(!spec.includes("ball_track"));
});
