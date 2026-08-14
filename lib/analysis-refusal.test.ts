import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRefusal } from "./analysis-telemetry.ts";

const base = {
  skill: "attack",
  discipline: "indoor",
  duration_s: 8.234,
  clip_bytes: 1_234_567,
  model: "vendor/model",
  provider: "upstream",
  reason: "The clip shows a training diagram rather than a rep.",
  marked: true,
};

test("a refusal is one line of JSON under a stable event name", () => {
  const parsed = JSON.parse(formatRefusal(base));
  assert.equal(parsed.event, "analyze.refusal");
  assert.equal(parsed.skill, "attack");
  assert.equal(parsed.marked, true);
});

test("the duration is rounded so the line stays readable", () => {
  assert.equal(JSON.parse(formatRefusal(base)).duration_s, 8.2);
  assert.equal(JSON.parse(formatRefusal({ ...base, duration_s: null })).duration_s, null);
  assert.equal(JSON.parse(formatRefusal({ ...base, duration_s: NaN })).duration_s, null);
});

test("no player identity can be recorded, because the type has nowhere to put it", () => {
  // Checked as an exact key list rather than a regex: "provider" contains the
  // letters of "id", and a substring test that fires on it is a test that gets
  // deleted the first time it cries wolf.
  assert.deepEqual(Object.keys(JSON.parse(formatRefusal(base))).sort(), [
    "clip_bytes",
    "discipline",
    "duration_s",
    "event",
    "marked",
    "model",
    "provider",
    "reason",
    "skill",
  ]);
});

test("a long or multi-line model reason is flattened and truncated", () => {
  const parsed = JSON.parse(formatRefusal({ ...base, reason: "a\n\n  b" + "x".repeat(400) }));
  assert.ok(parsed.reason.length <= 200);
  assert.doesNotMatch(parsed.reason, /\n/);
});

test("an empty reason is null rather than an empty string", () => {
  assert.equal(JSON.parse(formatRefusal({ ...base, reason: "   " })).reason, null);
  assert.equal(JSON.parse(formatRefusal({ ...base, reason: null })).reason, null);
});
