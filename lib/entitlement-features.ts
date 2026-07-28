// What a plan includes, as data (docs/plan-matrix.md).
//
// One place decides, instead of `plan === "pro"` appearing inline in six
// components. The inline comparison is how a perk ends up half-shipped: gated
// on the breakdown page, ungated on the share page, and nobody able to answer
// what Pro actually is without reading every file that mentions it.
//
// Today the honest answer is that Pro buys ONE thing, the monthly allowance,
// and every row below is deliberately identical across plans. That is the
// current state of the product recorded where a change has to pass through it,
// not an oversight. `entitlement-features.test.ts` holds a tripwire on it: the
// moment a row stops matching, the matrix doc is stale and the test says so.
//
// Nothing reads this yet. Wiring a surface to it is a separate change.
//
// Pure and client-safe on purpose: no `server-only`, no environment, no
// database. It answers "what does this plan include" and never "may the
// product take money" (lib/billing.ts) or "how many are left this month"
// (lib/allowance.ts). Those are three different questions, and fusing two of
// them is what D-066 had to unpick.

import { isPlan, monthlyAllowance, type Plan } from "./plans.ts";

export const FEATURES = [
  "analysis",
  "breakdown_detail",
  "history",
  "share_link",
  "drills",
  "goals",
  "scoreboard",
] as const;

export type Feature = (typeof FEATURES)[number];

// Each row is what the PLAN includes, never what is switched on globally.
//
// Coach chat is deliberately absent. A build flag decides it (`COACH_ENABLED`,
// dark since D-047), so a row here would have this module claim an authority it
// does not hold and report a capability whose route answers 404. It earns a row
// when the plan is the thing that decides it, and not before.
const FEATURE_MATRIX: Record<Feature, Record<Plan, boolean>> = {
  analysis: { free: true, pro: true },
  breakdown_detail: { free: true, pro: true },
  history: { free: true, pro: true },
  share_link: { free: true, pro: true },
  drills: { free: true, pro: true },
  goals: { free: true, pro: true },
  scoreboard: { free: true, pro: true },
};

export function isFeature(value: unknown): value is Feature {
  return typeof value === "string" && (FEATURES as readonly string[]).includes(value);
}

/**
 * Does this plan include this feature?
 *
 * Fails closed on both arguments, and the two failures are different bugs.
 *
 * An unrecognized plan resolves to the free row rather than throwing, matching
 * `monthlyAllowance` and the SQL it mirrors. A plan string this build has no
 * name for means the database is ahead of the deploy, and a name we cannot
 * resolve must never be the thing that hands out the larger entitlement.
 *
 * An unrecognized feature is false. TypeScript stops that at the call site, but
 * the argument can arrive from a URL parameter or a stored row where it is
 * merely a string. The membership check is also what keeps an inherited key
 * like `__proto__` or `constructor` from reaching the lookup and coming back as
 * a truthy object, which would read as "included".
 */
export function can(plan: unknown, feature: unknown): boolean {
  if (!isFeature(feature)) return false;
  return FEATURE_MATRIX[feature][isPlan(plan) ? plan : "free"];
}

/**
 * Completed analyses this plan allows per UTC calendar month.
 *
 * Delegated rather than restated. The numbers live in `lib/plans.ts`, which is
 * pinned against the SQL that actually enforces them, and a second copy here
 * would be free to drift from the one the reservation compares against.
 */
export function allowanceFor(plan: unknown): number {
  return monthlyAllowance(plan);
}
