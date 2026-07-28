import { test } from "node:test";
import assert from "node:assert/strict";
import { customerIdFromEvent, planChangeFromEvent } from "./billing-events.ts";

const USER = "6f2a8d1e-2c4b-4f5a-9c3d-1b7e5a9f0c42";
const PERIOD_END = 1_785_000_000;
const PERIOD_END_ISO = "2026-07-25T17:20:00.000Z";

function event(type: string, object: unknown): unknown {
  return { id: "evt_test", object: "event", type, data: { object } };
}

function subscription(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    current_period_end: PERIOD_END,
    ...fields,
  };
}

test("a completed checkout makes the player pro and carries the ids forward", () => {
  const change = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      client_reference_id: USER,
      customer: "cus_1",
      subscription: "sub_1",
    }),
  );

  assert.deepEqual(change, {
    userId: USER,
    plan: "pro",
    // The session knows nothing true about the billing period; the
    // subscription event that follows carries the real period end.
    renewsAt: null,
    subscriptionId: "sub_1",
    customerId: "cus_1",
  });
});

test("a completed checkout falls back to metadata and reads expanded references", () => {
  const change = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      client_reference_id: null,
      metadata: { user_id: USER },
      customer: { id: "cus_1", object: "customer" },
      subscription: { id: "sub_1", object: "subscription" },
    }),
  );

  assert.equal(change?.userId, USER);
  assert.equal(change?.customerId, "cus_1");
  assert.equal(change?.subscriptionId, "sub_1");
});

test("a completed checkout with no identity at all still reports the customer", () => {
  // The caller resolves the player from the customer id, so an absent user id
  // must not be mistaken for an absent event.
  const change = planChangeFromEvent(
    event("checkout.session.completed", { id: "cs_1", customer: "cus_1" }),
  );

  assert.equal(change?.userId, null);
  assert.equal(change?.plan, "pro");
  assert.equal(change?.customerId, "cus_1");
});

test("an active subscription is pro with the period end as an ISO timestamp", () => {
  const change = planChangeFromEvent(
    event("customer.subscription.updated", subscription({ status: "active" })),
  );

  assert.deepEqual(change, {
    // No metadata on this one: the route resolves the player from cus_1.
    userId: null,
    plan: "pro",
    renewsAt: PERIOD_END_ISO,
    subscriptionId: "sub_1",
    customerId: "cus_1",
  });
});

test("a trialing subscription is pro", () => {
  const change = planChangeFromEvent(
    event("customer.subscription.updated", subscription({ status: "trialing" })),
  );

  assert.equal(change?.plan, "pro");
});

test("a subscription cancelling at period end stays pro until it actually ends", () => {
  // The player has paid for this period and clicked cancel inside it. Reading
  // cancel_at_period_end here would take the analyses back on the click, weeks
  // before the money runs out. Only the deletion event ends access.
  const change = planChangeFromEvent(
    event(
      "customer.subscription.updated",
      subscription({ status: "active", cancel_at_period_end: true, canceled_at: 1_784_000_000 }),
    ),
  );

  assert.equal(change?.plan, "pro");
  assert.equal(change?.renewsAt, PERIOD_END_ISO);
});

test("an unpaid or lapsed subscription status maps to free", () => {
  for (const status of [
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
  ]) {
    const change = planChangeFromEvent(
      event("customer.subscription.updated", subscription({ status })),
    );
    assert.equal(change?.plan, "free", status);
  }
});

test("a past-due subscription keeps access while the provider retries", () => {
  // The same grace decision as invoice.payment_failed returning null. A failed
  // renewal charge must not cut a paying player off on the first attempt and
  // restore them two days later; 'unpaid' and 'canceled' above are what the
  // provider reports once the retries are actually exhausted.
  const change = planChangeFromEvent(
    event("customer.subscription.updated", subscription({ status: "past_due" })),
  );
  assert.equal(change?.plan, "pro");
});

test("a subscription update with no status changes nothing", () => {
  // A shape change from the provider must not read as a lapsed subscription and
  // downgrade a paying player.
  const change = planChangeFromEvent(
    event("customer.subscription.updated", subscription({ status: undefined })),
  );

  assert.equal(change, null);
});

