import "server-only";
import { formEncode } from "./stripe-sign.ts";
import { SITE_URL } from "./site.ts";
import { DEFAULT_OFFER, OFFERS, renewalSentence, type Offer, type OfferKey } from "./offers.ts";

// Shown next to the pay button on the hosted page. Built from the OFFER rather
// than from a single hardcoded cadence, because the same field now has to
// describe a weekly charge as well as a monthly one, and the sentence that says
// "each month" over a $7.99 weekly subscription is a false renewal disclosure
// on the one page where the card is actually taken. Kept inside the provider's
// 1200-character limit for this field.
function subscriptionTermsMessage(offer: Offer): string {
  return `${renewalSentence(offer)} Full terms: ${SITE_URL}/terms`;
}

// Recorded assent: a checkbox the player must tick before the provider will
// take the payment, which turns the terms page's "you agreed to this when you
// checked out" from an assertion into a record. After checkout the session
// carries `consent.terms_of_service = "accepted"`.
//
// It is a SWITCH and not a hardcoded parameter for one reason. The provider
// requires a Terms of Service URL configured in its own dashboard before it
// will accept this field, that setting is dashboard-only with no API to write
// or even read it, and if the URL is absent the session creation FAILS. A
// hardcoded flip would therefore take checkout down for everyone the moment it
// deployed, on a prerequisite nothing in this repo can verify.
//
// So: set the URL at dashboard.stripe.com/settings/public, set
// STRIPE_TOS_CONSENT=true, and if sessions start failing, unset it. Recovery is
// an env change rather than a revert-and-redeploy, which matters because the
// failure mode is "nobody can pay".
const TOS_CONSENT_ENABLED = process.env.STRIPE_TOS_CONSENT === "true";

// Shown beside the checkbox. The markdown link is the provider's own supported
// syntax for pointing at your real terms rather than its generic wording.
const TOS_ACCEPTANCE_MESSAGE = `I agree to the [Terms of Service](${SITE_URL}/terms)`;

// The network half of the payment provider integration: the two POSTs that mint
// a hosted page, and the only place in the codebase that reads the API key.
// Built on `fetch` plus the pure encoder in lib/stripe-sign.ts rather than a
// vendor SDK, because two endpoints and one HMAC do not justify a dependency
// (AGENTS.md, D-001 section 10.5).
//
// `server-only` is what turns "do not import this from a client component" from
// a review comment into a build error. The live key is one careless import away
// from a browser bundle otherwise.
//
// Deliberately NO retry loop, in either direction. A retried checkout POST
// opens a SECOND session for the same player, and if they then pay from the
// stale tab the app has a subscription it never expected; a retried portal POST
// is pure latency in front of a page the player can simply reopen. The provider
// is the system of record in both cases, so failing fast and letting the player
// press the button again is safer than retrying on their behalf.

const API_BASE = "https://api.stripe.com/v1";

// A provider that accepts the connection and then stalls would otherwise hold a
// serverless invocation open until the platform kills it, billing for the whole
// stall and leaving the player on a spinner for the whole stall.
const REQUEST_TIMEOUT_MS = 10_000;

// Read at call time rather than at module load so a deploy that adds the keys
// does not need a cold start to notice them, and so `stripeConfigured()` never
// answers from a snapshot taken before the environment was complete.
function secretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

// One env var per offer, resolved at call time for the same reason the key is.
//
// There is deliberately NO fallback to the old single `STRIPE_PRICE_ID`. That
// variable points at a price that was found ARCHIVED on 2026-08-12, and an
// archived price cannot back a checkout session: falling back to it would turn
// "this deployment has not been configured yet" into "the button 502s and the
// log blames the provider". A missing offer var has to be loud.
function priceIdFor(offer: OfferKey): string | null {
  return process.env[OFFERS[offer].envVar]?.trim() || null;
}

// Exported so the webhook route reads the endpoint secret from here instead of
// touching `process.env` itself, keeping every provider credential behind this
// one server-only module. Null when unset, which the verifier already treats as
// "nothing can verify" rather than "skip verification".
export const WEBHOOK_SECRET: string | null =
  process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;

// All three or nothing, because this predicate is what decides whether a player
// is shown a working upgrade button.
//
// A key without a price can authenticate a request that has nothing to sell.
// Worse, a key and a price without an endpoint secret can take the money and
// then never deliver: every webhook fails verification, `set_subscription_plan`
// is never called, the plan stays free, and `stripe_customer_id` is never
// recorded, so the player cannot even reach the portal to cancel what they are
// being charged for. A missing env var has to deny the sale, not permit it.
// The DEFAULT offer is the one that has to exist, not all of them. A deployment
// that has the monthly price but not the weekly can still sell; the picker just
// shows one choice. Requiring all three would mean a half-configured
// environment renders no button at all, which is the harsher failure and the
// one D-029 exists to avoid.
export function stripeConfigured(): boolean {
  return secretKey() !== null && priceIdFor(DEFAULT_OFFER) !== null && WEBHOOK_SECRET !== null;
}

