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

export function overallScore(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length);
}

export type ScoreBand = "Developing" | "Solid" | "Advanced" | "Elite";

/**
 * Where each band starts. THE CAPTION IS GENERATED FROM THESE, and that is the
 * point of exporting them.
 *
 * Every surface that showed a score also printed "40 developing / 70 solid /
 * 90 advanced" beside it, and those are the RUBRIC's anchors: the numbers the
 * model is told a developing or a solid rep looks like. They are not these
 * bands. So a player scoring 56 was labelled Solid by a caption claiming solid
 * begins at 70, and a player scoring 85 was labelled Advanced beside a caption
 * putting advanced at 90. The label and the scale printed under it disagreed
 * on both edges.
 *
 * One array now feeds both the naming and the caption, so they cannot drift
 * again.
 */
export const SCORE_BANDS: { readonly floor: number; readonly name: ScoreBand }[] = [
  { floor: 0, name: "Developing" },
  { floor: 55, name: "Solid" },
  { floor: 80, name: "Advanced" },
  { floor: 92, name: "Elite" },
];

// These bands give the number its coach-honest name wherever a score renders,
// so a 62 reads as real progress against an elite standard instead of a bad grade.
export function scoreBand(score: number): ScoreBand {
  let name: ScoreBand = SCORE_BANDS[0].name;
  for (const band of SCORE_BANDS) if (score >= band.floor) name = band.name;
  return name;
}

/**
 * The scale, spelled the way the bands actually work: where each named band
 * BEGINS. Rendered wherever a score appears with its band name.
 */
export function scoreScaleCaption(): string {
  return SCORE_BANDS.filter((b) => b.floor > 0)
    .map((b) => `${b.floor} ${b.name.toLowerCase()}`)
    .join(" · ");
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
