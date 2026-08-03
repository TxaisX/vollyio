// Plan allowances (docs/billing.md). These numbers are ALSO defined in SQL, in
// the newest migration that defines `plan_monthly_allowance`, because the
// database is the thing that actually enforces them. `lib/plans.test.ts` pins
// the two together: a counter that promises a rep the reservation will refuse
// is worse than no counter.

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

// The RECURRING rate, per allowance window. Not what a new account gets: see
// SIGNUP_GRANT below, which is a separate and larger number.
export const MONTHLY_ALLOWANCE: Record<Plan, number> = {
  free: 1,
  // 24 since D-085: four reads of every skill a month, the same
  // one-number-per-skill logic the signup grant uses (SKILLS.length is 6).
  // 18 was a round number with no story; 24 is a sentence.
  pro: 24,
};

// Completed analyses a new account may run before the recurring rate applies.
// Spent against LIFETIME rows in `analyses`, not stored and not decremented, so
// six ever closes it whichever months they land in (migration 046).
//
// It exists because the rating only moves on the second read of a skill
// (`updateRating` in lib/ratings.ts seeds on the first), so a player held to
// one a month from signup would wait a month to see the product do the one
// thing it is for. 3 -> 5 on D-080 after launch feedback said 3 was not enough
// room to evaluate. 5 -> 6 on D-083, because SKILLS.length is 6: the grant is
// now exactly one read of every skill the product scores, which is a reason a
// player can hear rather than a number someone picked.
export const SIGNUP_GRANT = 6;

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

// An unrecognized plan resolves to the free allowance rather than throwing,
// matching the SQL's `else` branch. Fail toward the smaller entitlement: a
// misconfigured plan string must never hand out the larger one.
export function monthlyAllowance(plan: unknown): number {
  return isPlan(plan) ? MONTHLY_ALLOWANCE[plan] : MONTHLY_ALLOWANCE.free;
}

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

// What the player is charged, for display only. The authority on price is the
// payment provider; this string never decides anything.
//
// $9.99 since D-077 (was $14.99). Provider price object
// `price_1TzKG5JOFP4i3BqJC2z0xklp`, which now carries the `vollyio_pro_monthly`
// lookup key transferred off the old one. The old $14.99 price stays ACTIVE
// because a live subscription is still attached to it: archiving a price does
// not move the subscriptions on it, it only stops new checkouts.
export const PRO_PRICE_LABEL = "$9.99/mo";

/**
 * What a plan gives, as one sentence, built from the constants above rather
 * than typed into each surface.
 *
 * Free takes two numbers to describe honestly and there is no way around that:
 * "1 a month" hides the trial and reads as miserly, "3 free analyses" is a
 * number that stops being true in month two. Every surface says both, in the
 * same order, so nobody discovers the second half at the 402.
 */
export function allowanceSentence(plan: Plan): string {
  if (plan === "pro") return `${MONTHLY_ALLOWANCE.pro} analyses a month`;
  return `${SIGNUP_GRANT} analyses to start, then ${MONTHLY_ALLOWANCE.free} a month`;
}
