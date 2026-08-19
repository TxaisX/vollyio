import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  playSubscriptionMarker,
  readPlaySubscription,
  rtdnPurchaseToken,
} from "@/lib/play-billing";
import { playConfigured, fetchPlaySubscription } from "@/lib/play-api";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 64_000;

/**
 * Real-time developer notifications: Google's Pub/Sub push for renewals,
 * cancellations, expiries and revocations (D-125). The Stripe webhook's
 * sibling, holding the same two disciplines:
 *
 * 1. The push body is NEVER trusted for entitlement. It names a purchase
 *    token; the live subscription is re-fetched from Google and the plan
 *    follows THAT. A forged push can at most make this route look something
 *    up.
 * 2. The sender must prove itself before anything else runs. Pub/Sub cannot
 *    HMAC-sign like Stripe, so the endpoint URL configured in the push
 *    subscription carries a secret (`?secret=`, PLAY_RTDN_SECRET), compared
 *    in constant time. Unset secret = every push rejected: fail closed.
 *
 * 200 is returned for events this route decides to ignore, because anything
 * else makes Pub/Sub redeliver the same undecidable event forever.
 */
export async function POST(request: Request) {
  const expected = process.env.PLAY_RTDN_SECRET;
  if (!expected) {
    console.error("[play] RTDN secret is not configured; push rejected");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  const supplied = new URL(request.url).searchParams.get("secret") ?? "";
  const suppliedBuf = Buffer.from(supplied, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (suppliedBuf.length !== expectedBuf.length || !timingSafeEqual(suppliedBuf, expectedBuf)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Too large." }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  const purchaseToken = rtdnPurchaseToken(body);
  if (!purchaseToken) {
    // Test pushes and one-time-product events land here. Acknowledged, not
    // retried: there is no subscription to reconcile.
    return NextResponse.json({ received: true });
  }

  if (!playConfigured()) {
    console.error("[play] RTDN received but Play credentials are not configured");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[play] service role is not configured; RTDN not applied");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", playSubscriptionMarker(purchaseToken))
    .maybeSingle();
  if (!profile) {
    // A purchase the app has not verified yet, or never will. The verify
    // route owns the first grant; a push has nothing to update.
    return NextResponse.json({ received: true });
  }

  const resource = await fetchPlaySubscription(purchaseToken);
  if (resource === null) {
    // Google would not answer. 500 so Pub/Sub retries with backoff, because
    // acting without the live read would mean trusting the push.
    return NextResponse.json({ error: "Upstream unavailable." }, { status: 500 });
  }
  const read = readPlaySubscription(resource, new Date());

  const { error } = await supabase.rpc("set_subscription_plan", {
    p_user_id: profile.id,
    p_plan: read.entitled ? "pro" : "free",
    p_renews_at: read.entitled ? read.expiryTime : null,
    p_period_start: read.entitled ? read.startTime : null,
    p_subscription_id: null,
    p_customer_id: null,
    p_event_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[play] RTDN plan write failed", {
      userId: profile.id,
      message: error.message,
    });
    return NextResponse.json({ error: "Write failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
