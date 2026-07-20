// Two-stage crop geometry (D-032).

import assert from "node:assert/strict";
import test from "node:test";

import {
  type Box,
  boxNearestPoint,
  containsPoint,
  cropForBox,
  dedupeBoxes,
  fromCrop,
  intersectionOverUnion,
  usableBoxes,
} from "./two-stage.ts";

const box = (x: number, y: number, w: number, h: number, score = 0.9): Box => ({
  x,
  y,
  w,
  h,
  score,
});

test("a crop is squared and padded around the body", () => {
  const c = cropForBox(box(0.4, 0.3, 0.1, 0.3), 0.35);
  // Taller than wide, so the square takes the height, and padding widens both.
  assert.ok(Math.abs(c.w - c.h) < 1e-9, "crop should be square");
  assert.ok(c.w > 0.3, "padding must add context around the body");
  const cx = c.x + c.w / 2;
  assert.ok(Math.abs(cx - 0.45) < 1e-9, "crop stays centred on the body");
});

test("a crop at the frame edge is clamped rather than running outside", () => {
  const c = cropForBox(box(0.0, 0.0, 0.1, 0.2));
  assert.ok(c.x >= 0 && c.y >= 0);
  assert.ok(c.x + c.w <= 1 + 1e-9);
  assert.ok(c.y + c.h <= 1 + 1e-9);
});

test("overlapping boxes for one body collapse to the strongest", () => {
  const kept = dedupeBoxes([
    box(0.4, 0.4, 0.1, 0.25, 0.7),
    box(0.41, 0.41, 0.1, 0.25, 0.95),
    box(0.8, 0.4, 0.1, 0.25, 0.8),
  ]);
  assert.equal(kept.length, 2, "the duplicate pair must collapse");
  assert.ok(Math.abs(kept[0].score - 0.95) < 1e-9, "the strongest survives");
});

test("distinct people are not merged", () => {
  const kept = dedupeBoxes([box(0.1, 0.4, 0.08, 0.2), box(0.7, 0.4, 0.08, 0.2)]);
  assert.equal(kept.length, 2);
});

test("weak and tiny detections are dropped", () => {
  const usable = usableBoxes([
    box(0.4, 0.4, 0.08, 0.2, 0.95),
    box(0.1, 0.4, 0.08, 0.2, 0.05),
    box(0.7, 0.48, 0.01, 0.02, 0.99),
  ]);
  assert.equal(usable.length, 1, "low score and sub-minimum height both excluded");
});

test("iou is symmetric and bounded", () => {
  const a = box(0.1, 0.1, 0.2, 0.2);
  const b = box(0.2, 0.2, 0.2, 0.2);
  const iou = intersectionOverUnion(a, b);
  assert.ok(Math.abs(iou - intersectionOverUnion(b, a)) < 1e-9);
  assert.ok(iou > 0 && iou < 1);
  assert.equal(intersectionOverUnion(a, a), 1);
  assert.equal(intersectionOverUnion(a, box(0.8, 0.8, 0.1, 0.1)), 0);
});

test("crop-local coordinates map back to the full frame", () => {
  const crop = box(0.25, 0.5, 0.5, 0.25);
  const p = fromCrop({ x: 0.5, y: 0.5 }, crop);
  assert.ok(Math.abs(p.x - 0.5) < 1e-9);
  assert.ok(Math.abs(p.y - 0.625) < 1e-9);
  const origin = fromCrop({ x: 0, y: 0 }, crop);
  assert.ok(Math.abs(origin.x - 0.25) < 1e-9);
});

test("a tap picks the box it lands on, scaled by body size", () => {
  const boxes = [box(0.1, 0.4, 0.08, 0.2), box(0.6, 0.4, 0.08, 0.2)];
  const pick = boxNearestPoint(boxes, { x: 0.64, y: 0.5 });
  assert.ok(pick);
  assert.equal(pick.index, 1);
});

test("a tap far from every body still reports its distance for rejection", () => {
  const pick = boxNearestPoint([box(0.1, 0.1, 0.05, 0.1)], { x: 0.9, y: 0.9 });
  assert.ok(pick);
  assert.ok(pick.distance > 5, "distance is body-relative, so this is very far");
});

test("containment answers whether a pose landed in its own crop", () => {
  const b = box(0.4, 0.4, 0.2, 0.2);
  assert.equal(containsPoint(b, { x: 0.5, y: 0.5 }), true);
  assert.equal(containsPoint(b, { x: 0.65, y: 0.5 }), false);
});

test("no boxes yields no pick rather than a fabricated one", () => {
  assert.equal(boxNearestPoint([], { x: 0.5, y: 0.5 }), null);
  assert.deepEqual(usableBoxes([]), []);
});
