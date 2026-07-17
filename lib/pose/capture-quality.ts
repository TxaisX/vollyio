// Capture-quality gate for the framing card. Pure and DOM-free: from the
// selected player's landmarks it judges whether the shot is clean enough for a
// confident read and returns stable reason codes the framing card maps to copy.
// Codes (not phrases) keep the wording, tone, and accessibility constraints in
// the lint-checked component, matching the track-state.ts pattern of a pure
// module emitting kinds that a label layer renders.
//
// This drives a WARNING, never a block: it only tells the athlete how to get a
// cleaner capture. The reasons agree with the scoring pipeline because they read
// the same key joints (keyJointsForSkill) and the same visibility scale (B's
// confidenceScore / NOISE_FLOOR) that the gate uses downstream.

import type { Skill } from "../skills.ts";
import type { Landmark } from "./types.ts";
import { personBox, visibilityMean } from "./kinematics.ts";
import { confidenceScore, keyJointsForSkill, NOISE_FLOOR } from "./metrics.ts";

export type CaptureQualityReason = "too_small" | "low_visibility" | "edge_cut";

export type CaptureQuality = {
  level: "ok" | "low";
  reasons: CaptureQualityReason[];
};

// The subject should fill a reasonable share of the frame; below this the pose
// model sees too few pixels of them to trust. Judged on the larger box edge, so
// an upright (tall) or side-on/diving (wide) subject is measured by whichever
// extent is bigger.
const MIN_SUBJECT_SIZE = 0.35;

// How close to a frame edge counts as touching it: the same value and idea as
// the track-state edge detector, so "at the edge" means one thing app-wide.
const EDGE_MARGIN = 0.08;

// Visibility below which EVERY key joint would fall under B's NOISE_FLOOR and be
// gated out of scoring, even at perfect detector fit and full reliability. It is
// derived from confidenceScore rather than typed in, so this warning can never
// contradict the scoring gate: if it says the key joints are readable, at least
// the best of them can clear the gate, and if the joints are too dim to score
// they read "low" here too. confidenceScore is monotonic in visibility, so a
// bisection lands the crossover exactly.
function minKeyVisibility(): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (confidenceScore(mid, 1, 1) < NOISE_FLOOR) lo = mid;
    else hi = mid;
  }
  return hi;
}
const MIN_KEY_VISIBILITY = minKeyVisibility();

export function captureQuality(pts: Landmark[], skill: Skill): CaptureQuality {
  const ok: CaptureQuality = { level: "ok", reasons: [] };
  if (!pts || pts.length === 0) return ok;

  // Too little of the body is confidently placed to judge the shot at all;
  // mirror the pipeline's null tolerance rather than crying wolf.
  const box = personBox(pts);
  if (!box) return ok;

  const reasons: CaptureQualityReason[] = [];

  if (Math.max(box.width, box.height) < MIN_SUBJECT_SIZE) {
    reasons.push("too_small");
  }

  // Whole-subject dimness: the key joints as a set are too faint to survive the
  // gate. Partial cutoff (legs/arms at the boundary) is caught geometrically
  // below instead, since a mean stays high when only the lower body drops out.
  const keyVis = visibilityMean({ t: 0, pts }, keyJointsForSkill(skill));
  if (keyVis < MIN_KEY_VISIBILITY) {
    reasons.push("low_visibility");
  }

  const touchesEdge =
    box.left <= EDGE_MARGIN ||
    box.top <= EDGE_MARGIN ||
    box.left + box.width >= 1 - EDGE_MARGIN ||
    box.top + box.height >= 1 - EDGE_MARGIN;
  if (touchesEdge) {
    reasons.push("edge_cut");
  }

  return reasons.length > 0 ? { level: "low", reasons } : ok;
}
