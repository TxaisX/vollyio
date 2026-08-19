import assert from "node:assert/strict";
import test from "node:test";

import {
  isPlayProductId,
  isPurchaseToken,
  playSubscriptionMarker,
  isPlaySubscriptionId,
  readPlaySubscription,
  rtdnPurchaseToken,
} from "./play-billing.ts";

const NOW = new Date("2026-08-18T00:00:00Z");
const FUTURE = "2026-09-18T00:00:00Z";
const PAST = "2026-07-18T00:00:00Z";

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    startTime: "2026-08-11T00:00:00Z",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: "pro_monthly", expiryTime: FUTURE }],
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "user-uuid" },
    ...overrides,
  };
}

test("an active paid-up subscription is entitled", () => {
  const read = readPlaySubscription(subscription(), NOW);
  assert.equal(read.entitled, true);
  assert.equal(read.productId, "pro_monthly");
  assert.equal(read.expiryTime, FUTURE);
  assert.equal(read.acknowledged, false);
  assert.equal(read.obfuscatedAccountId, "user-uuid");
});

test("canceled means auto-renew off, not unpaid: still entitled until expiry", () => {
  const read = readPlaySubscription(
    subscription({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }),
    NOW,
  );
  assert.equal(read.entitled, true);
});

test("every uncertainty resolves to NOT entitled", () => {
  const cases: unknown[] = [
    null,
    "text",
    subscription({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }),
    subscription({ subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD" }),
    subscription({ subscriptionState: "SUBSCRIPTION_STATE_PAUSED" }),
    subscription({ subscriptionState: "SOMETHING_NEW" }),
    subscription({ lineItems: [] }),
    subscription({ lineItems: [{ productId: "pro_monthly", expiryTime: PAST }] }),
    subscription({ lineItems: [{ productId: "pro_monthly", expiryTime: "not a date" }] }),
  ];
  for (const c of cases) {
    assert.equal(readPlaySubscription(c, NOW).entitled, false);
  }
});

test("the latest expiry among line items wins", () => {
  const read = readPlaySubscription(
    subscription({
      lineItems: [
        { productId: "pro_weekly", expiryTime: PAST },
        { productId: "pro_weekly", expiryTime: FUTURE },
      ],
    }),
    NOW,
  );
  assert.equal(read.entitled, true);
  assert.equal(read.expiryTime, FUTURE);
});

test("the product catalog and token syntax hold their bounds", () => {
  assert.equal(isPlayProductId("pro_monthly"), true);
  assert.equal(isPlayProductId("pro_weekly"), true);
  assert.equal(isPlayProductId("pro_downsell"), false);
  assert.equal(isPurchaseToken("a".repeat(20)), true);
  assert.equal(isPurchaseToken("a".repeat(19)), false);
  assert.equal(isPurchaseToken("a".repeat(513)), false);
  assert.equal(isPurchaseToken("has spaces in it and more"), false);
  assert.equal(isPurchaseToken(42), false);
});

test("the marker round-trips and is recognizable", () => {
  const marker = playSubscriptionMarker("token-abc");
  assert.equal(marker, "play:token-abc");
  assert.equal(isPlaySubscriptionId(marker), true);
  assert.equal(isPlaySubscriptionId("sub_123stripe"), false);
  assert.equal(isPlaySubscriptionId(null), false);
});

test("the RTDN envelope yields its token and nothing else", () => {
  const token = "t".repeat(24);
  const data = Buffer.from(
    JSON.stringify({
      version: "1.0",
      packageName: "com.vollyio.app",
      eventTimeMillis: "1750000000000",
      subscriptionNotification: {
        notificationType: 2,
        purchaseToken: token,
        subscriptionId: "pro_monthly",
      },
    }),
  ).toString("base64");

  assert.equal(rtdnPurchaseToken({ message: { data } }), token);
  assert.equal(rtdnPurchaseToken({ message: { data: "%%%" } }), null);
  assert.equal(rtdnPurchaseToken({ message: {} }), null);
  assert.equal(rtdnPurchaseToken({}), null);
  assert.equal(rtdnPurchaseToken(null), null);
  // A one-time-product notification carries no subscription token.
  const oneTime = Buffer.from(
    JSON.stringify({ oneTimeProductNotification: { purchaseToken: token } }),
  ).toString("base64");
  assert.equal(rtdnPurchaseToken({ message: { data: oneTime } }), null);
});
