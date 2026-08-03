import test from "node:test";
import assert from "node:assert/strict";
import {
  BLANK_ABORT_RUN,
  BLANK_FLOOR_MIN_FRAMES,
  BLANK_MEDIAN_BYTES,
  base64Bytes,
  blankFilterVerdict,
  blankSetByBytes,
  isBlankStats,
  lumaStats,
} from "./frame-guard.ts";

// Build an RGBA buffer from a list of [r,g,b] pixels.
function rgba(pixels: [number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  });
  return out;
}

function fill(n: number, px: [number, number, number]): [number, number, number][] {
  return Array.from({ length: n }, () => px);
}

test("a solid black frame is blank", () => {
  const stats = lumaStats(rgba(fill(100, [0, 0, 0])), 1);
  assert.equal(stats.mean, 0);
  assert.equal(stats.spread, 0);
  assert.equal(isBlankStats(stats), true);
});

test("a solid GREEN frame is blank: broken Android decodes are uniform, not dark", () => {
  const stats = lumaStats(rgba(fill(100, [0, 128, 0])), 1);
  assert.ok(stats.mean > 50, "bright, so a luma-only gate would pass it");
  assert.equal(isBlankStats(stats), true);
});

test("a solid mid-gray frame is blank", () => {
  assert.equal(isBlankStats(lumaStats(rgba(fill(100, [128, 128, 128])), 1)), true);
});

test("dark gym footage with a few lights is NOT blank", () => {
  // 95 near-black pixels plus a handful of bright ceiling lights: exactly the
  // legitimate footage a naive threshold would swallow.
  const pixels = [...fill(95, [9, 8, 11] as [number, number, number]), ...fill(5, [230, 228, 210] as [number, number, number])];
  const stats = lumaStats(rgba(pixels), 1);
  assert.equal(isBlankStats(stats), false);
});

test("one bright pixel is enough to clear the blank bar", () => {
  const pixels = [...fill(99, [0, 0, 0] as [number, number, number]), [255, 255, 255] as [number, number, number]];
  assert.equal(isBlankStats(lumaStats(rgba(pixels), 1)), false);
});

test("sensor noise on black stays blank; real texture does not", () => {
  // ±3 noise around black: spread 6, still blank.
  const noisy = Array.from({ length: 100 }, (_, i) => {
    const v = 3 + ((i * 7) % 4) - 2;
    return [v, v, v] as [number, number, number];
  });
  assert.equal(isBlankStats(lumaStats(rgba(noisy), 1)), true);
  // A modest gradient (0..40) is texture, not blankness.
  const gradient = Array.from({ length: 100 }, (_, i) => {
    const v = Math.round((i / 99) * 40);
    return [v, v, v] as [number, number, number];
  });
  assert.equal(isBlankStats(lumaStats(rgba(gradient), 1)), false);
});

test("stride sampling still sees the buffer, and an empty buffer is not a crash", () => {
  const stats = lumaStats(rgba(fill(64, [0, 200, 0])), 4);
  assert.equal(isBlankStats(stats), true);
  assert.deepEqual(lumaStats(new Uint8ClampedArray(0), 4), { mean: 0, spread: 0 });
});

test("blank filter verdicts: untouched, filtered, failed", () => {
  assert.equal(blankFilterVerdict(40, 0), "keep-all");
  assert.equal(blankFilterVerdict(40, 5), "drop-blanks");
  assert.equal(blankFilterVerdict(40, 38), "drop-blanks", "2 survivors is the route's minimum, still sendable");
  assert.equal(blankFilterVerdict(40, 39), "fail-pass", "1 survivor is not a sequence");
  assert.equal(blankFilterVerdict(40, 40), "fail-pass");
  assert.equal(blankFilterVerdict(0, 0), "fail-pass");
});

test("the abort run is long enough that no real rep trips it", () => {
  // Pinned: eight consecutive genuinely-uniform frames do not occur in real
  // footage; lowering this risks aborting legitimate extractions.
  assert.ok(BLANK_ABORT_RUN >= 8);
});

test("server byte floor: the incident's sizes fail, healthy sizes pass", () => {
  // Calibration from prod (2026-08-03): black frames 4307-11005 bytes,
  // healthy frames 14327-65010 with median 26583.
  const black = Array.from({ length: 61 }, (_, i) => (i === 10 ? 11_005 : 4_307));
  const healthy = Array.from({ length: 64 }, (_, i) => 14_327 + i * 790);
  assert.equal(blankSetByBytes(black), true);
  assert.equal(blankSetByBytes(healthy), false);
});

test("server byte floor never judges small sets", () => {
  const tiny = Array.from({ length: BLANK_FLOOR_MIN_FRAMES - 1 }, () => 100);
  assert.equal(blankSetByBytes(tiny), false, "below the frame minimum, no verdict");
  assert.equal(blankSetByBytes([]), false);
});

test("server byte floor judges the median, so a few small frames cannot trip it", () => {
  // Half tiny, half healthy: median sits between, above the floor.
  const mixed = [
    ...Array.from({ length: 10 }, () => 3_000),
    ...Array.from({ length: 11 }, () => 20_000),
  ];
  assert.equal(blankSetByBytes(mixed), false);
});

test("base64 length converts to approximate bytes", () => {
  assert.equal(base64Bytes(8_000), 6_000);
  assert.ok(base64Bytes(8_001) >= BLANK_MEDIAN_BYTES);
});
