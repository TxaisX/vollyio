import { SCORE_READ_NOISE_SD } from "./score-precision.ts";
import type { Skill } from "./skills";

/**
 * WHAT THE ARROW BESIDE A SKILL ACTUALLY MEANS.
 *
 * `skill_ratings` holds one row per skill and overwrites it, so "up since last
 * week" is not a question the schema can answer: there is no previous value to
 * compare against and nothing records when the number last moved. Inventing one
 * would be the easiest lie on the dashboard to tell and the hardest for a
 * player to catch.
 *
 * What the data CAN answer is whether the reps filmed in the last seven days
 * came in above or below the rolling rating, and that is the comparison drawn:
 *
 *   up    the week's reps average above the rating, so it is being pulled up
 *   down  the week's reps average below it, so recent form is dragging
 *   flat  inside the margin, or nothing filmed on that skill this week
 *
 * The rating is the asymmetric estimator in lib/ratings.ts and the week is a
 * plain mean, which is exactly why the mean moves first and makes a usable
 * leading signal rather than a lagging restatement of the same number.
 *
 * FLAT COVERS TWO CASES ON PURPOSE. "Level this week" and "no reps this week"
 * both render no arrow, because the product only draws green and red, and an
 * arrow is a claim about direction that neither case supports. Distinguishing
 * them would need a third colour saying nothing a player can act on.
 *
 * THE MARGIN WAS ONE POINT, AND THE NOISE FLOOR IS THREE AND A HALF.
 *
 * The old docblock reasoned "ratings are 0 to 100, so one point is roughly the
 * noise floor of a single contact." The repo's own measurement says otherwise:
 * within-clip read noise sd 3.5 (evals/CALIBRATION.md, and lib/eval-gate.ts
 * carries the same number). A one-point margin is three and a half times INSIDE
 * the noise, so a single rep read two points under a player's rating painted a
 * red arrow that a re-read of the same clip would have painted green.
 *
 * The margin now scales with how much evidence is behind the mean, because that
 * is what actually governs whether a difference is real. The standard error of a
 * mean of n reads is 3.5/sqrt(n), and the arrow requires two of them:
 *
 *   n = 3  ->  4.0 points        n = 7  ->  2.6 points
 *   n = 4  ->  3.5 points        n = 12 ->  2.0 points
 *
 * And no arrow at all under TREND_MIN_REPS, because one rep is not a direction
 * however far it lands from the rating.
 */
export const TREND_MIN_REPS = 3;

export function trendMargin(n: number): number {
  return (2 * SCORE_READ_NOISE_SD) / Math.sqrt(Math.max(1, n));
}

export type Trend = "up" | "down" | "flat";

export function skillTrend(
  rating: number | null | undefined,
  sample: { mean: number; n: number } | null | undefined,
): Trend {
  if (rating == null || sample == null) return "flat";
  if (!Number.isFinite(rating) || !Number.isFinite(sample.mean)) return "flat";
  // One or two reps is not a direction. `flat` renders no glyph, so the honest
  // outcome of thin evidence is silence rather than a third colour.
  if (sample.n < TREND_MIN_REPS) return "flat";
  const delta = sample.mean - rating;
  const margin = trendMargin(sample.n);
  if (delta > margin) return "up";
  if (delta < -margin) return "down";
  return "flat";
}

/**
 * Mean score per skill over whatever reps are handed in. The caller decides the
 * window; this only averages, so a change to "the last seven days" is a change
 * to one query rather than to this function.
 *
 * A skill with no reps in the window is ABSENT from the result rather than
 * present as zero. Zero is a score a player could theoretically be given, and a
 * missing rep is not a bad rep.
 */
export function meanBySkill(
  reps: readonly { skill: Skill; overall_score: number }[],
): Partial<Record<Skill, { mean: number; n: number }>> {
  const sums = new Map<Skill, { total: number; n: number }>();
  for (const rep of reps) {
    if (!Number.isFinite(rep.overall_score)) continue;
    const acc = sums.get(rep.skill) ?? { total: 0, n: 0 };
    acc.total += rep.overall_score;
    acc.n += 1;
    sums.set(rep.skill, acc);
  }
  // The COUNT travels with the mean. It was computed here and thrown away, and
  // the caller then had no way to know whether an arrow stood on one rep or
  // twenty, which is the whole difference between a direction and a coin flip.
  const out: Partial<Record<Skill, { mean: number; n: number }>> = {};
  for (const [skill, acc] of sums) out[skill] = { mean: acc.total / acc.n, n: acc.n };
  return out;
}
