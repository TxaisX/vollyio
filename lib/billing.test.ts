// Free-tier enforcement can only engage when players can actually pay (D-029).
//
// The failure this prevents: BILLING_ENABLED=true with no payment path caps
// every account at one lifetime analysis behind a 402 pointing nowhere. That is
// a one-env-var mistake with no runtime symptom other than users being locked
// out, so the two-key rule is asserted here rather than left to a comment.
//
// lib/billing.ts is server-only and reads env at module load, so the predicate
// is re-implemented here against the same rule and checked as a truth table.
// If you change the rule in billing.ts, this table must change with it.

import assert from "node:assert/strict";
import test from "node:test";

function shouldEnforceFreeTier(billingEnabled: boolean, upgradeUrl: string | null): boolean {
  return billingEnabled && upgradeUrl !== null;
}

function isBillingMisconfigured(billingEnabled: boolean, upgradeUrl: string | null): boolean {
  return billingEnabled && upgradeUrl === null;
}

test("billing on with a real upgrade path enforces the free tier", () => {
  assert.equal(shouldEnforceFreeTier(true, "https://example.test/upgrade"), true);
});

test("billing on with NO upgrade path does not enforce", () => {
  assert.equal(
    shouldEnforceFreeTier(true, null),
    false,
    "enforcing here would cap every account at one analysis with no way to pay",
  );
});

test("billing off never enforces, upgrade path or not", () => {
  assert.equal(shouldEnforceFreeTier(false, null), false);
  assert.equal(shouldEnforceFreeTier(false, "https://example.test/upgrade"), false);
});

test("the trapdoor configuration is reported as a misconfiguration", () => {
  assert.equal(isBillingMisconfigured(true, null), true);
  assert.equal(isBillingMisconfigured(true, "https://example.test/upgrade"), false);
  assert.equal(isBillingMisconfigured(false, null), false);
});

test("enforcement and misconfiguration are mutually exclusive", () => {
  for (const billing of [true, false]) {
    for (const url of ["https://example.test/upgrade", null]) {
      assert.ok(
        !(shouldEnforceFreeTier(billing, url) && isBillingMisconfigured(billing, url)),
        `both true for billing=${billing} url=${url}`,
      );
    }
  }
});
