// Pure geometry for the top-down pose stage: detector box -> padded,
// aspect-locked crop rect, and the inverse mapping from crop coordinates
// back to source-image pixels. The reference builds a general affine warp,
// but with rotation fixed at 0 it reduces to this rect mapping; fixture
// tests pin the equivalence.

import type { DetBox } from "./yolox-decode.ts";

// Pose model input, width x height.
export const POSE_INPUT_W = 192;
export const POSE_INPUT_H = 256;
// Box padding factor from the reference preprocess.
export const BOX_PADDING = 1.25;

// Normalization constants applied per channel in B,G,R plane order. The
// validated reference feeds BGR frames and applies these values in this
// order; matching it exactly matters more than the constants' provenance.
export const POSE_MEAN = [123.675, 116.28, 103.53] as const;
export const POSE_STD = [58.395, 57.12, 57.375] as const;

// Padded, aspect-locked crop in source pixel space, centered on the box.
export type CropRect = {
  cx: number;
  cy: number;
  w: number;
  h: number;
};

export function boxToCrop(box: Pick<DetBox, "x1" | "y1" | "x2" | "y2">): CropRect {
  const cx = (box.x1 + box.x2) * 0.5;
  const cy = (box.y1 + box.y2) * 0.5;
  let w = (box.x2 - box.x1) * BOX_PADDING;
  let h = (box.y2 - box.y1) * BOX_PADDING;
  const aspect = POSE_INPUT_W / POSE_INPUT_H;
  if (w > h * aspect) {
    h = w / aspect;
  } else {
    w = h * aspect;
  }
  return { cx, cy, w, h };
}

// Crop-space pixel (in the POSE_INPUT_W x POSE_INPUT_H frame) back to
// source-image pixels.
export function cropToFrame(xCrop: number, yCrop: number, crop: CropRect): { x: number; y: number } {
  return {
    x: (xCrop / POSE_INPUT_W) * crop.w + crop.cx - crop.w / 2,
    y: (yCrop / POSE_INPUT_H) * crop.h + crop.cy - crop.h / 2,
  };
}

// drawImage arguments that reproduce the reference's constant-border crop:
// regions of the crop rect outside the source image stay black instead of
// being stretched (canvas clips out-of-bounds source rects, so the caller
// must pre-fill the destination and draw only the intersection).
export type CropPlacement = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export function cropPlacement(
  crop: CropRect,
  imgW: number,
  imgH: number,
  dstW = POSE_INPUT_W,
  dstH = POSE_INPUT_H,
): CropPlacement | null {
  const left = crop.cx - crop.w / 2;
  const top = crop.cy - crop.h / 2;
  const sx = Math.max(0, left);
  const sy = Math.max(0, top);
  const sw = Math.min(imgW, left + crop.w) - sx;
  const sh = Math.min(imgH, top + crop.h) - sy;
  if (sw <= 0 || sh <= 0) return null;
  const scaleX = dstW / crop.w;
  const scaleY = dstH / crop.h;
  return {
    sx,
    sy,
    sw,
    sh,
    dx: (sx - left) * scaleX,
    dy: (sy - top) * scaleY,
    dw: sw * scaleX,
    dh: sh * scaleY,
  };
}
