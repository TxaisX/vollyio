// The pure half of Google Play Billing (D-125): product catalog, the read of
// a subscriptionsv2 resource, and the RTDN envelope decode. No IO here, so
// every decision that grants or removes a plan is testable without Google.
//
// The IO half (service-account token, the androidpublisher fetches) lives in
// lib/play-api.ts behind server-only.

/**
 * The purchasable shapes of Pro on Play, mirroring lib/offers.ts: every
 * product grants the SAME plan, `pro`, and they differ only in billing
 * period. The ids are created by hand in Play Console and are permanent, so
 * they are named like the offers rather than like prices.
 *
 * No downsell on Play on purpose: the exit-intent surface is a desktop
 * mouseout, which does not exist in an app.
 */
export const PLAY_PRODUCT_IDS = ["pro_weekly", "pro_monthly"] as const;
export type PlayProductId = (typeof PLAY_PRODUCT_IDS)[number];

export function isPlayProductId(value: unknown): value is PlayProductId {
  return typeof value === "string" && (PLAY_PRODUCT_IDS as readonly string[]).includes(value);
}

/**
 * A Play purchase token, syntactically. Long opaque base64ish strings; the
 * bound exists so a hostile body cannot make the server relay megabytes to
 * Google inside a URL.
 */
export function isPurchaseToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 512 &&
    /^[A-Za-z0-9._-]+$/.test(value)
  );
}

/** The marker this integration writes into the subscription id column, so a
 *  Play subscription is distinguishable from a Stripe one at a glance and the
 *  RTDN handler can find the account a token belongs to. */
export function playSubscriptionMarker(purchaseToken: string): string {
  return `play:${purchaseToken}`;
}

export function isPlaySubscriptionId(subscriptionId: string | null | undefined): boolean {
  return typeof subscriptionId === "string" && subscriptionId.startsWith("play:");
}

export type PlaySubscriptionRead = {
  /** Whether the player is entitled to Pro RIGHT NOW. Canceled-but-paid-up
   *  counts: Play's CANCELED means auto-renew is off, not that the paid
   *  period is over. */
  entitled: boolean;
  productId: string | null;
  /** ISO instant the current paid period ends, from the line item. */
  expiryTime: string | null;
  /** ISO instant the subscription started. */
  startTime: string | null;
  acknowledged: boolean;
  /** The obfuscated account id the app attached at purchase, which the verify
   *  route matches against the caller. */
  obfuscatedAccountId: string | null;
};

const ENTITLED_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

/**
 * Read a purchases.subscriptionsv2 resource into the few facts the plan write
 * needs. Every uncertainty resolves toward NOT entitled: an unparseable date,
 * a missing line item or an unknown state grants nothing, because the failure
 * mode of generosity here is a free Pro.
 */
export function readPlaySubscription(resource: unknown, now: Date): PlaySubscriptionRead {
  const none: PlaySubscriptionRead = {
    entitled: false,
    productId: null,
    expiryTime: null,
    startTime: null,
    acknowledged: false,
    obfuscatedAccountId: null,
  };
  if (resource === null || typeof resource !== "object") return none;
  const r = resource as Record<string, unknown>;

  const state = typeof r.subscriptionState === "string" ? r.subscriptionState : "";

  const lineItems = Array.isArray(r.lineItems) ? r.lineItems : [];
  let productId: string | null = null;
  let expiryMs = Number.NEGATIVE_INFINITY;
  let expiryTime: string | null = null;
  for (const item of lineItems) {
    if (item === null || typeof item !== "object") continue;
    const li = item as Record<string, unknown>;
    if (typeof li.productId === "string" && productId === null) productId = li.productId;
    if (typeof li.expiryTime === "string") {
      const ms = Date.parse(li.expiryTime);
      if (Number.isFinite(ms) && ms > expiryMs) {
        expiryMs = ms;
        expiryTime = li.expiryTime;
      }
    }
  }

  const startTime =
    typeof r.startTime === "string" && Number.isFinite(Date.parse(r.startTime))
      ? r.startTime
      : null;

  const external =
    r.externalAccountIdentifiers !== null && typeof r.externalAccountIdentifiers === "object"
      ? (r.externalAccountIdentifiers as Record<string, unknown>)
      : {};
  const obfuscatedAccountId =
    typeof external.obfuscatedExternalAccountId === "string"
      ? external.obfuscatedExternalAccountId
      : null;

  return {
    entitled:
      ENTITLED_STATES.has(state) && expiryTime !== null && expiryMs > now.getTime(),
    productId,
    expiryTime,
    startTime,
    acknowledged: r.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    obfuscatedAccountId,
  };
}

/**
 * Decode a Pub/Sub push envelope into the purchase token it is about.
 *
 * The envelope is NEVER trusted for entitlement: whatever it claims happened,
 * the handler re-reads the live subscription from Google and acts on that.
 * All this function extracts is which token to go look at, so a forged or
 * mangled body can at worst make the server look at a subscription it already
 * owns the record of.
 */
export function rtdnPurchaseToken(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null;
  const message = (body as Record<string, unknown>).message;
  if (message === null || typeof message !== "object") return null;
  const data = (message as Record<string, unknown>).data;
  if (typeof data !== "string") return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (decoded === null || typeof decoded !== "object") return null;
  const notification = (decoded as Record<string, unknown>).subscriptionNotification;
  if (notification === null || typeof notification !== "object") return null;
  const token = (notification as Record<string, unknown>).purchaseToken;
  return isPurchaseToken(token) ? token : null;
}
