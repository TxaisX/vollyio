// Choosing WHICH detected person is the athlete the player tapped (D-032).
//
// Pure and DOM-free.
//
// Why this exists: the pose engine's own confidence cannot answer this. Measured
// on real footage, it reports 0.87-1.00 for a partially-cut-off bystander at the
// edge of a crop — the same range it reports for a cleanly-seen subject. So a
// wrong-person detection arrives looking exactly as certain as a right one, and
// no visibility threshold can separate them.
//
// The previous two-stage engine detected every person as a box and used the tap
// as a preference signal among them. The current engine returns only one or two
// people from a crop that may contain several, so preference alone is not
// enough: the returned person may simply not be the right one, with nothing
// better on offer. Hence rejection as well as preference.
//
// Geometry is the available signal, and it is a real one:
//   - the crop is built AROUND the tapped player, so the subject should be near
//     its centre, and a detection far from the tap is probably a neighbour
//   - a body clipped by the crop boundary is probably someone the crop caught
//     at its edge rather than the person it was built for
//
// When nothing is plausible this returns null, and the pipeline degrades to no
// measurements. That is the intended outcome: the product's whole position is
// that it does not assert what it cannot support, and a skeleton drawn on the
// wrong athlete is a confident false claim about a real person.

import { LM, type Landmark } from "./types.ts";

// A detection whose torso centre sits further than this from the tap (in the
// same normalized space) is treated as a different person rather than a poor
// reading of the intended one.
export const MAX_HINT_DISTANCE = 0.33;

// How close to the boundary counts as clipped.
export const EDGE_MARGIN = 0.02;

// Torso anchors carry the position of a body far more reliably than limbs,
// which swing. Requires at least one shoulder and one hip to be present.
export function torsoCenter(pts: Landmark[]): { x: number; y: number } | null {
  const anchors = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]
    .map((i) => pts[i])
    .filter((p): p is Landmark => !!p && p.v > 0);
  if (anchors.length < 2) return null;
  const shoulders = [pts[LM.leftShoulder], pts[LM.rightShoulder]].filter(
    (p) => p && p.v > 0,
  );
  const hips = [pts[LM.leftHip], pts[LM.rightHip]].filter((p) => p && p.v > 0);
  if (shoulders.length === 0 || hips.length === 0) return null;
  return {
    x: anchors.reduce((a, p) => a + p.x, 0) / anchors.length,
    y: anchors.reduce((a, p) => a + p.y, 0) / anchors.length,
  };
}

// Bounds over the torso anchors only. Deliberately not over every landmark: an
// arm raised past the top of a crop is normal for a spike and must not read as
// clipped, whereas a torso running off the edge means the body itself is cut.
export function torsoBounds(
  pts: Landmark[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const anchors = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip]
    .map((i) => pts[i])
    .filter((p): p is Landmark => !!p && p.v > 0);
  if (anchors.length < 2) return null;
  return {
    minX: Math.min(...anchors.map((p) => p.x)),
    minY: Math.min(...anchors.map((p) => p.y)),
    maxX: Math.max(...anchors.map((p) => p.x)),
    maxY: Math.max(...anchors.map((p) => p.y)),
  };
}

export function touchesEdge(pts: Landmark[], margin = EDGE_MARGIN): boolean {
  const b = torsoBounds(pts);
  if (!b) return false;
  return b.minX <= margin || b.minY <= margin || b.maxX >= 1 - margin || b.maxY >= 1 - margin;
}

export type SubjectChoice = {
  index: number | null;
  // Why the pipeline ended up with this answer. Surfaced rather than swallowed:
  // "we could not identify your player" is a useful thing to be able to say.
  reason:
    | "picked"
    | "no-candidates"
    | "no-torso"
    | "too-far-from-tap"
    | "clipped-at-edge";
  distance?: number;
};

// Picks the athlete from a set of detections, in whatever normalized space the
// detections and the hint share. Without a hint the most central person wins,
// which is the best available guess when the user has not chosen.
export function pickSubject(
  persons: Landmark[][],
  hint: { x: number; y: number } | null,
  opts?: { maxDistance?: number; edgeMargin?: number },
): SubjectChoice {
  if (persons.length === 0) return { index: null, reason: "no-candidates" };
  const maxDistance = opts?.maxDistance ?? MAX_HINT_DISTANCE;
  const edgeMargin = opts?.edgeMargin ?? EDGE_MARGIN;
  const target = hint ?? { x: 0.5, y: 0.5 };

  const scored = persons
    .map((pts, index) => {
      const center = torsoCenter(pts);
      if (!center) return null;
      return {
        index,
        distance: Math.hypot(center.x - target.x, center.y - target.y),
        clipped: touchesEdge(pts, edgeMargin),
      };
    })
    .filter((c): c is { index: number; distance: number; clipped: boolean } => c !== null);

  if (scored.length === 0) return { index: null, reason: "no-torso" };

  // Prefer an unclipped body; fall back to clipped only if nothing else exists,
  // so a neighbour at the boundary never beats the person actually tapped.
  const unclipped = scored.filter((c) => !c.clipped);
  const pool = unclipped.length > 0 ? unclipped : scored;
  const best = pool.reduce((a, b) => (b.distance < a.distance ? b : a));

  if (best.distance > maxDistance) {
    return { index: null, reason: "too-far-from-tap", distance: best.distance };
  }
  if (best.clipped) {
    return { index: null, reason: "clipped-at-edge", distance: best.distance };
  }
  return { index: best.index, reason: "picked", distance: best.distance };
}

// Converts a full-frame normalized point into the coordinate space of a crop,
// so a hint can be compared against detections that came back crop-relative.
export function hintToLocal(
  hint: { x: number; y: number },
  region: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (!(region.width > 0) || !(region.height > 0)) return null;
  return {
    x: (hint.x - region.left) / region.width,
    y: (hint.y - region.top) / region.height,
  };
}
