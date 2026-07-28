import "server-only";
import { stripeConfigured } from "./stripe.ts";

// Two switches, not one (D-066).
//
// "Can a player buy Pro" and "is the free allowance enforced" are different
// product decisions, and fusing them forced a launch posture nobody wanted:
// either the product was closed the day it started selling, or it could not
// sell at all. The intended posture is open first, premium optional, and the
// cap arriving later as its own decision.
//
//   BILLING_ENABLED   the purchase path exists at all
//   ENFORCE_FREE_CAP  the monthly allowance actually refuses a rep
//
// The original trapdoor guard survives inside the second one. Enforcement still
// requires a real place to pay, because a cap with no checkout behind it is a
// one-env-var mistake that locks every account out from behind a 402 pointing
// nowhere, with no runtime symptom other than users being unable to train.

export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

// Off unless explicitly on. The safe default is the open one: an unset variable
// must never be the thing that starts refusing work.
export const FREE_CAP_ENFORCED = process.env.ENFORCE_FREE_CAP === "true";

// Where the 402 and the upgrade button send a player.
export const UPGRADE_URL = process.env.NEXT_PUBLIC_UPGRADE_URL?.trim() || null;

export function hasUpgradePath(): boolean {
  return UPGRADE_URL !== null;
}

/**
 * May the product take money right now?
 *
 * Deliberately independent of the cap. With this true and the cap off, Pro is
 * an optional upgrade on an open product, which is the launch posture: nobody
 * is blocked, and anyone who wants the paid tier can choose it.
 *
 * The caller must ALSO check `stripeConfigured()` from lib/stripe.ts, which
 * owns the provider credentials. Splitting it that way keeps this module free
 * of secrets and keeps the key check next to the keys.
 */
export function billingOpen(): boolean {
  return BILLING_ENABLED && hasUpgradePath();
}

/**
 * The value handed to `reserve_analysis_entitlement(p_enforce_free)`.
 *
 * FOUR conditions, and the fourth is the one the first version of this split
 * missed: the provider must actually be configured. Checking only for an
 * upgrade URL meant the cap could engage while `stripeConfigured()` was false,
 * so a player would hit a 402, follow the upsell to the plan card, and find no
 * button there at all. That is the D-029 trapdoor wearing a different hat.
 *
 * The useful consequence: the cap flag is now safe to set BEFORE the provider
 * keys land. It arms the intent and engages itself the moment checkout works,
 * exactly like the upgrade button does. Nothing is ever capped in a
 * configuration where a player cannot buy their way past it.
 */
export function shouldEnforceFreeTier(): boolean {
  return FREE_CAP_ENFORCED && billingOpen() && stripeConfigured();
}

/**
 * The cap is switched on but something behind it is missing, so it is not
 * actually engaging. Not an error: this is the armed-and-waiting state between
 * setting the flag and the keys arriving. Worth surfacing so the difference
 * between "waiting" and "on" is never guessed at.
 */
export function isBillingMisconfigured(): boolean {
  return FREE_CAP_ENFORCED && !shouldEnforceFreeTier();
}
