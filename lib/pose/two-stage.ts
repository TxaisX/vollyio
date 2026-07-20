// Two-stage detection geometry: person boxes in, pose crops out (D-032).
//
// Pure and DOM-free so the box maths is testable without a browser or a model.
//
// Why the stage exists at all. MediaPipe PoseLandmarker is built around a
// single prominent subject. Measured on real court footage it returns ONE pose
// from a crop containing several people, and not reliably the intended one — so
// tap-to-select has nothing to choose between and the wrong athlete gets drawn
// at 0.95 confidence. The previous engine avoided this by detecting every
// person as a box first and running pose per box. Swapping engines kept the
// pose half and dropped the detection half; this restores it using the
// EfficientDet model already vendored for ball detection, which is COCO-trained
// and so detects `person` too. No new dependency, no new licence exposure.

export type Box = {
  // Normalized to the source frame.
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

// Pose models want context around the body: a box cropped tight to the
// detector's bounds clips shoulders and feet, and a spiking arm leaves frame
// entirely. Padding is proportional so it scales with the subject.
export const CROP_PADDING = 0.35;
// Pose input is square-ish; a very wide or tall crop wastes the model's
// resolution on background, so crops are squared up before padding.
export const MIN_BOX_SCORE = 0.3;
// A body smaller than this fraction of the frame's long edge has too few pixels
// for the landmark model to say anything trustworthy about joint positions.
export const MIN_BOX_HEIGHT = 0.06;

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Expands a detector box into the crop the pose model should see: squared to
// the longer side, padded, and clamped to the frame. Clamping can push the crop
// off-centre at a frame edge, which is correct — a partial body is better than
// a crop containing mostly nothing.
export function cropForBox(box: Box, padding = CROP_PADDING): Box {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const side = Math.max(box.w, box.h) * (1 + padding * 2);
  const half = side / 2;
  const left = clamp01(cx - half);
  const top = clamp01(cy - half);
  const right = clamp01(cx + half);
  const bottom = clamp01(cy + half);
  return {
    x: left,
    y: top,
    w: Math.max(1e-6, right - left),
    h: Math.max(1e-6, bottom - top),
    score: box.score,
  };
}

export function boxArea(b: Box): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

export function intersectionOverUnion(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = boxArea(a) + boxArea(b) - inter;
  // Clamped because float error can push an identical pair fractionally past 1,
  // and callers compare against thresholds expecting a true ratio.
  return union > 0 ? clamp01(inter / union) : 0;
}

// The detector emits overlapping boxes for one person often enough that
// un-deduplicated boxes produce duplicate skeletons on the same body.
export function dedupeBoxes(boxes: Box[], iouLimit = 0.55): Box[] {
  const kept: Box[] = [];
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (kept.some((k) => intersectionOverUnion(k, box) > iouLimit)) continue;
    kept.push(box);
  }
  return kept;
}

export function usableBoxes(
  boxes: Box[],
  opts?: { minScore?: number; minHeight?: number; max?: number },
): Box[] {
  const minScore = opts?.minScore ?? MIN_BOX_SCORE;
  const minHeight = opts?.minHeight ?? MIN_BOX_HEIGHT;
  return dedupeBoxes(boxes.filter((b) => b.score >= minScore && b.h >= minHeight))
    .slice(0, opts?.max ?? 8);
}

// Maps a point expressed inside a crop back into full-frame coordinates.
export function fromCrop(
  point: { x: number; y: number },
  crop: Box,
): { x: number; y: number } {
  return { x: crop.x + point.x * crop.w, y: crop.y + point.y * crop.h };
}

// Picks the box nearest a tap. Distance is measured to the box centre and
// normalized by the box's own size, so a tap anywhere on a large player counts
// as close while the same absolute distance from a small one does not.
export function boxNearestPoint(
  boxes: Box[],
  point: { x: number; y: number },
): { index: number; distance: number } | null {
  if (boxes.length === 0) return null;
  let best = -1;
  let bestDistance = Infinity;
  boxes.forEach((b, i) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const scale = Math.max(b.w, b.h, 1e-6);
    const d = Math.hypot(cx - point.x, cy - point.y) / scale;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best >= 0 ? { index: best, distance: bestDistance } : null;
}

// Does a point land inside a box? Used by the evaluation to check that a pose
// produced from a crop actually describes the body that crop was built around,
// which is the failure mode single-stage detection could not detect.
export function containsPoint(box: Box, point: { x: number; y: number }): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.w &&
    point.y >= box.y &&
    point.y <= box.y + box.h
  );
}
