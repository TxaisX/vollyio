// Pure decode for the pose model's SimCC output: per-keypoint argmax over
// the x and y classification axes, sub-pixel coords via the split ratio,
// score as the mean of the two axis maxima. Mirrors the reference decode;
// fixture tests pin the parity.

import { POSE_INPUT_H, POSE_INPUT_W, cropToFrame, type CropRect } from "./topdown.ts";

export const SIMCC_SPLIT_RATIO = 2.0;
export const COCO_KEYPOINT_COUNT = 17;

export type SimccPoint = {
  x: number; // source-image pixels
  y: number;
  score: number;
};

// simccX: flat (K, Wx), simccY: flat (K, Wy). Returns keypoints mapped back
// to source-image pixel space through the crop rect.
export function decodeSimcc(
  simccX: Float32Array | number[],
  simccY: Float32Array | number[],
  crop: CropRect,
  keypointCount = COCO_KEYPOINT_COUNT,
): SimccPoint[] {
  const wx = Math.floor(simccX.length / keypointCount);
  const wy = Math.floor(simccY.length / keypointCount);
  const points: SimccPoint[] = [];
  for (let k = 0; k < keypointCount; k++) {
    let xLoc = 0;
    let xMax = -Infinity;
    const xOff = k * wx;
    for (let i = 0; i < wx; i++) {
      const v = simccX[xOff + i];
      if (v > xMax) {
        xMax = v;
        xLoc = i;
      }
    }
    let yLoc = 0;
    let yMax = -Infinity;
    const yOff = k * wy;
    for (let i = 0; i < wy; i++) {
      const v = simccY[yOff + i];
      if (v > yMax) {
        yMax = v;
        yLoc = i;
      }
    }
    const score = 0.5 * (xMax + yMax);
    if (score <= 0) {
      // Reference marks unusable keypoints with loc -1; downstream consumers
      // gate on score, so pin coords to the same sentinel post-mapping.
      const sentinel = cropToFrame(
        -1 / SIMCC_SPLIT_RATIO,
        -1 / SIMCC_SPLIT_RATIO,
        crop,
      );
      points.push({ x: sentinel.x, y: sentinel.y, score });
      continue;
    }
    const mapped = cropToFrame(xLoc / SIMCC_SPLIT_RATIO, yLoc / SIMCC_SPLIT_RATIO, crop);
    points.push({ x: mapped.x, y: mapped.y, score });
  }
  return points;
}

export { POSE_INPUT_W, POSE_INPUT_H };