test("a subscription update reads metadata when the checkout put it there", () => {
  const change = planChangeFromEvent(
    event(
      "customer.subscription.updated",
      subscription({ status: "active", metadata: { user_id: USER } }),
    ),
  );

  assert.equal(change?.userId, USER);
});

test("a period end on the subscription items is read when the top level has none", () => {
  const change = planChangeFromEvent(
    event(
      "customer.subscription.updated",
      subscription({
        status: "active",
        current_period_end: undefined,
        items: { object: "list", data: [{ id: "si_1", current_period_end: PERIOD_END }] },
      }),
    ),
  );

  assert.equal(change?.renewsAt, PERIOD_END_ISO);
});

test("an unusable period end becomes null rather than an invalid date", () => {
  for (const value of ["1785000000", 0, -5, Number.NaN, 99_999_999_999_999, null, {}]) {
    const change = planChangeFromEvent(
      event(
        "customer.subscription.updated",
        subscription({ status: "active", current_period_end: value }),
      ),
    );
    assert.equal(change?.plan, "pro", String(value));
    assert.equal(change?.renewsAt, null, String(value));
  }
});

test("a deleted subscription drops the player to free with no renewal", () => {
  const change = planChangeFromEvent(
    event(
      "customer.subscription.deleted",
      subscription({ status: "canceled", metadata: { user_id: USER } }),
    ),
  );

  assert.deepEqual(change, {
    userId: USER,
    plan: "free",
    renewsAt: null,
    subscriptionId: "sub_1",
    customerId: "cus_1",
  });
});

test("a failed payment changes nothing", () => {
  // The provider retries for days and most retries succeed. Downgrading here
  // would take away analyses the player still owns and give them back an hour
  // later; the subscription events are what actually end access.
  const change = planChangeFromEvent(
    event("invoice.payment_failed", {
      id: "in_1",
      customer: "cus_1",
      subscription: "sub_1",
      attempt_count: 1,
    }),
  );

  assert.equal(change, null);
});

test("event types this endpoint does not map change nothing", () => {
  for (const type of [
    "customer.subscription.created",
    "invoice.paid",
    "checkout.session.expired",
    "charge.refunded",
    "",
  ]) {
    assert.equal(planChangeFromEvent(event(type, subscription({ status: "active" }))), null, type);
  }
});

test("garbage payloads return null instead of throwing", () => {
  const garbage: unknown[] = [
    "customer.subscription.updated",
    42,
    true,
    [],
    {},
    { type: "customer.subscription.updated" },
    { type: "customer.subscription.updated", data: null },
    { type: "customer.subscription.updated", data: {} },
    { type: "customer.subscription.updated", data: { object: "sub_1" } },
    { type: 7, data: { object: { status: "active" } } },
    event("checkout.session.completed", null),
    event("checkout.session.completed", []),
  ];

  for (const payload of garbage) {
    assert.equal(planChangeFromEvent(payload), null, JSON.stringify(payload) ?? "undefined");
  }
});

test("a null or undefined payload returns null", () => {
  assert.equal(planChangeFromEvent(null), null);
  assert.equal(planChangeFromEvent(undefined), null);
});

test("the customer id is readable off every event this endpoint receives", () => {
  const cases: unknown[] = [
    event("checkout.session.completed", { id: "cs_1", customer: "cus_1" }),
    event("customer.subscription.updated", subscription({ status: "active" })),
    event("customer.subscription.deleted", subscription({ status: "canceled" })),
    event("invoice.payment_failed", { id: "in_1", customer: "cus_1" }),
    event("invoice.payment_failed", { id: "in_1", customer: { id: "cus_1" } }),
  ];

  for (const payload of cases) {
    assert.equal(customerIdFromEvent(payload), "cus_1");
  }
});

test("the customer id is null when the event carries none, and never throws", () => {
  for (const payload of [
    null,
    undefined,
    "cus_1",
    {},
    event("invoice.payment_failed", { id: "in_1" }),
    event("invoice.payment_failed", { id: "in_1", customer: "" }),
    event("invoice.payment_failed", { id: "in_1", customer: 12 }),
  ]) {
    assert.equal(customerIdFromEvent(payload), null);
  }
});
