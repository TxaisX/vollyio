// Frame sizing rules (D-028).
//
// Downscaling protects the request budget; upscaling exists because a
// sub-target clip was previously handed to the model at native size, so a 640px
// phone clip was read at 640px even though the budget allowed 1568. Both
// directions are bounded: down to the cap, up by at most MAX_UPSCALE_FACTOR,
// because beyond that the extra pixels are interpolation artifacts that still
// cost image tokens.

import assert from "node:assert/strict";
import test from "node:test";

import { scaledSize } from "./frame-scale.ts";

test("oversized frames are scaled down to the cap on their long edge", () => {
  assert.deepEqual(scaledSize(3840, 2160, 1568), [1568, 882]);
  assert.deepEqual(scaledSize(2160, 3840, 1568), [882, 1568]);
});

test("downscaling preserves aspect ratio", () => {
  const [w, h] = scaledSize(1920, 1080, 768);
  assert.equal(w, 768);
  assert.ok(Math.abs(w / h - 1920 / 1080) < 0.01);
});

test("sub-target frames are left alone unless upscaling is requested", () => {
  assert.deepEqual(scaledSize(640, 480, 1568), [640, 480]);
});

test("upscaling raises a small frame toward the target", () => {
  // 640 -> 1280 (2x cap), not 1568, which would be 2.45x.
  assert.deepEqual(scaledSize(640, 480, 1568, { upscale: true }), [1280, 960]);
});

test("upscaling never exceeds the factor cap", () => {
  const [w, h] = scaledSize(320, 240, 1568, { upscale: true });
  assert.equal(w, 640, "320px source must cap at 2x, not stretch to the target");
  assert.equal(h, 480);
});

test("upscaling stops at the target when the source is already close", () => {
  // 1200 -> 1568 is 1.31x, under the cap, so it reaches the target exactly.
  const [w] = scaledSize(1200, 900, 1568, { upscale: true });
  assert.equal(w, 1568);
});

test("upscaling never shrinks and downscaling never grows", () => {
  const [upW] = scaledSize(1000, 1000, 1568, { upscale: true });
  assert.ok(upW >= 1000);
  const [downW] = scaledSize(4000, 4000, 1568, { upscale: true });
  assert.ok(downW <= 1568, "the cap still wins over the upscale flag");
});

test("degenerate sizes do not produce a zero-dimension canvas", () => {
  assert.deepEqual(scaledSize(0, 0, 1568, { upscale: true }), [1, 1]);
  const [w, h] = scaledSize(1, 10000, 1568);
  assert.ok(w >= 1 && h >= 1);
});
