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

// Crops keep the subject's own proportions rather than being squared up.
//
// Squaring was the original behaviour and it was the single biggest cause of
// wrong-person poses. An upright player's box is roughly 0.3 as wide as it is
// tall, so squaring to the longer side multiplied the horizontal field of view
// by about three BEFORE padding multiplied it again: the athlete ended up
// occupying a fifth of the crop's width, with a team-mate standing fully
// visible beside them. A single-subject pose model handed that image has no
// reason to prefer the middle one.
//
// The aspect is still clamped, because a very thin crop is letterboxed to the
// model's square input and wastes most of it. These bounds keep enough width
// for arms and a landing stance without reaching the next player over.
export const MIN_CROP_ASPECT = 0.55;
export const MAX_CROP_ASPECT = 1.8;

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

  // Pad each side in proportion to that side, so the subject keeps its shape.
  let w = box.w * (1 + padding * 2);
  let h = box.h * (1 + padding * 2);

  // Then widen or heighten only as far as the aspect bounds require.
  const aspect = w / h;
  if (aspect < MIN_CROP_ASPECT) w = h * MIN_CROP_ASPECT;
  else if (aspect > MAX_CROP_ASPECT) h = w / MAX_CROP_ASPECT;

  const left = clamp01(cx - w / 2);
  const top = clamp01(cy - h / 2);
  const right = clamp01(cx + w / 2);
  const bottom = clamp01(cy + h / 2);
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

// How far a tap may sit from a body's centre, in multiples of that body's own
// size, before it stops counting as a tap ON that body. Roughly one body-length
// away: past that the user was pointing at something else, or at a player the
// detector missed.
export const MAX_TAP_DISTANCE = 1.2;

// Picks the box nearest a tap. Distance is measured to the box centre and
// normalized by the box's own size, so a tap anywhere on a large player counts
// as close while the same absolute distance from a small one does not.
//
// Returns null when nothing is near enough. Without that bound this function
// always returned SOMETHING, which made every abstain path downstream
// unreachable: with a tap and any box anywhere in frame, the pipeline could not
// decline, and would happily analyse a player on the next court.
export function boxNearestPoint(
  boxes: Box[],
  point: { x: number; y: number },
  maxDistance = MAX_TAP_DISTANCE,
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
  if (best < 0 || bestDistance > maxDistance) return null;
  return { index: best, distance: bestDistance };
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
