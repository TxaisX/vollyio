// What a payment-provider webhook event means for a player's plan, and nothing
// else. No network, no framework, no environment, no secrets: the four events
// that decide whether someone is paying are the part of billing most likely to
// be wrong and hardest to rehearse against a live account, so they are mapped
// here where a unit test can walk every branch.
//
// The route owns identity resolution, the database write, and the HTTP status.
// This file only reads the envelope.

export type PlanChange = {
  // Null when the event carries no user id of its own. The subscription events
  // know only the provider's customer id, so the caller resolves the user from
  // that. Guessing here would turn "we could not identify the player" into a
  // plan write against the wrong profile.
  userId: string | null;
  plan: "free" | "pro";
  renewsAt: string | null;
  // The period START as the provider reported it, never computed here. The
  // allowance window used to derive it as renewsAt minus one month, which is
  // wrong by one to three days whenever the anchor is the 29th to 31st and the
  // period lands in a shorter month (a Feb 28 renewal derived Jan 28, where the
  // real period began Jan 31). A start that is too early counts the tail of the
  // previous period against the new one, so the error fell against the player.
  periodStartsAt: string | null;
  subscriptionId: string | null;
  customerId: string | null;
} | null;

type Fields = Record<string, unknown>;

// Statuses that entitle a player.
//
// 'past_due' is in here deliberately, and it is the same grace decision that
// makes invoice.payment_failed a no-op below. A card that fails on the renewal
// puts the subscription into past_due while the provider retries over several
// days, and most of those retries succeed. Downgrading on the first failure
// would cut a paying player off mid-week and then restore them, which reads as
// the product being broken. When the retries are finally exhausted the status
// becomes 'unpaid' or 'canceled', and those do downgrade.
//
// Treating past_due as paid here while treating payment_failed as a no-op there
// is the same policy stated twice; letting them disagree meant the same failed
// charge downgraded or did not depending on which door it came through.
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

// 2100-01-01. A period end outside a sane range is a malformed payload, and
// writing it to profiles.plan_renews_at would surface to the player as a
// nonsense renewal date rather than as the bug it is.
const MAX_UNIX_SECONDS = 4_102_444_800;

function asFields(value: unknown): Fields | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// A reference to another provider object arrives either as a bare id string or,
// when the sender expanded it, as the whole object. Reading both means turning
// expansion on at the provider later cannot silently blank a customer id.
function referenceId(value: unknown): string | null {
  const direct = asText(value);
  if (direct) return direct;
  const expanded = asFields(value);
  return expanded ? asText(expanded.id) : null;
}

function eventObject(event: unknown): Fields | null {
  const root = asFields(event);
  const data = root ? asFields(root.data) : null;
  return data ? asFields(data.object) : null;
}

function metadataUserId(object: Fields): string | null {
  const metadata = asFields(object.metadata);
  return metadata ? asText(metadata.user_id) : null;
}

function isoFromUnixSeconds(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_UNIX_SECONDS) return null;
  try {
    return new Date(value * 1000).toISOString();
  } catch {
    return null;
  }
}

// The period end sits on the subscription in older API versions and on its
// items in newer ones. Reading both means an account moved to a later version
// keeps reporting a renewal date instead of quietly reporting none forever.
function periodStart(object: Fields): string | null {
  const top = isoFromUnixSeconds(object.current_period_start);
  if (top) return top;
  const items = asFields(object.items);
  const rows = items && Array.isArray(items.data) ? items.data : null;
  if (!rows) return null;
  for (const row of rows) {
    const item = asFields(row);
    const start = item ? isoFromUnixSeconds(item.current_period_start) : null;
    if (start) return start;
  }
  return null;
}

function periodEnd(object: Fields): string | null {
  const top = isoFromUnixSeconds(object.current_period_end);
  if (top) return top;
  const items = asFields(object.items);
  const rows = items && Array.isArray(items.data) ? items.data : null;
  if (!rows) return null;
  for (const row of rows) {
    const item = asFields(row);
    const end = item ? isoFromUnixSeconds(item.current_period_end) : null;
    if (end) return end;
  }
  return null;
}

/**
 * The plan state an event implies, or null when the event asks for no change.
 * Never throws and never partially applies: an unrecognized type, a shape the
 * provider has changed under us, and outright garbage all return null, so the
 * caller's only options are "write this exact state" or "do nothing".
 */
