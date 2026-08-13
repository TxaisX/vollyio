import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OFFER,
  OFFERS,
  OFFER_KEYS,
  isOfferKey,
  renewalSentence,
} from "./offers.ts";
import { MONTHLY_ALLOWANCE, PRO_PRICE_LABEL } from "./plans.ts";

test("every key resolves to an offer that agrees with its own key", () => {
  for (const key of OFFER_KEYS) {
    assert.equal(OFFERS[key].key, key, `${key} disagrees with its entry`);
  }
});

// Two offers sharing an env var would silently charge one price for both, and
// the symptom is a correct-looking picker that takes the wrong money.
test("each offer reads a distinct environment variable", () => {
  const vars = OFFER_KEYS.map((k) => OFFERS[k].envVar);
  assert.equal(new Set(vars).size, vars.length);
});

test("the default offer is one the picker actually lists", () => {
  assert.ok(OFFERS[DEFAULT_OFFER].selectable);
});

// The downsell is the exit-intent price. Listing it beside the others would
// make the monthly the price nobody ever chooses.
test("the downsell is never listed as a selectable choice", () => {
  assert.equal(OFFERS.downsell.selectable, false);
});

test("the monthly label is the plan constant, not a second copy of it", () => {
  assert.equal(OFFERS.monthly.priceLabel, PRO_PRICE_LABEL);
});

// The ladder has to stay monotonic per unit time, or the picker is offering a
// worse deal for a longer commitment. Weekly is dearest per month by design.
test("the ladder is monotonic once weekly is annualised to a month", () => {
  const perMonth = (label: string, weeks: number) =>
    Number(label.replace(/[^0-9.]/g, "")) * weeks;
  const weekly = perMonth(OFFERS.weekly.priceLabel, 52 / 12);
  const monthly = perMonth(OFFERS.monthly.priceLabel, 1);
  const downsell = perMonth(OFFERS.downsell.priceLabel, 1);
  assert.ok(weekly > monthly, "weekly must cost more per month than monthly");
  assert.ok(monthly > downsell, "the downsell must undercut the monthly");
});

// This is the failure the whole offer catalog exists to prevent: a renewal
// disclosure that says "every month" over a subscription that charges weekly.
test("the renewal disclosure names the offer's own period and no other", () => {
  const weekly = renewalSentence(OFFERS.weekly);
  assert.match(weekly, /every week/);
  assert.doesNotMatch(weekly, /every month/);

  const monthly = renewalSentence(OFFERS.monthly);
  assert.match(monthly, /every month/);
  assert.doesNotMatch(monthly, /every week/);
});

test("the renewal disclosure quotes the price and what it buys", () => {
  for (const key of OFFER_KEYS) {
    const sentence = renewalSentence(OFFERS[key]);
    assert.ok(sentence.includes(OFFERS[key].priceLabel), `${key} omits its price`);
    assert.ok(
      sentence.includes(String(MONTHLY_ALLOWANCE.pro)),
      `${key} omits the allowance`,
    );
    assert.match(sentence, /not refunded/, `${key} omits the refund posture`);
  }
});

test("only the three known strings are offer keys", () => {
  for (const key of OFFER_KEYS) assert.ok(isOfferKey(key));
  for (const junk of ["", "free", "pro", "MONTHLY", null, undefined, 1, {}]) {
    assert.equal(isOfferKey(junk), false, `${String(junk)} was accepted`);
  }
});
