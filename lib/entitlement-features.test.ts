// The plan predicate, walked exhaustively (docs/plan-matrix.md).
//
// This module decides what a plan includes, so the tests that matter are the
// ones about the answers nobody wrote down: an unknown plan, an unknown
// feature, and the invariant that Pro is never worse off than Free. A predicate
// that hands out an entitlement on a name it does not recognize is the same
// class of bug as a cap that engages with nowhere to pay.

import assert from "node:assert/strict";
import test from "node:test";
import {
  FEATURES,
  allowanceFor,
  can,
  isFeature,
  type Feature,
} from "./entitlement-features.ts";
import { MONTHLY_ALLOWANCE, PLANS, monthlyAllowance } from "./plans.ts";

// The matrix as docs/plan-matrix.md section 1 states it, written out by hand
// rather than imported, so this compares two independent copies instead of
// comparing the module to itself.
const EXPECTED: Record<Feature, { free: boolean; pro: boolean }> = {
  analysis: { free: true, pro: true },
  breakdown_detail: { free: true, pro: true },
  history: { free: true, pro: true },
  share_link: { free: true, pro: true },
  drills: { free: true, pro: true },
  goals: { free: true, pro: true },
  scoreboard: { free: true, pro: true },
};

test("every plan and feature pair answers what the matrix says", () => {
  for (const feature of FEATURES) {
    for (const plan of PLANS) {
      assert.equal(
        can(plan, feature),
        EXPECTED[feature][plan],
        `${plan} / ${feature} disagrees with docs/plan-matrix.md`,
      );
    }
  }
});

test("the feature list and the matrix cover exactly the same keys", () => {
  // A feature added to one and not the other is a row that silently answers
  // false everywhere, which reads as a perk being withheld rather than missing.
  assert.deepEqual([...FEATURES].sort(), Object.keys(EXPECTED).sort());
  assert.equal(new Set(FEATURES).size, FEATURES.length, "duplicate feature key");
});

test("an unknown plan string falls back to the smaller entitlement", () => {
  // The database bounds `profiles.plan` to free or pro (migration 027), so an
  // unrecognized value means this build is behind the schema. Guessing upward
  // there would hand a stranger the paid entitlement on a typo.
  for (const feature of FEATURES) {
    for (const plan of [
      "enterprise",
      "Pro",
      "PRO",
      "pro ",
      " pro",
      "premium",
      "",
      "0",
      null,
      undefined,
      0,
      1,
      true,
      {},
      { plan: "pro" },
      ["pro"],
      Symbol("pro"),
    ]) {
      assert.equal(
        can(plan, feature),
        can("free", feature),
        `${String(plan)} / ${feature} did not resolve to the free row`,
      );
    }
  }
});

test("an unknown feature is false, whatever the plan", () => {
  for (const plan of [...PLANS, "enterprise", null, undefined]) {
    for (const feature of [
      "longer_clips",
      "coach_chat",
      "export",
      "priority",
      "retention",
      "Analysis",
      "",
      null,
      undefined,
      0,
      {},
      ["analysis"],
    ]) {
      assert.equal(
        can(plan, feature),
        false,
        `${String(plan)} / ${String(feature)} answered true for a feature that does not exist`,
      );
    }
  }
});

test("an inherited object key cannot answer as a feature", () => {
  // Without the membership guard, `FEATURE_MATRIX["constructor"]` returns a
  // function off Object.prototype, and the plan lookup on it comes back
  // undefined at best and truthy at worst. A URL parameter is a string.
  for (const key of ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty"]) {
    assert.equal(can("free", key), false, `${key} reached the matrix`);
    assert.equal(can("pro", key), false, `${key} reached the matrix`);
    assert.equal(isFeature(key), false, `${key} passed the feature guard`);
  }
});

test("feature recognition is exact", () => {
  assert.equal(isFeature("analysis"), true);
  assert.equal(isFeature("Analysis"), false);
  assert.equal(isFeature("analysis "), false);
  assert.equal(isFeature(""), false);
  assert.equal(isFeature(null), false);
  assert.equal(isFeature(undefined), false);
  assert.equal(isFeature(0), false);
});

test("Pro is never worse off than Free, over the whole matrix", () => {
  // The property that has to survive every future edit. A perk accidentally
  // written into the free column only would be invisible until a paying player
  // found it, and they would be right to ask for their money back.
  for (const feature of FEATURES) {
    if (can("free", feature)) {
      assert.equal(
        can("pro", feature),
        true,
        `${feature} is included on Free and withheld from Pro`,
      );
    }
  }
});

test("the monthly allowance is the one thing Pro actually buys", () => {
  // The RECURRING rate. A new free account also holds a one-time signup grant
  // of SIGNUP_GRANT (migration 040), which this function knows nothing about on
  // purpose: it answers "what does this plan give every month", and the grant
  // is neither monthly nor a property of the plan.
  assert.equal(allowanceFor("free"), 1);
  assert.equal(allowanceFor("pro"), MONTHLY_ALLOWANCE.pro);
  assert.ok(allowanceFor("pro") > allowanceFor("free"));
});

test("the allowance is delegated to lib/plans.ts, never restated here", () => {
  // A second copy of 3 and 18 would be free to drift from the numbers the
  // reservation enforces, which is the failure lib/plans.test.ts exists to stop.
  // Pinning the delegation is what keeps this module out of that argument.
  for (const plan of [...PLANS, "enterprise", "", null, undefined, {}, 7]) {
    assert.equal(allowanceFor(plan), monthlyAllowance(plan));
  }
  assert.equal(allowanceFor("enterprise"), MONTHLY_ALLOWANCE.free);
  assert.equal(allowanceFor(null), MONTHLY_ALLOWANCE.free);
});

test("TRIPWIRE: no feature differs between plans yet", () => {
  // Deliberate, and it is meant to fail one day. Today the only difference
  // between the plans is the allowance, and docs/plan-matrix.md says so in the
  // sentence the plan card and every piece of pricing copy are written from.
  //
  // When this fails, a perk has shipped. Update docs/plan-matrix.md in the same
  // change: move the row out of section 3 and into section 1, and correct
  // section 2. A perk that exists in code and not in the matrix is how
  // marketing ends up describing a product nobody built.
  const differing = FEATURES.filter((f) => can("free", f) !== can("pro", f));
  assert.deepEqual(
    differing,
    [],
    `plan-keyed features now exist (${differing.join(", ")}); docs/plan-matrix.md must move them from section 3 to section 1 in this change`,
  );
});
