import assert from "node:assert/strict";
import { test } from "node:test";
import { COCO_TO_LM, cocoToLandmarks } from "./coco33.ts";
import type { SimccPoint } from "./simcc-decode.ts";
import { LM, POSE_LANDMARK_COUNT } from "../types.ts";
import { headPoint, personBox, personConfidence } from "../kinematics.ts";

const IMG_W = 1920;
const IMG_H = 1080;

// A plausible standing figure in pixel space, all 17 keypoints confident.
function standingFigure(score = 0.95): SimccPoint[] {
  const cx = 960;
  const pts: [number, number][] = [
    [cx, 200], // nose
    [cx - 15, 190], // left eye
    [cx + 15, 190], // right eye
    [cx - 35, 200], // left ear
    [cx + 35, 200], // right ear
    [cx - 90, 320], // left shoulder
    [cx + 90, 320], // right shoulder
    [cx - 110, 460], // left elbow
    [cx + 110, 460], // right elbow
    [cx - 120, 590], // left wrist
    [cx + 120, 590], // right wrist
    [cx - 60, 600], // left hip
    [cx + 60, 600], // right hip
    [cx - 65, 780], // left knee
    [cx + 65, 780], // right knee
    [cx - 70, 950], // left ankle
    [cx + 70, 950], // right ankle
  ];
  return pts.map(([x, y]) => ({ x, y, score }));
}

test("mapping table places every coco keypoint in its slot", () => {
  assert.equal(COCO_TO_LM.length, 17);
  const points = standingFigure();
  const out = cocoToLandmarks(points, IMG_W, IMG_H);
  assert.equal(out.length, POSE_LANDMARK_COUNT);
  for (let k = 0; k < 17; k++) {
    const lm = out[COCO_TO_LM[k]];
    assert.ok(Math.abs(lm.x * IMG_W - points[k].x) < 1e-6, `coco ${k} x`);
    assert.ok(Math.abs(lm.y * IMG_H - points[k].y) < 1e-6, `coco ${k} y`);
    assert.equal(lm.v, 0.95);
    assert.equal(lm.z, 0);
  }
  assert.equal(out[LM.nose].y * IMG_H, 200);
  assert.equal(out[LM.leftAnkle].y * IMG_H, 950);
  assert.equal(out[LM.leftWrist].x * IMG_W, 960 - 120);
});

test("unmapped slots stay v=0", () => {
  const out = cocoToLandmarks(standingFigure(), IMG_W, IMG_H);
  const mapped = new Set(COCO_TO_LM);
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    if (mapped.has(i)) continue;
    assert.equal(out[i].v, 0, `slot ${i}`);
    assert.equal(out[i].x, 0);
    assert.equal(out[i].y, 0);
  }
  // heels and mouth in particular: consumers fall back to ankles/ears.
  assert.equal(out[LM.leftHeel].v, 0);
  assert.equal(out[LM.rightHeel].v, 0);
});

test("scores clamp to 0..1 and non-positive scores drop the point", () => {
  const points = standingFigure();
  points[0] = { ...points[0], score: 1.2 };
  points[3] = { ...points[3], score: -0.4 };
  const out = cocoToLandmarks(points, IMG_W, IMG_H);
  assert.equal(out[LM.nose].v, 1);
  assert.equal(out[LM.leftEar].v, 0);
  assert.equal(out[LM.leftEar].x, 0);
});

test("adapter output flows through the kinematics gates", () => {
  const pts = cocoToLandmarks(standingFigure(), IMG_W, IMG_H);
  // personConfidence reads shoulders+hips, all mapped and confident.
  assert.ok(personConfidence(pts) >= 0.9);
  const head = headPoint(pts);
  assert.ok(head);
  assert.ok(Math.abs(head.y * IMG_H - 200) < 1);
  const box = personBox(pts);
  assert.ok(box);
  assert.ok(box.height > 0.5, "full body spans most of the frame height");
});

test("low-visibility figure fails the confidence gate", () => {
  const pts = cocoToLandmarks(standingFigure(0.3), IMG_W, IMG_H);
  assert.ok(personConfidence(pts) < 0.9);
});
