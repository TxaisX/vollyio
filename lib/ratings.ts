import { SCALE_VERSION } from "./ai/pointers.ts";

// Asymmetric on purpose (D-079). Skill does not vanish in a day but it does
// jump when a fix lands, so the estimator trusts upward evidence more: one
// 50-scoring rep under a 75 rating is far more likely fatigue, a bad angle, or
// one ugly toss than lost ability, while a first clean rep after a fix is
// exactly the signal the product exists to reward. At 0.15 down, a single bad
// rep is a nudge (~4 points on a 25-point gap) and eight straight bad reps
// still drag the trend under 60, so sustained decline stays honest. The
// per-rep SCORE is never touched by any of this (D-040): the read stays
// blunt, the rating is the estimate.
export const ALPHA_UP = 0.35;
export const ALPHA_DOWN = 0.15;

// Rolling skill rating. A rep graded on partial coverage moves the rating less
// than one graded on the full checklist, so a few bad-angle clips do not swing
// the trend (D-044-reconcile). coveragePct defaults to 100 (a full read, and the
// behavior every older caller had); the first rating seeds with the score and
// ignores coverage because there is no prior to move toward.
export function updateRating(
  prev: number | null,
  score: number,
  coveragePct = 100,
): number {
  if (prev == null) return score;
  const w = Math.max(0, Math.min(1, coveragePct / 100));
  const alpha = score >= prev ? ALPHA_UP : ALPHA_DOWN;
  return Math.round((prev + alpha * w * (score - prev)) * 10) / 10;
}

// The rating a new analysis leaves behind, scale-aware (D-094). A rating is an
// EWMA of scores, so it is only meaningful while every blended score sits on
// the same scale. When the stored rating was built under a different
// SCALE_VERSION, blending would average two different units, so the rating
// re-seeds from the new score instead. A stored version of null predates
// versioning and means version 1, not "unknown": treating it as unknown would
// re-seed every existing player's rating the day this ships, for no reason.
export function nextRating(
  prev: { rating: number | null; scale_version: number | null } | null,
  score: number,
  coveragePct = 100,
): number {
  if (prev == null || prev.rating == null) return score;
  const prevVersion = prev.scale_version ?? 1;
  if (prevVersion !== SCALE_VERSION) return score;
  return updateRating(prev.rating, score, coveragePct);
}

export function overallScore(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length);
}

export type ScoreBand = "Developing" | "Solid" | "Advanced" | "Elite";

// The rubric anchors every metric at ~40 developing, ~70 solid, ~90 advanced.
// These bands give the number its coach-honest name wherever a score renders,
// so a 62 reads as real progress against an elite standard instead of a bad grade.
export function scoreBand(score: number): ScoreBand {
  if (score < 55) return "Developing";
  if (score < 80) return "Solid";
  if (score < 92) return "Advanced";
  return "Elite";
}

// The model emits overall_score independently of its five metric scores. Keep
// the headline coherent: an overall that strays more than 8 points from the
// metric mean is replaced by the mean, so no rep is flattered or punished by
// an inconsistent top-line number.
export function coherentOverall(overall: number, metricScores: number[]): number {
  if (metricScores.length === 0) return overall;
  const mean = Math.round(
    metricScores.reduce((a, b) => a + b, 0) / metricScores.length,
  );
  return Math.abs(overall - mean) > 8 ? mean : overall;
}
