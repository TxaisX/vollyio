// Plan allowances (docs/billing.md). These numbers are ALSO defined in SQL, in
// the newest migration that defines `plan_monthly_allowance`, because the
// database is the thing that actually enforces them. `lib/plans.test.ts` pins
// the two together: a counter that promises a rep the reservation will refuse
// is worse than no counter.

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const MONTHLY_ALLOWANCE: Record<Plan, number> = {
  free: 3,
  pro: 18,
};

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
