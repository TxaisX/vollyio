// Request assembly for the payment provider's two hosted pages.
//
// The failures these pin down are all silent ones: a body that carries both
// `customer` and `customer_email` is rejected outright, a body that carries
// `customer_email` for a player who already has a customer record opens a
// second record and splits their billing history, and a body missing the
// subscription metadata leaves later subscription events with no user to
// resolve. None of that shows up until money has moved.
//
// Only the pure builders are exercised. The network path is fetch plus status
// checks, which is framework glue, and neither builder needs a key.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";

// lib/stripe.ts is `server-only`, and that marker package is supplied by the
// framework's bundler rather than installed into node_modules, so a plain node
// import of it cannot resolve. Stubbing the specifier lets these assertions run
// against the REAL builders instead of against a copy that can drift from them.
// Cast because the installed @types/node predates `registerHooks`.
type ResolveResult = { url: string; shortCircuit?: boolean };
type ModuleHooks = {
  resolve(
    specifier: string,
    context: unknown,
    next: (specifier: string, context: unknown) => ResolveResult,
  ): ResolveResult;
};
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: ModuleHooks) => void;
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const { buildCheckoutBody, buildPortalBody } = await import("./stripe.ts");

const PRICE = "price_test_pro_monthly";
const USER = "3f2a1c44-0d1e-4a7b-9c33-8a6b5d4e2f10";
const BASE = {
  userId: USER,
  successUrl: "https://vollyio.com/settings#plan",
  cancelUrl: "https://vollyio.com/settings#plan",
};

function fields(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

test("a checkout body carries every param the subscription needs", () => {
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  assert.equal(f.get("mode"), "subscription");
  assert.equal(f.get("line_items[0][price]"), PRICE);
  assert.equal(f.get("line_items[0][quantity]"), "1");
  assert.equal(f.get("success_url"), "https://vollyio.com/settings#plan");
  assert.equal(f.get("cancel_url"), "https://vollyio.com/settings#plan");
  assert.equal(f.get("client_reference_id"), USER);
  assert.equal(f.get("metadata[user_id]"), USER);
});

test("the user id is stamped on the subscription, not only on the session", () => {
  // A subscription.updated or .deleted event arrives with a subscription and a
  // customer, never the session. Without this the webhook has nothing to fall
  // back on when the customer id lookup misses, which is exactly the case where
  // a player has paid and the app cannot tell whose account to change.
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  assert.equal(f.get("subscription_data[metadata][user_id]"), USER);
});

test("a first-time upgrade sends the email and no customer", () => {
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  assert.equal(f.get("customer_email"), "player@example.test");
  assert.equal(f.has("customer"), false);
});

test("a returning player sends the customer and no email", () => {
  const f = fields(
    buildCheckoutBody({ ...BASE, customerId: "cus_existing", email: "player@example.test" }, PRICE),
  );
  assert.equal(f.get("customer"), "cus_existing");
  assert.equal(
    f.has("customer_email"),
    false,
    "sending both is rejected, and the email alone would open a second customer record",
  );
});

test("a blank customer id counts as no customer, not as a customer", () => {
  // formEncode drops null and undefined but happily sends an empty string, and
  // `customer=` is a 400 that reads like an outage.
  for (const customerId of ["", "   ", null, undefined]) {
    const f = fields(buildCheckoutBody({ ...BASE, customerId, email: "player@example.test" }, PRICE));
    assert.equal(f.has("customer"), false, JSON.stringify(customerId));
    assert.equal(f.get("customer_email"), "player@example.test");
  }
});

test("with neither a customer nor an email, neither key is sent at all", () => {
  // The hosted page collects the address itself. Sending an empty one instead
  // would fail the request outright.
  const body = buildCheckoutBody({ ...BASE, customerId: null, email: null }, PRICE);
  const f = fields(body);
  assert.equal(f.has("customer"), false);
  assert.equal(f.has("customer_email"), false);
  assert.equal(/undefined|null/.test(body), false, body);
});

test("checkout never emits both customer keys, whatever it is handed", () => {
  const customerIds = [undefined, null, "", "  ", "cus_existing"];
  const emails = [undefined, null, "", "  ", "player@example.test"];
  for (const customerId of customerIds) {
    for (const email of emails) {
      const f = fields(buildCheckoutBody({ ...BASE, customerId, email }, PRICE));
      assert.ok(
        !(f.has("customer") && f.has("customer_email")),
        `both sent for customerId=${JSON.stringify(customerId)} email=${JSON.stringify(email)}`,
      );
    }
  }
});

test("return urls survive encoding with their query and fragment intact", () => {
  const f = fields(
    buildCheckoutBody(
      {
        ...BASE,
        successUrl: "https://vollyio.com/settings?checkout=done&x=1#plan",
        email: "player+tag@example.test",
      },
      PRICE,
    ),
  );
  assert.equal(f.get("success_url"), "https://vollyio.com/settings?checkout=done&x=1#plan");
  // A raw `+` in a form body decodes as a space, which would send the upgrade
  // confirmation to an address the player never typed.
  assert.equal(f.get("customer_email"), "player+tag@example.test");
});

test("the plan settings body is the customer and the return url and nothing else", () => {
  const body = buildPortalBody({
    customerId: "cus_existing",
    returnUrl: "https://vollyio.com/settings#plan",
  });
  const f = fields(body);
  assert.equal(f.get("customer"), "cus_existing");
  assert.equal(f.get("return_url"), "https://vollyio.com/settings#plan");
  assert.deepEqual([...f.keys()].sort(), ["customer", "return_url"]);
});
