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
 * The margin exists so a third of a point does not paint an arrow. Ratings are
 * 0 to 100, so one point is roughly the noise floor of a single contact.
 */
export const TREND_MARGIN = 1;

export type Trend = "up" | "down" | "flat";

export function skillTrend(
  rating: number | null | undefined,
  weekMean: number | null | undefined,
): Trend {
  if (rating == null || weekMean == null) return "flat";
  if (!Number.isFinite(rating) || !Number.isFinite(weekMean)) return "flat";
  const delta = weekMean - rating;
  if (delta > TREND_MARGIN) return "up";
  if (delta < -TREND_MARGIN) return "down";
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
): Partial<Record<Skill, number>> {
  const sums = new Map<Skill, { total: number; n: number }>();
  for (const rep of reps) {
    if (!Number.isFinite(rep.overall_score)) continue;
    const acc = sums.get(rep.skill) ?? { total: 0, n: 0 };
    acc.total += rep.overall_score;
    acc.n += 1;
    sums.set(rep.skill, acc);
  }
  const out: Partial<Record<Skill, number>> = {};
  for (const [skill, acc] of sums) out[skill] = acc.total / acc.n;
  return out;
}
