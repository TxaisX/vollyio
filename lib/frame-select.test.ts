import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTrimWindow, MIN_TRIM_SPAN_S } from "./frame-select.ts";

test("clampTrimWindow defaults to the whole clip and clamps out-of-range trims", () => {
  assert.deepEqual(clampTrimWindow(30), { startS: 0, endS: 30 });
  assert.deepEqual(clampTrimWindow(30, null), { startS: 0, endS: 30 });
  assert.deepEqual(clampTrimWindow(30, { startS: -5, endS: 99 }), { startS: 0, endS: 30 });
  assert.deepEqual(clampTrimWindow(30, { startS: 4, endS: 12 }), { startS: 4, endS: 12 });
});

test("clampTrimWindow never collapses below the minimum span", () => {
  const w = clampTrimWindow(30, { startS: 10, endS: 10.5 });
  assert.ok(w.endS - w.startS >= MIN_TRIM_SPAN_S);
  assert.equal(w.endS, 10.5);
  assert.equal(w.startS, 10.5 - MIN_TRIM_SPAN_S);
  // Clips shorter than the minimum span stay whole.
  assert.deepEqual(clampTrimWindow(1.2, { startS: 0.5, endS: 1.0 }), {
    startS: 0,
    endS: 1.2,
  });
});

test("clampTrimWindow inverted bounds resolve to a valid window", () => {
  const w = clampTrimWindow(30, { startS: 20, endS: 8 });
  assert.ok(w.endS - w.startS >= MIN_TRIM_SPAN_S);
  assert.ok(w.startS >= 0 && w.endS <= 30);
});
