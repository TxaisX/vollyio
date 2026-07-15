// Adapter from the pose model's 17-keypoint output to the 33-slot landmark
// layout the rest of the pipeline consumes. Slots with no source keypoint
// stay at v=0, which every downstream consumer already gates on; z is not
// produced by this model and stays 0.

import { POSE_LANDMARK_COUNT, type Landmark } from "../types.ts";
import type { SimccPoint } from "./simcc-decode.ts";

// coco index -> 33-slot landmark index.
export const COCO_TO_LM: readonly number[] = [
  0, // nose
  2, // left eye
  5, // right eye
  7, // left ear
  8, // right ear
  11, // left shoulder
  12, // right shoulder
  13, // left elbow
  14, // right elbow
  15, // left wrist
  16, // right wrist
  23, // left hip
  24, // right hip
  25, // left knee
  26, // right knee
  27, // left ankle
  28, // right ankle
];

const EMPTY: Landmark = { x: 0, y: 0, z: 0, v: 0 };

export function cocoToLandmarks(points: SimccPoint[], imgW: number, imgH: number): Landmark[] {
  const pts: Landmark[] = new Array(POSE_LANDMARK_COUNT);
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) pts[i] = EMPTY;
  for (let k = 0; k < COCO_TO_LM.length && k < points.length; k++) {
    const p = points[k];
    const v = Math.min(1, Math.max(0, p.score));
    if (v <= 0) continue;
    pts[COCO_TO_LM[k]] = {
      x: p.x / imgW,
      y: p.y / imgH,
      z: 0,
      v,
    };
  }
  return pts;
}