export function planChangeFromEvent(event: unknown): PlanChange {
  try {
    const root = asFields(event);
    const type = root ? asText(root.type) : null;
    const object = eventObject(event);
    if (!type || !object) return null;

    switch (type) {
      // All three checkout outcomes share ONE rule: grant if and only if the
      // session itself says the money settled. The event name is not the
      // signal; `payment_status` is.
      //
      // `completed` fires when the player finishes the page, which for a card
      // means paid and for a delayed method (bank debit, and several wallets
      // and redirects that automatic payment methods enable per country) means
      // the money has not moved yet. `async_payment_succeeded` is that money
      // arriving, minutes or days later, and it is the moment the entitlement
      // is actually owed. `async_payment_failed` is it never arriving.
      //
      // Reading payment_status rather than the event type means a method we
      // have never seen behaves correctly the first time someone uses it, which
      // matters because the enabled set is a dashboard toggle rather than
      // anything this code declares.
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.completed": {
        // The only event that knows the player without a lookup, because the
        // session was created carrying their id. It is also the event that
        // records the customer id every later event is resolved through.
        //
        // "Completed" is not "paid". Delayed-notification methods (bank debits,
        // and several redirects that automatic payment methods can switch on
        // per country) complete the session with payment_status 'unpaid' and
        // the subscription sitting in `incomplete`, hours before the money
        // moves or fails. Granting Pro on completion alone is the classic
        // fulfil-before-payment hole: the debit fails later, and because this
        // endpoint does not subscribe to the async payment events, nothing
        // corrects the grant until a subscription event happens to land.
        const paymentStatus = asText(object.payment_status);
        const sessionStatus = asText(object.status);
        const settled =
          paymentStatus === "paid" || paymentStatus === "no_payment_required";
        // An absent payment_status is a shape we do not recognize. Refuse
        // rather than assume: the subscription events still arrive and will
        // grant Pro on their own once the money is real.
        if (!settled) return null;
        if (sessionStatus !== null && sessionStatus !== "complete") return null;

        return {
          userId: asText(object.client_reference_id) ?? metadataUserId(object),
          plan: "pro",
          // Not read off the session on purpose. A session has an expiry, not a
          // billing period, and the subscription event that follows carries the
          // real period end.
          renewsAt: null,
          periodStartsAt: null,
          subscriptionId: referenceId(object.subscription),
          customerId: referenceId(object.customer),
        };
      }

      case "customer.subscription.updated": {
        const status = asText(object.status);
        // An absent status is a malformed payload, not a lapsed subscription.
        // Treating it as "not active" would downgrade a paying player on a
        // shape change alone, so it takes the do-nothing path instead.
        if (!status) return null;
        // Status alone decides the plan, which is exactly what keeps a player
        // who has cancelled on Pro until the period they paid for runs out:
        // cancel_at_period_end sits true for days or weeks while the status
        // stays active. Reading that flag here would cut them off the moment
        // they clicked cancel, for time they already bought. The deletion event
        // is what ends access.
        return {
          userId: metadataUserId(object),
          plan: PAID_STATUSES.has(status) ? "pro" : "free",
          renewsAt: periodEnd(object),
          periodStartsAt: periodStart(object),
          subscriptionId: asText(object.id),
          customerId: referenceId(object.customer),
        };
      }

      case "customer.subscription.deleted": {
        return {
          userId: metadataUserId(object),
          plan: "free",
          // The subscription is gone, so there is no next renewal to promise.
          renewsAt: null,
          periodStartsAt: null,
          subscriptionId: asText(object.id),
          customerId: referenceId(object.customer),
        };
      }

      case "invoice.payment_failed":
        // Deliberately not a downgrade. The provider retries a failed charge
        // over several days and most of those attempts eventually succeed, so
        // acting here would take away analyses the player still owns and hand
        // them back an hour later. When the retries genuinely run out, the
        // provider ends the subscription and the subscription events above do
        // the downgrade.
        return null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * The provider's customer id on any of these events. The subscription and
 * invoice events carry no user id, so this is what the caller resolves a player
 * through.
 */
/**
 * When the provider raised the event, as an ISO string, or null when the
 * payload does not carry a usable one.
 *
 * This is the ordering key. Webhook delivery is not ordered, so the plan writer
 * compares it against the newest event already applied and refuses to move a
 * plan backwards. Null means "no opinion", and the writer then applies the
 * event: a payload without a timestamp is still a real event, and refusing it
 * would lose a genuine upgrade.
 */
export function eventCreatedAt(event: unknown): string | null {
  try {
    const fields = asFields(event);
    return fields ? isoFromUnixSeconds(fields.created) : null;
  } catch {
    return null;
  }
}

export function customerIdFromEvent(event: unknown): string | null {
  try {
    const object = eventObject(event);
    return object ? referenceId(object.customer) : null;
  } catch {
    return null;
  }
}
