import { NextResponse, type NextRequest } from "next/server";
import { WEBHOOK_SECRET } from "@/lib/stripe";
import { verifyWebhookSignature } from "@/lib/stripe-sign";
import {
  customerIdFromEvent,
  eventCreatedAt,
  planChangeFromEvent,
} from "@/lib/billing-events";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// The provider's events are a few kilobytes. A megabyte is generous headroom
// and still bounds what an unauthenticated caller can make this route buffer,
// which matters here more than on any other route: the whole body has to be
// read before the signature can say whether the sender is genuine at all.
const MAX_BODY_BYTES = 1_000_000;

type RawBody =
  | { ok: true; text: string }
  | { ok: false; error: "too_large" | "unreadable" };

// Not req.text(): that buffers the entire body before anything can reject it,
// so the cap would only ever be checked after the memory was already spent.
// Reading the stream keeps the bytes exact, which is what the signature covers.
async function readRawBody(req: NextRequest, maxBytes: number): Promise<RawBody> {
  const declared = req.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, error: "too_large" };
  }
  if (!req.body) return { ok: false, error: "unreadable" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, error: "too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: "unreadable" };
  }
}

/**
 * Applies a plan change the payment provider reports.
 *
 * This is the one route in the codebase that deliberately does NOT same-origin
 * check, and it must stay that way. The origin check exists to stop another
 * site from riding a player's cookies; the concept does not apply to a server
 * on the internet that sends no cookies and whose Origin header would be worth
 * nothing if it sent one. The HMAC over the raw bytes IS the authentication
 * here. It runs before the body is parsed and before anything is written, and
 * every failure path denies. Do not add an origin check, and do not move the
 * signature check below the parse.
 */
export async function POST(req: NextRequest) {
  const secret = WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed. Without the endpoint secret there is no way to tell a real
    // event from a forged one, so a misconfigured deploy applies no plan
    // changes at all rather than trusting the body in front of it.
    console.error("[billing] webhook secret is not configured; event rejected");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const body = await readRawBody(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: "Bad request." },
      { status: body.error === "too_large" ? 413 : 400 },
    );
  }

  // Bare failure on purpose: an unverified caller learns that it was rejected
  // and nothing else, not which half (secret, replay window, or digest) said no,
  // and nothing about the payload reaches the logs.
  if (!verifyWebhookSignature(body.text, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(body.text);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const change = planChangeFromEvent(event);
  if (!change) {
    // Understood and deliberately not acted on: a failed payment, or a type
    // this endpoint does not map. 200 retires the event. Any other status has
    // the provider redeliver the same thing on a backoff for days, and the
    // answer will not change on the tenth attempt either.
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[billing] service credentials unavailable; plan change not applied");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  let userId = change.userId;
  if (!userId) {
    // Subscription and invoice events carry no user id, only the provider's
    // customer id. The link between the two was recorded when checkout
    // completed, which is the one event that knows both.
    const customerId = change.customerId ?? customerIdFromEvent(event);
    if (customerId) {
      const { data, error } = await supabase.rpc("user_id_for_billing_customer", {
        p_customer_id: customerId,
      });
      if (error) {
        // A lookup we could not run is not a lookup that found nobody. 500 so
        // the provider redelivers instead of us silently dropping a downgrade.
        console.error("[billing] customer lookup failed", { message: error.message });
        return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
      }
      userId = typeof data === "string" ? data : null;
    }
  }

  if (!userId) {
    // No profile holds this customer id, so there is no player whose plan could
    // be wrong. Retrying cannot create the link, because only a completed
    // checkout writes it, so this event is retired rather than redelivered for
    // days. The customer id is logged because it is the only thread back to an
    // orphaned subscription; it is an opaque provider reference, not a secret.
    console.warn("[billing] no profile matches the event customer; ignored", {
      customerId: change.customerId ?? customerIdFromEvent(event),
    });
    return NextResponse.json({ received: true });
  }

  // Safe to apply twice AND safe to apply out of order.
  //
  // Duplicates are handled by the write being an idempotent UPDATE to a target
  // state ('pro' with this period end, or 'free') rather than an increment, so
  // a redelivery rewrites the same values and changes nothing.
  //
  // Ordering is the harder half, and it needs `p_event_at`. Webhook delivery is
  // not ordered: a cancellation and the update that preceded it can arrive
  // either way round, and a stale "still active" event landing after the
  // cancellation would restore a subscription the player already ended. The
  // function compares this timestamp against the newest one already applied and
  // refuses to move the plan backwards, while still recording the identifiers.
  const eventAt = eventCreatedAt(event);
  const { error } = await supabase.rpc("set_subscription_plan", {
    p_user_id: userId,
    p_plan: change.plan,
    p_renews_at: change.renewsAt,
    p_subscription_id: change.subscriptionId,
    p_customer_id: change.customerId,
    p_event_at: eventAt,
  });
  if (error) {
    // 500 so the provider retries: the event was genuine and the player's plan
    // is now out of step with what they are paying.
    console.error("[billing] plan write failed", { message: error.message });
    return NextResponse.json({ error: "Could not apply the update." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
