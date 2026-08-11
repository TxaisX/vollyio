// Plan allowances (docs/billing.md). These numbers are ALSO defined in SQL, in
// the newest migration that defines `plan_monthly_allowance`, because the
// database is the thing that actually enforces them. `lib/plans.test.ts` pins
// the two together: a counter that promises a rep the reservation will refuse
// is worse than no counter.

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

// Which wall a refusal came from. Since D-110 there are two, and the only thing
// that differs downstream is the noun: "today" or "this month". Naming the
// period once here is what stops that noun being retyped into every surface.
export type AllowancePeriod = "day" | "month";

// The RECURRING rate, per allowance window. Not what a new account gets: see
// SIGNUP_GRANT below, which is a separate and larger number.
// Both numbers are DAILY_ALLOWANCE x 30, and that is the only reason they
// exist. Since D-110 the day is the wall that binds; the month is kept solely
// so the two cannot disagree, because a player who used their day rate every
// day for a month must never then meet a monthly refusal nobody told them
// about. Change the daily number and change these with it.
export const MONTHLY_ALLOWANCE: Record<Plan, number> = {
  free: 90,
  pro: 540,
};

// The wall that actually binds Pro, checked against rows created since UTC
// midnight. Defined in SQL by `plan_daily_allowance` in the newest migration
// and pinned to this file by lib/plans.test.ts, exactly as the monthly rate is.
//
// 18 is three reads of every skill (SKILLS.length is 6). Three is the smallest
// number that averages: one read is a rep, two is a comparison, three is the
// first count where a per-skill number stops swinging on a single lucky
// contact. The player-facing sentence says "three per skill" rather than "18",
// because the reason is the part they can act on.
//
// It is a DAILY number because cost is per request, not per minute (D-108): the
// same hour of footage costs 18x more as short reps than as long clips, and a
// day is the shortest window that both bounds that and refills often enough
// that nobody is locked out of their own training week.
export const DAILY_ALLOWANCE: Record<Plan, number> = {
  // 3 a day, up from 1 a MONTH. Enough to bring a session's worth of reps and
  // see the product work, and small enough that a free account costs about
  // $1.15 a month fully used (D-106's $0.0128 cached), which one Pro carries
  // roughly six of.
  free: 3,
  // 18 is three reads of every skill, and the 6x step from free is the offer.
  pro: 18,
};

// Completed analyses a new account may run before the recurring rate applies.
// Spent against LIFETIME rows in `analyses`, not stored and not decremented, so
// three ever closes it whichever days they land in (migration 046).
//
// It exists because the rating only moves on the second read of a skill
// (`updateRating` in lib/ratings.ts seeds on the first), so a player held to a
// trickle from signup would wait to see the product do the one thing it is for.
// 3 -> 5 on D-080 after launch feedback, 5 -> 6 on D-083 to match SKILLS.length,
// then back to 3 on D-110 (migration 059) once the recurring rate became DAILY:
// a grant sized to bridge a month of scarcity is pointless beside 3 a day, and
// the day rate now does the evaluating the grant used to have to do.
//
// This comment claimed six for as long as the constant said three. It is quoted
// into the Terms through `allowanceSentence`, so prose here that disagrees with
// the number below is a false statement in a legal document, not a stale note.
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

// Same fail-toward-the-smaller-entitlement rule as monthlyAllowance, and for
// the same reason: an unrecognized plan string must never widen a wall.
export function dailyAllowance(plan: unknown): number {
  return isPlan(plan) ? DAILY_ALLOWANCE[plan] : DAILY_ALLOWANCE.free;
}

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

// What the player is charged, for display only. The authority on price is the
// payment provider; this string never decides anything.
//
// $29.99 since D-107, which replaced the $9.99 of D-077 (itself down from
// $14.99). THE COMMENT SAID $9.99 FOR AS LONG AS THE CONSTANT SAID $29.99, and
// this line is quoted into the Terms and the checkout disclosure, so a reader
// who trusted the prose above the export was reading a 3x error about money in
// the file that supplies the number to a legal document.
//
// Provider price object `price_1TzKG5JOFP4i3BqJC2z0xklp` carries the
// `vollyio_pro_monthly` lookup key, transferred off the old one. Superseded
// prices stay ACTIVE while any live subscription is attached: archiving a price
// does not move the subscriptions on it, it only stops new checkouts.
export const PRO_PRICE_LABEL = "$29.99/mo";

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
  // Pro is stated as a DAY rate because that is the wall that binds it, and as
  // "three per skill" because that is the reason for the number. Stating a
  // monthly figure here would be the hidden asterisk D-110 exists to refuse:
  // 540 a month is true and unreachable, 18 a day is true and is what a player
  // will actually meet.
  if (plan === "pro") return `${DAILY_ALLOWANCE.pro} analyses a day, three of every skill`;
  // No longer "N to start, then M a day". The grant is vestigial since D-110
  // (see SIGNUP_GRANT), so a starter number in this sentence would promise a
  // first day that is identical to every other day.
  return `${DAILY_ALLOWANCE.free} analyses a day`;
}