/** Which offers this deployment can actually charge for, in picker order. */
export function availableOffers(): OfferKey[] {
  return (Object.keys(OFFERS) as OfferKey[]).filter(
    (key) => OFFERS[key].selectable && priceIdFor(key) !== null,
  );
}

/**
 * Whether the exit-intent offer can be charged.
 *
 * Separate from `availableOffers` because the downsell is not selectable and so
 * is filtered out of it by design. Without this the modal would render on a
 * deployment with no downsell price and every click would 502.
 */
export function downsellConfigured(): boolean {
  return priceIdFor("downsell") !== null;
}

export type SessionResult = { ok: true; url: string } | { ok: false; error: string };

export type CheckoutInput = {
  userId: string;
  email?: string | null;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
  // Which shape of Pro is being bought. The ROUTE decides this from an
  // allowlisted key, never from an amount the caller sent: the client picks
  // which of our offers it wants, and the server alone maps that to a price.
  offer: OfferKey;
};

export type PortalInput = {
  customerId: string;
  returnUrl: string;
};

// Short, non-vendor, and identical across every failure mode on purpose. What
// actually went wrong is in the server log; a player can do nothing with "no
// such price" except learn the name of a company they never dealt with.
const CHECKOUT_UNAVAILABLE = "Checkout isn't available right now. Please try again in a moment.";
const PORTAL_UNAVAILABLE = "Plan settings aren't available right now. Please try again in a moment.";

