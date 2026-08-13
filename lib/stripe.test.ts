// Request assembly and response handling for the payment provider's two hosted
// pages.
//
// The failures these pin down are all silent ones: a body that carries both
// `customer` and `customer_email` is rejected outright, a body that carries
// `customer_email` for a player who already has a customer record opens a
// second record and splits their billing history, and a body missing the
// subscription metadata leaves later subscription events with no user to
// resolve. None of that shows up until money has moved.
//
// The second half of the file drives the response path, which is not glue: it
// decides where a player's browser is sent, and it decides what reaches the
// server log when the provider refuses. Both are exercised against a scripted
// fetch, so no key and no network are involved.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
// Type-only, so this does not resolve the server-only module before the hook
// below is registered.
import type { SessionResult } from "./stripe.ts";

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

const { buildCheckoutBody, buildPortalBody, createCheckoutSession } = await import("./stripe.ts");

const PRICE = "price_test_pro_monthly";
const USER = "3f2a1c44-0d1e-4a7b-9c33-8a6b5d4e2f10";
const BASE = {
  userId: USER,
  successUrl: "https://vollyio.com/settings#plan",
  cancelUrl: "https://vollyio.com/settings#plan",
  // Every existing case was written against the single monthly price, so the
  // default offer keeps them asserting exactly what they asserted before. The
  // cadence-specific behaviour is covered separately at the end of this file.
  offer: "monthly" as const,
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

// The response path. The module reads its environment at call time and calls
// the global fetch, so both can be replaced here and the REAL createSession
// runs, including the https guard that decides where a player is navigated.

const SECRET = "sk_test_not_a_real_key";
const EMAIL = "player@example.test";

type ProviderRequest = { url: string; body: string; authorization: string | null };
type Seen = { requests: ProviderRequest[]; log: () => string };

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

// The global fetch, console.error, and both env vars are restored in a finally
// on every path, because a test that leaks any of them stops testing itself and
// starts deciding whichever test runs next.
async function withProvider(
  respond: (request: ProviderRequest) => Response | Promise<Response>,
  run: (seen: Seen) => Promise<void>,
): Promise<void> {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const realKey = process.env.STRIPE_SECRET_KEY;
  const realPrice = process.env.STRIPE_PRICE_MONTHLY;

  const requests: ProviderRequest[] = [];
  const lines: string[] = [];

  process.env.STRIPE_SECRET_KEY = SECRET;
  process.env.STRIPE_PRICE_MONTHLY = PRICE;
  globalThis.fetch = async (input, init) => {
    const request = {
      url: String(input),
      body: String(init?.body ?? ""),
      authorization: new Headers(init?.headers).get("authorization"),
    };
    requests.push(request);
    return respond(request);
  };
  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "));
  };

  try {
    await run({ requests, log: () => lines.join("\n") });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    restoreEnv("STRIPE_SECRET_KEY", realKey);
    restoreEnv("STRIPE_PRICE_MONTHLY", realPrice);
  }
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Asserts the call refused and hands back the message the player would see. */
function refusal(result: SessionResult): string {
  assert.equal(result.ok, false, `expected a refusal, got ${JSON.stringify(result)}`);
  return result.ok ? "" : result.error;
}

test("a well-formed https url is returned, and the key rides in the header", async () => {
  await withProvider(
    () => jsonResponse({ id: "cs_test_1", url: "https://pay.example.test/c/cs_test_1" }, 200),
    async ({ requests }) => {
      const result = await createCheckoutSession({ ...BASE, email: EMAIL });
      assert.deepEqual(result, { ok: true, url: "https://pay.example.test/c/cs_test_1" });

      assert.equal(requests.length, 1, "no retry: a second POST opens a second session");
      assert.equal(requests[0].authorization, `Bearer ${SECRET}`);
      // The price comes from the server environment, never from the caller.
      assert.equal(fields(requests[0].body).get("line_items[0][price]"), PRICE);
      assert.equal(fields(requests[0].body).get("client_reference_id"), USER);
      assert.equal(requests[0].url.includes(SECRET), false, "the key belongs in the header only");
    },
  );
});

test("a refusal is logged as structured fields, never as the provider's prose", async () => {
  // The rejection most likely to fire quotes the value it refused straight back
  // ("Invalid email address: ..."), and that value is the player's address. So
  // a log line carrying the provider's prose carries that address into wherever
  // the logs are aggregated, on the commonest failure this call has.
  await withProvider(
    () =>
      jsonResponse(
        {
          error: {
            type: "invalid_request_error",
            code: "email_invalid",
            param: "customer_email",
            message: `Invalid email address: ${EMAIL}`,
            doc_url: "https://docs.example.test/error-codes#email-invalid",
          },
        },
        402,
      ),
    async ({ log }) => {
      const message = refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(message, /Checkout isn't available/, "the player sees one calm line");

      const logged = log();
      assert.doesNotMatch(logged, /player@example\.test/, "the address must not reach the log");
      assert.doesNotMatch(logged, /Invalid email address/);
      assert.match(logged, /402/, "the status is what makes the line diagnosable");
      assert.match(logged, /type=invalid_request_error/);
      assert.match(logged, /code=email_invalid/);
      assert.match(logged, /param=customer_email/);
    },
  );
});

test("a refusal that cannot be parsed logs the status and a fixed string", async () => {
  // An edge or gateway between here and the provider answers in HTML, and a
  // provider error carrying only prose is prose about a rejected value.
  await withProvider(
    () => new Response("<html>Bad gateway: cus_1234567890 not found</html>", { status: 502 }),
    async ({ log }) => {
      refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(log(), /502/);
      assert.match(log(), /not JSON/);
      assert.doesNotMatch(log(), /cus_1234567890/);
    },
  );

  await withProvider(
    () => jsonResponse({ error: { message: "No such customer: 'cus_1234567890'" } }, 400),
    async ({ log }) => {
      refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(log(), /400/);
      assert.match(log(), /no type, code, or param/);
      assert.doesNotMatch(log(), /cus_1234567890/);
    },
  );
});

test("a 200 that is not JSON is a refusal, not a crash", async () => {
  await withProvider(
    () => new Response("<html>maintenance</html>", { status: 200 }),
    async ({ log }) => {
      const message = refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(message, /Checkout isn't available/);
      assert.match(log(), /not JSON/);
    },
  );
});

test("a 200 carrying no url is a refusal", async () => {
  await withProvider(
    () => jsonResponse({ id: "cs_test_2", object: "checkout.session" }, 200),
    async ({ log }) => {
      refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(log(), /no usable url/);
    },
  );
});

test("a 200 whose url is anything but an https string is refused", async () => {
  // This is the open-redirect guard, and it is the reason this branch is worth
  // a test at all: the caller navigates the player's browser to whatever string
  // comes back here, so anything this accepts is somewhere a player can be sent.
  for (const url of [
    "http://pay.example.test/c/cs_1",
    "javascript:alert(document.cookie)",
    "//evil.example.test/c/cs_1",
    "data:text/html,<script>1</script>",
    "https:/pay.example.test",
    " https://pay.example.test/c/cs_1",
    "HTTPS://pay.example.test/c/cs_1",
  ]) {
    await withProvider(
      () => jsonResponse({ id: "cs_test_3", url }, 200),
      async ({ log }) => {
        const message = refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
        assert.match(message, /Checkout isn't available/, url);
        assert.match(log(), /no usable url/, url);
      },
    );
  }

  for (const url of [null, 42, { href: "https://pay.example.test" }, ""]) {
    await withProvider(
      () => jsonResponse({ id: "cs_test_4", url }, 200),
      async () => {
        refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      },
    );
  }
});

test("a provider that never answers refuses instead of throwing", async () => {
  // The real ten-second abort lands in the same catch as any transport failure,
  // and the player is waiting on this call, so it has to resolve to a refusal
  // rather than propagate into the route.
  await withProvider(
    () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      });
    },
    async ({ log }) => {
      const message = refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.match(message, /Checkout isn't available/);
      assert.match(log(), /request failed/);
      assert.doesNotMatch(log(), /player@example\.test/, "the body never reaches the log");
    },
  );
});

test("with no price configured, nothing is sent at all", async () => {
  await withProvider(
    () => jsonResponse({ url: "https://pay.example.test/c/cs_1" }, 200),
    async ({ requests, log }) => {
      delete process.env.STRIPE_PRICE_MONTHLY;
      refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.equal(requests.length, 0, "a missing env var denies before the request");
      // The log NAMES the variable. With one price "no price is configured"
      // was unambiguous; with three it would leave the operator guessing which
      // of them to set, and this refusal is the only signal they get.
      assert.match(log(), /STRIPE_PRICE_MONTHLY is not set/);
    },
  );
});

test("with no key configured, nothing is sent at all", async () => {
  await withProvider(
    () => jsonResponse({ url: "https://pay.example.test/c/cs_1" }, 200),
    async ({ requests, log }) => {
      delete process.env.STRIPE_SECRET_KEY;
      refusal(await createCheckoutSession({ ...BASE, email: EMAIL }));
      assert.equal(requests.length, 0);
      assert.match(log(), /no API key is configured/);
    },
  );
});

// The hosted page is where the money is actually taken, and until D-069 it was
// the one surface that disclosed neither that the charge recurs nor how to stop
// it. A parent could complete an auto-renewing purchase having been shown
// neither fact on either surface. These pin the disclosure to the same
// constants the charge is built from, so it cannot drift from the real price.
test("the checkout page discloses recurrence, cancellation and the terms", () => {
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  const message = f.get("custom_text[submit][message]") ?? "";
  assert.match(message, /renews automatically/i, "no renewal disclosure");
  assert.match(message, /cancel any time/i, "no cancellation route");
  assert.match(message, /not refunded/i, "no refund posture");
  assert.match(message, /\/terms/, "no link to the terms");
});

test("the disclosed price and allowance are the ones actually charged", async () => {
  const { PRO_PRICE_LABEL, MONTHLY_ALLOWANCE } = await import("./plans.ts");
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  const message = f.get("custom_text[submit][message]") ?? "";
  assert.ok(
    message.includes(PRO_PRICE_LABEL),
    "the page quotes a price that is not the plan constant",
  );
  assert.ok(
    message.includes(String(MONTHLY_ALLOWANCE.pro)),
    "the page quotes an allowance that is not the plan constant",
  );
});

// The provider's limit on this field is 1200 characters; exceeding it fails the
// session creation, which would take checkout down rather than degrade it.
test("the disclosure fits inside the provider's field limit", () => {
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  assert.ok((f.get("custom_text[submit][message]") ?? "").length <= 1200);
});

// The recorded-consent checkbox is behind STRIPE_TOS_CONSENT because the
// provider rejects the field unless a Terms of Service URL is set in its
// dashboard, that setting has no API, and a rejected session means nobody can
// pay. These pin both postures so the switch cannot silently invert.
test("without the switch, no consent field is sent at all", () => {
  const f = fields(buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE));
  assert.equal(f.has("consent_collection[terms_of_service]"), false);
  assert.equal(f.has("custom_text[terms_of_service_acceptance][message]"), false);
  // The disclosure is unconditional and must survive the switch being off.
  assert.match(f.get("custom_text[submit][message]") ?? "", /renews automatically/i);
});

test("with the switch on, the checkbox is required and points at our own terms", async () => {
  const previous = process.env.STRIPE_TOS_CONSENT;
  process.env.STRIPE_TOS_CONSENT = "true";
  try {
    // Fresh module instance: the flag is read once at load, and the ESM cache
    // would otherwise hand back the copy loaded with the flag unset. The
    // specifier is built as a variable rather than written inline because a
    // literal query suffix is not a path the type checker can resolve.
    const freshSpecifier = "./stripe.ts" + "?tos-consent-on";
    const mod = (await import(freshSpecifier)) as {
      buildCheckoutBody: typeof buildCheckoutBody;
    };
    const f = fields(
      mod.buildCheckoutBody({ ...BASE, email: "player@example.test" }, PRICE),
    );
    assert.equal(f.get("consent_collection[terms_of_service]"), "required");
    const label = f.get("custom_text[terms_of_service_acceptance][message]") ?? "";
    // Scheme-agnostic: SITE_URL is http://localhost in test and https in prod.
    assert.match(label, /\[Terms of Service\]\(https?:\/\/[^)]+\/terms\)/, "no markdown terms link");
    // Turning the checkbox on must not drop the renewal disclosure.
    assert.match(f.get("custom_text[submit][message]") ?? "", /renews automatically/i);
  } finally {
    if (previous === undefined) delete process.env.STRIPE_TOS_CONSENT;
    else process.env.STRIPE_TOS_CONSENT = previous;
  }
});
