import { test } from "node:test";
import assert from "node:assert/strict";
import { captureQuality } from "./capture-quality.ts";
import { standingFrame } from "./test-fixtures.ts";
import { LM, type Landmark } from "./types.ts";

// Scale a standing figure about frame center down to a target body height, to
// simulate an athlete filmed from far away.
function distantSubject(bodyHeight: number): Landmark[] {
  const s = bodyHeight / 0.58;
  return standingFrame(0).pts.map((p) => ({
    ...p,
    x: 0.5 + (p.x - 0.5) * s,
    y: 0.5 + (p.y - 0.57) * s,
  }));
}

test("clean centered full-body player reads ok", () => {
  const q = captureQuality(standingFrame(0).pts, "attack");
  assert.equal(q.level, "ok");
  assert.deepEqual(q.reasons, []);
});

test("distant subject reads low with a distance reason", () => {
  const q = captureQuality(distantSubject(0.18), "attack");
  assert.equal(q.level, "low");
  assert.ok(q.reasons.includes("too_small"), `reasons=${q.reasons}`);
});

test("legs cut off at the frame edge read low with a missing-joints reason", () => {
  const cut = standingFrame(0, {
    [LM.leftKnee]: { y: 0.96 },
    [LM.rightKnee]: { y: 0.96 },
    [LM.leftAnkle]: { y: 1.02 },
    [LM.rightAnkle]: { y: 1.02 },
    [LM.leftHeel]: { y: 1.03 },
    [LM.rightHeel]: { y: 1.03 },
    [LM.leftFootIndex]: { y: 1.03 },
    [LM.rightFootIndex]: { y: 1.03 },
  }).pts;
  const q = captureQuality(cut, "attack");
  assert.equal(q.level, "low");
  assert.ok(
    q.reasons.includes("edge_cut") || q.reasons.includes("low_visibility"),
    `reasons=${q.reasons}`,
  );
});

test("uniformly dim key joints read low visibility, tied to B's gate scale", () => {
  // 0.41 sits just under the visibility where the best-fit, full-reliability
  // checkpoint clears NOISE_FLOOR, so every key joint would be gated out; the
  // box still forms (0.41 >= the 0.4 person-box floor).
  const q = captureQuality(standingFrame(0, {}, 0.41).pts, "attack");
  assert.equal(q.level, "low");
  assert.ok(q.reasons.includes("low_visibility"), `reasons=${q.reasons}`);
});

test("empty landmarks read ok and never throw", () => {
  const q = captureQuality([], "attack");
  assert.equal(q.level, "ok");
  assert.deepEqual(q.reasons, []);
});
