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
      status: "complete",
      payment_status: "paid",
      client_reference_id: USER,
      customer: "cus_1",
      subscription: "sub_1",
    }),
  );

  assert.deepEqual(change, {
    userId: USER,
    plan: "pro",
    // The session knows nothing true about the billing period; the
    // subscription event that follows carries the real period end. The flag
    // is what keeps these nulls from overwriting dates a same-burst
    // subscription event already stored.
    renewsAt: null,
    periodStartsAt: null,
    subscriptionId: "sub_1",
    customerId: "cus_1",
    preserveBillingDates: true,
  });
});

test("a completed checkout falls back to metadata and reads expanded references", () => {
  const change = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
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
    event("checkout.session.completed", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
      customer: "cus_1",
    }),
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
    periodStartsAt: null,
    subscriptionId: "sub_1",
    customerId: "cus_1",
    preserveBillingDates: false,
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
    periodStartsAt: null,
    subscriptionId: "sub_1",
    customerId: "cus_1",
    preserveBillingDates: false,
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
    event("checkout.session.completed", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
      customer: "cus_1",
    }),
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

test("a checkout that completed without the money moving grants nothing", () => {
  // Delayed-notification methods complete the session with payment_status
  // 'unpaid' hours before the debit succeeds or fails. Granting Pro here is
  // fulfilment before payment, and this endpoint does not subscribe to the
  // async payment events, so nothing would correct it.
  for (const payment_status of ["unpaid", "no_payment_required_typo", undefined, null]) {
    const change = planChangeFromEvent(
      event("checkout.session.completed", {
        id: "cs_1",
        status: "complete",
        payment_status,
        client_reference_id: USER,
        customer: "cus_1",
        subscription: "sub_1",
      }),
    );
    assert.equal(change, null, String(payment_status));
  }
});

test("a free trial checkout with nothing to charge is still honoured", () => {
  const change = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      status: "complete",
      payment_status: "no_payment_required",
      client_reference_id: USER,
      customer: "cus_1",
      subscription: "sub_1",
    }),
  );
  assert.equal(change?.plan, "pro");
});

test("a paid session that is not complete grants nothing", () => {
  const change = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      status: "expired",
      payment_status: "paid",
      client_reference_id: USER,
      customer: "cus_1",
    }),
  );
  assert.equal(change, null);
});

test("a delayed payment that later succeeds grants Pro", () => {
  // Bank debits and several wallets close the session before the money moves.
  // Without this event the player has paid and is still on Free until some
  // later subscription event happens to land.
  const change = planChangeFromEvent(
    event("checkout.session.async_payment_succeeded", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
      client_reference_id: USER,
      customer: "cus_1",
      subscription: "sub_1",
    }),
  );
  assert.equal(change?.plan, "pro");
  assert.equal(change?.customerId, "cus_1");
  assert.equal(change?.subscriptionId, "sub_1");
});

test("a delayed payment that later fails grants nothing", () => {
  const change = planChangeFromEvent(
    event("checkout.session.async_payment_failed", {
      id: "cs_1",
      status: "complete",
      payment_status: "unpaid",
      client_reference_id: USER,
      customer: "cus_1",
    }),
  );
  assert.equal(change, null);
});

test("the checkout rule is payment_status, not the event name", () => {
  // The same unsettled session must be refused whichever of the three checkout
  // events carries it, and the same settled session accepted. That is what lets
  // a payment method nobody has tested behave correctly the first time.
  for (const type of [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]) {
    const unsettled = planChangeFromEvent(
      event(type, {
        id: "cs_1",
        status: "complete",
        payment_status: "unpaid",
        client_reference_id: USER,
        customer: "cus_1",
      }),
    );
    assert.equal(unsettled, null, `${type} unsettled`);

    const settled = planChangeFromEvent(
      event(type, {
        id: "cs_1",
        status: "complete",
        payment_status: "paid",
        client_reference_id: USER,
        customer: "cus_1",
      }),
    );
    assert.equal(settled?.plan, "pro", `${type} settled`);
  }
});

test("a settled checkout asks the writer to keep any stored billing dates", () => {
  // The completed event deliberately carries no billing dates (a session has
  // an expiry, not a period), while the subscription event in the same
  // purchase burst carries both. Stripe's `created` has one-second
  // granularity and delivery is unordered, so whenever the completed event
  // sorts equal-or-later, writing its nulls through would blank the anchor
  // the subscription event just stored and drop the window back to the
  // calendar month for up to a month. The flag tells the route: coalesce
  // these nulls from the stored row instead of writing them.
  const completed = planChangeFromEvent(
    event("checkout.session.completed", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
      client_reference_id: USER,
      customer: "cus_1",
      subscription: "sub_1",
    }),
  );
  assert.equal(completed?.preserveBillingDates, true);

  const settledLater = planChangeFromEvent(
    event("checkout.session.async_payment_succeeded", {
      id: "cs_1",
      status: "complete",
      payment_status: "paid",
      client_reference_id: USER,
      customer: "cus_1",
    }),
  );
  assert.equal(settledLater?.preserveBillingDates, true);

  // A subscription event's dates are the truth and write through as read.
  const updated = planChangeFromEvent(
    event(
      "customer.subscription.updated",
      subscription({ status: "active", metadata: { user_id: USER } }),
    ),
  );
  assert.equal(updated?.preserveBillingDates, false);

  // A deletion's nulls are the message: there is no next renewal to keep.
  const deleted = planChangeFromEvent(
    event("customer.subscription.deleted", subscription({ metadata: { user_id: USER } })),
  );
  assert.equal(deleted?.preserveBillingDates, false);
});

test("the period start is read from the event, never derived from the renewal", () => {
  // A month-end anchor is the case that exposed this: February's renewal is
  // the 28th, and the period genuinely began on January 31. Subtracting a
  // month from the renewal gives January 28, three days early, which would
  // count the tail of the previous period against the new one.
  const feb = planChangeFromEvent({
    type: "customer.subscription.updated",
    created: 1_767_000_000,
    data: {
      object: {
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        // 2027-01-31 and 2027-02-28 UTC.
        current_period_start: 1_801_440_000,
        current_period_end: 1_803_859_200,
        metadata: { user_id: "11111111-1111-1111-1111-111111111111" },
      },
    },
  });
  assert.equal(feb?.periodStartsAt, new Date(1_801_440_000 * 1000).toISOString());
  assert.equal(feb?.renewsAt, new Date(1_803_859_200 * 1000).toISOString());
  // The two are independent readings, not one computed from the other.
  assert.notEqual(feb?.periodStartsAt, null);

  // Newer API versions carry both on the item rather than the subscription,
  // exactly as the renewal already handled.
  const onItem = planChangeFromEvent({
    type: "customer.subscription.updated",
    created: 1_767_000_000,
    data: {
      object: {
        id: "sub_2",
        status: "active",
        customer: "cus_2",
        items: {
          data: [
            {
              current_period_start: 1_801_440_000,
              current_period_end: 1_803_859_200,
            },
          ],
        },
        metadata: { user_id: "11111111-1111-1111-1111-111111111111" },
      },
    },
  });
  assert.equal(onItem?.periodStartsAt, new Date(1_801_440_000 * 1000).toISOString());

  // An event that carries no period leaves it null rather than guessing one.
  const bare = planChangeFromEvent({
    type: "customer.subscription.deleted",
    created: 1_767_000_000,
    data: { object: { id: "sub_3", customer: "cus_3", status: "canceled" } },
  });
  assert.equal(bare?.periodStartsAt, null);
});
