// The product score scale (D-034).

import assert from "node:assert/strict";
import test from "node:test";

import { toProductScale } from "./score-scale.ts";

test("the scale is monotonic: a better rep never displays lower", () => {
  let prev = -1;
  for (let raw = 0; raw <= 100; raw++) {
    const v = toProductScale(raw);
    assert.ok(v >= prev, `raw ${raw} -> ${v} dropped below ${prev}`);
    prev = v;
  }
});

test("the anchors hold: recreational mid-band lifts, elite end stays pinned", () => {
  assert.equal(toProductScale(0), 0);
  assert.equal(toProductScale(100), 100);
  // The owner-labeled rep: judged ~50 raw on grass, product shows mid-60s.
  assert.equal(toProductScale(50), 66);
  // A broken rep still reads as needing work, not as passing.
  assert.ok(toProductScale(30) <= 42);
  // Elite reps gain almost nothing, so the top of the scale stays honest.
  assert.ok(toProductScale(90) - 90 <= 2);
});

test("out-of-range and non-finite input cannot produce a fabricated score", () => {
  assert.equal(toProductScale(-5), 0);
  assert.equal(toProductScale(140), 100);
  assert.equal(toProductScale(Number.NaN), 0);
});
