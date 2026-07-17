// Pure decode for the pose model's SimCC output. Two layers over the same
// buffers: `decodeSimccArgmax` is the plain-argmax reference (score as the mean
// of the two axis maxima, sub-pixel via the split ratio) pinned byte-for-byte
// to the Python rtmlib fixtures; `decodeSimcc` refines the position with a
// windowed soft-argmax (weighted centroid around the peak) while keeping the
// exact same score and sentinel. Runtime uses `decodeSimcc`.

import { POSE_INPUT_H, POSE_INPUT_W, cropToFrame, type CropRect } from "./topdown.ts";

export const SIMCC_SPLIT_RATIO = 2.0;
export const COCO_KEYPOINT_COUNT = 17;
// Half-width of the soft-argmax window around the argmax bin. ±2 bins bounds
// the centroid's departure from argmax to sub-pixel, so a value head with
// slightly-negative tails (measured range dips to about -0.74) cannot drag the
// estimate off the true peak.
const WINDOW_RADIUS = 2;

export type SimccPoint = {
  x: number; // source-image pixels
  y: number;
  score: number;
};

// Argmax bin and its value over one flat classification row [off, off+w).
function axisArgmax(
  simcc: Float32Array | number[],
  off: number,
  w: number,
): { loc: number; max: number } {
  let loc = 0;
  let max = -Infinity;
  for (let i = 0; i < w; i++) {
    const v = simcc[off + i];
    if (v > max) {
      max = v;
      loc = i;
    }
  }
  return { loc, max };
}

// Sub-bin location: normalized weighted centroid over ±WINDOW_RADIUS bins about
// the argmax, weighting by the value clamped at zero. The SimCC head emits
// values (not logits), so this is a plain window-sum normalization, never a
// softmax; a degenerate all-zero window falls back to the argmax bin.
function axisCentroid(
  simcc: Float32Array | number[],
  off: number,
  w: number,
  loc: number,
): number {
  let num = 0;
  let den = 0;
  const lo = Math.max(0, loc - WINDOW_RADIUS);
  const hi = Math.min(w - 1, loc + WINDOW_RADIUS);
  for (let i = lo; i <= hi; i++) {
    const wgt = Math.max(0, simcc[off + i]);
    num += i * wgt;
    den += wgt;
  }
  return den > 0 ? num / den : loc;
}

// simccX: flat (K, Wx), simccY: flat (K, Wy). Returns keypoints mapped back
// to source-image pixel space through the crop rect. Plain argmax reference.
export function decodeSimccArgmax(
  simccX: Float32Array | number[],
  simccY: Float32Array | number[],
  crop: CropRect,
  keypointCount = COCO_KEYPOINT_COUNT,
): SimccPoint[] {
  const wx = Math.floor(simccX.length / keypointCount);
  const wy = Math.floor(simccY.length / keypointCount);
  const points: SimccPoint[] = [];
  for (let k = 0; k < keypointCount; k++) {
    const x = axisArgmax(simccX, k * wx, wx);
    const y = axisArgmax(simccY, k * wy, wy);
    const score = 0.5 * (x.max + y.max);
    if (score <= 0) {
      points.push({ ...sentinel(crop), score });
      continue;
    }
    const mapped = cropToFrame(x.loc / SIMCC_SPLIT_RATIO, y.loc / SIMCC_SPLIT_RATIO, crop);
    points.push({ x: mapped.x, y: mapped.y, score });
  }
  return points;
}

// Windowed soft-argmax: same score and sentinel as the argmax reference, but
// the coordinate is a sub-pixel centroid around the peak. Used at runtime.
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
    const xOff = k * wx;
    const yOff = k * wy;
    const x = axisArgmax(simccX, xOff, wx);
    const y = axisArgmax(simccY, yOff, wy);
    const score = 0.5 * (x.max + y.max);
    if (score <= 0) {
      points.push({ ...sentinel(crop), score });
      continue;
    }
    const xBin = axisCentroid(simccX, xOff, wx, x.loc);
    const yBin = axisCentroid(simccY, yOff, wy, y.loc);
    const mapped = cropToFrame(xBin / SIMCC_SPLIT_RATIO, yBin / SIMCC_SPLIT_RATIO, crop);
    points.push({ x: mapped.x, y: mapped.y, score });
  }
  return points;
}

// Reference marks unusable keypoints with loc -1; downstream consumers gate on
// score, so pin coords to the same sentinel post-mapping.
function sentinel(crop: CropRect): { x: number; y: number } {
  return cropToFrame(-1 / SIMCC_SPLIT_RATIO, -1 / SIMCC_SPLIT_RATIO, crop);
}

export { POSE_INPUT_W, POSE_INPUT_H };
