// Two switches, and the truth table between them (D-029, D-066).
//
// Selling Pro and capping the free tier are separate product decisions. Fusing
// them forced a launch posture nobody wanted: either the product closed on the
// day it started selling, or it could not sell at all. So there are two
// variables now, and this table is what stops them being quietly re-fused.
//
// The original trapdoor still has to hold inside the cap: ENFORCE_FREE_CAP with
// no payment path behind it caps every account behind a 402 pointing nowhere,
// which is a one-env-var mistake with no runtime symptom other than players
// being unable to train.
//
// lib/billing.ts is server-only and reads env at module load, so the predicates
// are re-implemented here against the same rules and checked exhaustively. If
// you change a rule there, this table must change with it.

import assert from "node:assert/strict";
import test from "node:test";

function billingOpen(billingEnabled: boolean, upgradeUrl: string | null): boolean {
  return billingEnabled && upgradeUrl !== null;
}

function shouldEnforceFreeTier(
  capEnforced: boolean,
  billingEnabled: boolean,
  upgradeUrl: string | null,
  providerConfigured: boolean,
): boolean {
  return capEnforced && billingOpen(billingEnabled, upgradeUrl) && providerConfigured;
}

function isBillingMisconfigured(
  capEnforced: boolean,
  billingEnabled: boolean,
  upgradeUrl: string | null,
  providerConfigured: boolean,
): boolean {
  return (
    capEnforced &&
    !shouldEnforceFreeTier(capEnforced, billingEnabled, upgradeUrl, providerConfigured)
  );
}

const URL_SET = "https://vollyio.com/settings#plan";

test("the launch posture: open product, Pro on offer, nothing capped", () => {
  // The combination the whole split exists for. Anyone can analyze freely AND
  // anyone who wants the paid plan can choose it.
  assert.equal(billingOpen(true, URL_SET), true, "Pro must be purchasable");
  assert.equal(
    shouldEnforceFreeTier(false, true, URL_SET, true),
    false,
    "nobody may be refused a rep while the cap is off",
  );
  assert.equal(isBillingMisconfigured(false, true, URL_SET, true), false);
});

test("the metered posture: cap on, with somewhere to pay", () => {
  assert.equal(shouldEnforceFreeTier(true, true, URL_SET, true), true);
  assert.equal(billingOpen(true, URL_SET), true);
  assert.equal(isBillingMisconfigured(true, true, URL_SET, true), false);
});

test("a cap with no way to pay never engages, and is flagged", () => {
  // The trapdoor. Either half missing and the cap must not bite.
  assert.equal(shouldEnforceFreeTier(true, true, null, true), false, "no upgrade destination");
  assert.equal(shouldEnforceFreeTier(true, false, URL_SET, true), false, "billing switched off");
  assert.equal(shouldEnforceFreeTier(true, false, null, true), false, "neither");
  assert.equal(isBillingMisconfigured(true, true, null, true), true);
  assert.equal(isBillingMisconfigured(true, false, URL_SET, true), true);
});

test("billing off sells nothing, whatever the cap variable says", () => {
  assert.equal(billingOpen(false, URL_SET), false);
  assert.equal(billingOpen(false, null), false);
  assert.equal(billingOpen(true, null), false, "an upgrade button needs a destination");
});

test("enforcement can never exceed the ability to pay, over the whole table", () => {
  for (const cap of [true, false]) {
    for (const billing of [true, false]) {
      for (const url of [URL_SET, null]) {
      for (const provider of [true, false]) {
        const enforcing = shouldEnforceFreeTier(cap, billing, url, provider);
        // The property that matters: a player is never refused a rep in a
        // configuration where they could not have bought their way past it.
        if (enforcing) {
          assert.equal(
            billingOpen(billing, url),
            true,
            `enforcing with no purchase path at cap=${cap} billing=${billing} url=${url}`,
          );
          assert.equal(
            provider,
            true,
            `enforcing with no configured provider at cap=${cap} billing=${billing} url=${url}`,
          );
        }
        // And the two states are mutually exclusive by construction.
        assert.ok(!(enforcing && isBillingMisconfigured(cap, billing, url, provider)));
      }
      }
    }
  }
});

test("an unset cap variable leaves the product open", () => {
  // The safe default is the open one. `ENFORCE_FREE_CAP` unset parses to false,
  // so forgetting it can never be the thing that starts refusing work.
  assert.equal(process.env.ENFORCE_FREE_CAP === "true", false);
  assert.equal(shouldEnforceFreeTier(false, true, URL_SET, true), false);
});

test("the cap flag can be armed before the provider keys arrive", () => {
  // This is the state the product is deliberately in: the owner has decided to
  // meter the free tier, and the provider secret has not landed yet. The cap
  // must NOT bite here, or a player hits a 402, follows the upsell to the plan
  // card, and finds no button on it. It engages itself when the key arrives.
  assert.equal(shouldEnforceFreeTier(true, true, URL_SET, false), false);
  assert.equal(
    isBillingMisconfigured(true, true, URL_SET, false),
    true,
    "armed but not engaging is a state worth surfacing, not a silent no-op",
  );
  assert.equal(shouldEnforceFreeTier(true, true, URL_SET, true), true, "and it engages once it can");
});
