export const ALPHA = 0.35;

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
  return Math.round((prev + ALPHA * w * (score - prev)) * 10) / 10;
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