function trimmed(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

/**
 * Pure request assembly for a subscription checkout, exported so it can be
 * asserted without a network or a key.
 *
 * `customer` and `customer_email` are mutually exclusive. Sending both is
 * rejected outright, and sending an email for a player who already has a
 * customer record opens a second one, which silently splits their billing
 * history and leaves later subscription events pointing at the wrong half. A
 * known customer id therefore always wins, and an empty string counts as no id
 * rather than as an id, because `formEncode` only drops null and undefined.
 */
export function buildCheckoutBody(input: CheckoutInput, price: string): string {
  const customer = trimmed(input.customerId);
  const email = customer ? null : trimmed(input.email);

  return formEncode({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    customer,
    customer_email: email,
    metadata: { user_id: input.userId },
    // The renewal terms, stated on the page where the money is actually taken.
    // Until this existed, neither purchase surface disclosed recurrence or
    // linked the terms, so a parent could complete an auto-renewing charge
    // having been shown neither.
    //
    // This is `custom_text` and not `consent_collection[terms_of_service]`
    // deliberately. The recorded-checkbox version is stronger and is the thing
    // to move to, but it requires a Terms of Service URL configured in the
    // provider's own dashboard, and if that URL is absent the session creation
    // ERRORS, which would take checkout down entirely rather than degrade. That
    // setting cannot be written through the API. So: disclose unconditionally
    // now, and switch to recorded consent once the dashboard URL is set. See
    // docs/billing-runbook.md.
    "custom_text[submit][message]": subscriptionTermsMessage(OFFERS[input.offer]),
    // Both null when the switch is off, and `formEncode` drops null, so the
    // shipped body is byte-identical to the pre-toggle one until it is turned
    // on. The disclosure above is unconditional either way: the checkbox
    // upgrades assent from stated to recorded, it does not carry the terms.
    "consent_collection[terms_of_service]": TOS_CONSENT_ENABLED ? "required" : null,
    "custom_text[terms_of_service_acceptance][message]": TOS_CONSENT_ENABLED
      ? TOS_ACCEPTANCE_MESSAGE
      : null,
    // Subscription events (updated, deleted, payment failed) arrive carrying a
    // subscription, not the session that created it. Stamping the user id onto
    // the subscription itself gives the webhook a second way to resolve the
    // account when the customer id lookup misses, which is precisely the case
    // where a player has paid and the app cannot tell who they are.
    subscription_data: { metadata: { user_id: input.userId } },
  });
}

/** Pure request assembly for the management page. Two params, no metadata. */
export function buildPortalBody(input: PortalInput): string {
  return formEncode({ customer: input.customerId, return_url: input.returnUrl });
}

// No response body the provider sends is ever logged verbatim, and this is why.
// The provider's error object carries a human `message`, and that message
// quotes the value that was rejected back at you: "Invalid email address:
// <what was sent>", "No such customer: 'cus_...'". The rejection most likely to
// fire here is the one whose message holds the player's email address, so
// logging the raw body would write that address into the server log on the
// single most common failure. These three fields name WHAT failed and never
// carry the value that failed, which is all diagnosis needs.
const ERROR_FIELDS = ["type", "code", "param"] as const;

// Even those three are the provider's strings, not ours, and an unbounded
// field would let one bad response write an arbitrarily long log line.
const ERROR_FIELD_MAX = 64;

function describeProviderError(payload: string): string {
  let error: unknown;
  try {
    error = (JSON.parse(payload) as { error?: unknown }).error;
  } catch {
    return "error body was not JSON";
  }
  if (typeof error !== "object" || error === null) {
    return "error body carried no error object";
  }

  const fields = error as Record<string, unknown>;
  const parts: string[] = [];
  for (const field of ERROR_FIELDS) {
    const value = fields[field];
    if (typeof value === "string" && value) {
      parts.push(`${field}=${value.slice(0, ERROR_FIELD_MAX)}`);
    }
  }
  return parts.length > 0 ? parts.join(" ") : "error object named no type, code, or param";
}

// Every path out of here that is not a 2xx carrying a usable https URL returns
// {ok:false}. An unreachable provider, a rejected request, an unparseable body,
// and a 200 with no url all mean the same thing to the caller: there is no page
// to send the player to.
async function createSession(
  path: string,
  body: string,
  label: string,
  playerMessage: string,
): Promise<SessionResult> {
  const secret = secretKey();
  if (!secret) {
    console.error(`[billing] ${label} skipped: no API key is configured`);
    return { ok: false, error: playerMessage };
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Covers DNS, TLS, connection resets, and the abort above. `cause` is a
    // transport failure; the request body is not passed to the logger here or
    // anywhere else in this module, because it holds the player's email.
    console.error(`[billing] ${label} request failed`, cause);
    return { ok: false, error: playerMessage };
  }

  let payload: string;
  try {
    payload = await response.text();
  } catch (cause) {
    console.error(`[billing] ${label} response could not be read`, cause);
    return { ok: false, error: playerMessage };
  }

  if (!response.ok) {
    // Structured fields only, never the provider's prose. See
    // `describeProviderError`: the raw body echoes the rejected value back, and
    // on the likeliest rejection that value is the player's email address.
    const detail = describeProviderError(payload);
    console.error(`[billing] ${label} returned ${response.status}: ${detail}`);
    return { ok: false, error: playerMessage };
  }

  let url: unknown;
  try {
    url = (JSON.parse(payload) as { url?: unknown }).url;
  } catch {
    console.error(`[billing] ${label} returned a body that is not JSON`);
    return { ok: false, error: playerMessage };
  }

  // A 2xx with no url, or with one that is not https, is a redirect target this
  // module cannot vouch for. Refusing costs the player one button press;
  // honoring it would navigate them wherever that string happens to point.
  if (typeof url !== "string" || !url.startsWith("https://")) {
    console.error(`[billing] ${label} returned no usable url`);
    return { ok: false, error: playerMessage };
  }

  return { ok: true, url };
}

export async function createCheckoutSession(input: CheckoutInput): Promise<SessionResult> {
  const price = priceIdFor(input.offer);
  if (!price) {
    // Named, because with three offers "no price is configured" no longer says
    // which env var is missing, and the whole point of the loud failure above
    // is that the log tells you what to set.
    console.error(`[billing] checkout skipped: ${OFFERS[input.offer].envVar} is not set`);
    return { ok: false, error: CHECKOUT_UNAVAILABLE };
  }
  return createSession(
    "/checkout/sessions",
    buildCheckoutBody(input, price),
    "checkout",
    CHECKOUT_UNAVAILABLE,
  );
}

export async function createPortalSession(input: PortalInput): Promise<SessionResult> {
  // An empty customer id would ask the provider to open a management page for
  // nobody, and the 400 that comes back reads like an outage rather than like
  // the caller passing a blank string.
  const customerId = trimmed(input.customerId);
  if (!customerId) {
    console.error("[billing] portal skipped: no customer id");
    return { ok: false, error: PORTAL_UNAVAILABLE };
  }
  return createSession(
    "/billing_portal/sessions",
    buildPortalBody({ customerId, returnUrl: input.returnUrl }),
    "plan settings",
    PORTAL_UNAVAILABLE,
  );
}
