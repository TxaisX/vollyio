// Subject selection under a saturated confidence signal (D-032).
//
// The case that motivated this is the first test: two people in one crop, the
// tapped athlete centred and a bystander clipped at the edge, both reported by
// the engine at ~0.95 confidence. The old behaviour drew the bystander.

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_HINT_DISTANCE,
  hintToLocal,
  pickSubject,
  torsoCenter,
  touchesEdge,
} from "./subject-select.ts";
import { LM, POSE_LANDMARK_COUNT, type Landmark } from "./types.ts";

// A body whose torso sits at (cx, cy). Confidence is deliberately high on every
// landmark, because that is what the real engine reports for everyone.
function personAt(cx: number, cy: number, v = 0.95, halfW = 0.06, halfH = 0.12): Landmark[] {
  const pts: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: cx,
    y: cy,
    z: 0,
    v,
  }));
  pts[LM.leftShoulder] = { x: cx - halfW, y: cy - halfH, z: 0, v };
  pts[LM.rightShoulder] = { x: cx + halfW, y: cy - halfH, z: 0, v };
  pts[LM.leftHip] = { x: cx - halfW, y: cy + halfH, z: 0, v };
  pts[LM.rightHip] = { x: cx + halfW, y: cy + halfH, z: 0, v };
  return pts;
}

test("the tapped athlete wins over a clipped bystander at equal confidence", () => {
  const tapped = personAt(0.5, 0.5);
  const bystander = personAt(0.97, 0.5);
  const choice = pickSubject([bystander, tapped], { x: 0.5, y: 0.5 });
  assert.equal(choice.reason, "picked");
  assert.equal(choice.index, 1, "must pick the centred athlete, not the edge detection");
});

test("a lone detection far from the tap is rejected rather than accepted", () => {
  const choice = pickSubject([personAt(0.1, 0.1)], { x: 0.8, y: 0.8 });
  assert.equal(choice.index, null);
  assert.equal(choice.reason, "too-far-from-tap");
});

test("a lone detection clipped at the crop edge is rejected", () => {
  const choice = pickSubject([personAt(0.5, 0.98)], { x: 0.5, y: 0.95 });
  assert.equal(choice.index, null);
  assert.equal(choice.reason, "clipped-at-edge");
});

test("no detections and no torso are reported distinctly", () => {
  assert.equal(pickSubject([], { x: 0.5, y: 0.5 }).reason, "no-candidates");
  const torsoless: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    v: 0,
  }));
  assert.equal(pickSubject([torsoless], { x: 0.5, y: 0.5 }).reason, "no-torso");
});

test("without a hint the most central body is chosen", () => {
  const edge = personAt(0.2, 0.5);
  const middle = personAt(0.52, 0.5);
  const choice = pickSubject([edge, middle], null);
  assert.equal(choice.index, 1);
});

test("the distance bar is honoured exactly", () => {
  const justInside = pickSubject(
    [personAt(0.5 + MAX_HINT_DISTANCE - 0.01, 0.5)],
    { x: 0.5, y: 0.5 },
  );
  assert.equal(justInside.reason, "picked");
  const justOutside = pickSubject(
    [personAt(0.5 + MAX_HINT_DISTANCE + 0.01, 0.5)],
    { x: 0.5, y: 0.5 },
  );
  assert.equal(justOutside.reason, "too-far-from-tap");
});

test("a raised arm past the crop edge does not count as clipped", () => {
  // A spiking athlete's wrist leaves the crop while the torso stays inside.
  const spiker = personAt(0.5, 0.55);
  spiker[LM.leftWrist] = { x: 0.5, y: 0.0, z: 0, v: 0.95 };
  spiker[LM.rightWrist] = { x: 0.52, y: -0.02, z: 0, v: 0.95 };
  assert.equal(touchesEdge(spiker), false, "arms above frame must not reject the subject");
  assert.equal(pickSubject([spiker], { x: 0.5, y: 0.55 }).reason, "picked");
});

test("torso centre sits between the shoulders and hips", () => {
  const c = torsoCenter(personAt(0.4, 0.6));
  assert.ok(c);
  assert.ok(Math.abs(c.x - 0.4) < 1e-9);
  assert.ok(Math.abs(c.y - 0.6) < 1e-9);
});

test("a hint maps from full frame into crop space", () => {
  const local = hintToLocal(
    { x: 0.5, y: 0.5 },
    { left: 0.4, top: 0.4, width: 0.2, height: 0.2 },
  );
  assert.ok(local);
  assert.ok(Math.abs(local.x - 0.5) < 1e-9);
  assert.ok(Math.abs(local.y - 0.5) < 1e-9);

  const offset = hintToLocal(
    { x: 0.45, y: 0.5 },
    { left: 0.4, top: 0.4, width: 0.2, height: 0.2 },
  );
  assert.ok(offset);
  assert.ok(Math.abs(offset.x - 0.25) < 1e-9);

  assert.equal(hintToLocal({ x: 0.5, y: 0.5 }, { left: 0, top: 0, width: 0, height: 1 }), null);
});
