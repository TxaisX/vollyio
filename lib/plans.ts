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
  pro: 18,
};

// Completed analyses a new account may run before the recurring rate applies.
// Spent against LIFETIME rows in `analyses`, not stored and not decremented, so
// three ever closes it whichever months they land in (migration 040).
//
// It exists because the rating only moves on the second read of a skill
// (`updateRating` in lib/ratings.ts seeds on the first), so a player held to
// one a month from signup would wait a month to see the product do the one
// thing it is for.
export const SIGNUP_GRANT = 3;

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
export const PRO_PRICE_LABEL = "$14.99/mo";

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
