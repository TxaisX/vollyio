// How precise a score is allowed to LOOK, given how precise it actually is.
//
// THE MEASUREMENT THIS FILE EXISTS FOR. `evals/CALIBRATION.md`, 13 clips read
// three times each: pooled within-clip read noise sd 3.5, against a
// between-clip sd of 5.9. That is a reliability of 0.64, so roughly a third of
// the variance a player sees is the same clip read twice. The repo's own
// conclusion, in its own words: "Two reps under about seven points apart are
// not distinguishable."
//
// The product was rendering that number to the unit: an 81 on a ring, "81/100"
// in a share title, "your best rep yet" the moment a 79 became an 80. Every one
// of those is a claim of one-point resolution from a read whose noise is three
// and a half. This module is the single place that decides how much of the
// number is real, so a surface cannot quietly go back to showing all of it.
//
// WHAT THIS DOES NOT FIX, stated plainly so nobody mistakes it for a solution:
// the model does not separate skill levels at all (mean raw score by the
// footage's own level: developing 81.7, intermediate 80.2, advanced 81.9, pro
// 83.5). Widening the display makes the number honest about its precision. It
// does not make it a measure of how good a player is, and no amount of
// rounding will.

/** Measured within-clip read noise, in score points, one standard deviation. */
export const SCORE_READ_NOISE_SD = 3.5;

/**
 * The granularity a score is DISPLAYED at.
 *
 * Five, not one. The units digit of a raw score carries no information: re-read
 * the same clip and it moves. Rounding to five keeps the number useful as a
 * rough position while removing the digit that was pure noise.
 *
 * Five is deliberately smaller than `MEANINGFUL_SCORE_DELTA` below. This step
 * governs how the number LOOKS; the delta governs what the product is allowed
 * to SAY. Two displayed values one step apart are not a claim that anything
 * changed, and nothing in the product may treat them as one.
 */
export const SCORE_STEP = 5;

/**
 * The smallest gap between two scores that the product may describe as a
 * difference.
 *
 * Seven, taken from the repo's own measurement rather than invented here. For
 * context on how permissive that is: the difference between two independent
 * reads has an sd of about 3.5 x sqrt(2) = 4.95, so a 95% confidence floor
 * would be nearer 10. Seven sits around one standard deviation of that
 * difference, which is the loosest defensible line. Anything under it is the
 * same rep read twice, and the product says nothing.
 */
export const MEANINGFUL_SCORE_DELTA = 7;

/** The score as it may be shown: rounded to `SCORE_STEP`, clamped to 0..100. */
export function displayScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped / SCORE_STEP) * SCORE_STEP;
}

/**
 * May the product claim these two scores are different at all?
 *
 * Used for every comparison a player reads as a fact: a personal best, a trend
 * direction, "up 8 since your last rep". Deliberately symmetric and
 * deliberately strict, because the failure it prevents is the product telling
 * somebody they improved when the clip was read twice.
 */
export function scoresDiffer(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) > MEANINGFUL_SCORE_DELTA;
}

/**
 * Is `candidate` a genuine improvement on `best`, rather than the same rep on a
 * luckier draw? A tie or a one-point win is not a personal best.
 */
export function beats(candidate: number, best: number | null): boolean {
  if (best == null) return true;
  if (!Number.isFinite(candidate) || !Number.isFinite(best)) return false;
  return candidate - best > MEANINGFUL_SCORE_DELTA;
}

/**
 * The one sentence that makes the widened number legible, rendered wherever a
 * score is shown large enough to be read as exact.
 *
 * Says the limitation in the player's terms rather than in standard deviations:
 * what they need to know is that two close reps are the same rep, not what the
 * sd was.
 */
export function scorePrecisionNote(): string {
  return `Read to the nearest ${SCORE_STEP}. Two reps within ${MEANINGFUL_SCORE_DELTA} points are the same rep.`;
}
