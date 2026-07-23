import "server-only";

// Free-tier enforcement (D-029).
//
// The enforcement half of billing has been built and atomic since D-012:
// `reserve_analysis_entitlement(p_enforce_free)` will hold a free account to a
// single lifetime analysis and the route returns 402. The COMMERCE half does
// not exist, there is no Stripe integration, no checkout, no webhook, and
// nothing anywhere that can write `profiles.plan`, which is revoked from the
// authenticated role and has no server-side writer.
//
// That combination makes `BILLING_ENABLED=true` a trapdoor rather than a
// feature flag: flipping it hard-caps every user at one analysis for the rest
// of time, behind a 402 that points at an upgrade with no destination, and
// nothing in the request path notices. The gate below closes that trapdoor by
// requiring the flag AND somewhere for the user to actually go. Turning on
// billing is therefore a two-key operation, and the wrong single key is inert
// instead of destructive.
//
// Deliberately NOT a "did someone remember to build Stripe" check, it is a
// check that the upgrade destination the 402 promises exists. If a future
// payment path is not a URL, extend this predicate rather than bypassing it.

export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

// Where the 402 sends a player. Absent until a paid tier actually ships.
export const UPGRADE_URL = process.env.NEXT_PUBLIC_UPGRADE_URL?.trim() || null;

export function hasUpgradePath(): boolean {
  return UPGRADE_URL !== null;
}

// The value handed to `reserve_analysis_entitlement(p_enforce_free)`.
export function shouldEnforceFreeTier(): boolean {
  return BILLING_ENABLED && hasUpgradePath();
}

// True when billing is switched on but there is nowhere to pay, a
// misconfiguration worth surfacing rather than silently ignoring.
export function isBillingMisconfigured(): boolean {
  return BILLING_ENABLED && !hasUpgradePath();
}
