export const ALPHA = 0.35;

export function updateRating(prev: number | null, score: number): number {
  if (prev == null) return score;
  return Math.round((prev + ALPHA * (score - prev)) * 10) / 10;
}

export function overallScore(ratings: (number | null)[]): number | null {
  const rated = ratings.filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((a, b) => a + b, 0) / rated.length);
}
