import { NextResponse } from "next/server";
import { authenticateMutation } from "@/lib/security/api-auth";
import { readJsonRequest } from "@/lib/security/request";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isPlayProductId,
  isPurchaseToken,
  isPlaySubscriptionId,
  playSubscriptionMarker,
  readPlaySubscription,
} from "@/lib/play-billing";
import { playConfigured, fetchPlaySubscription, acknowledgePlaySubscription } from "@/lib/play-api";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 4_096;

/**
 * The app reports a Play purchase; this route decides whether it buys Pro
 * (D-125). The app's claim is worth NOTHING on its own: the only fact
 * consulted is the live subscription Google returns for the token, and every
 * uncertainty in that read resolves to no grant (lib/play-billing.ts).
 *
 * The token must belong to the CALLER. The app attaches the player's user id
 * as the obfuscated account id at purchase time, and this route refuses a
 * token whose id does not match the authenticated caller - otherwise one paid
 * token could be replayed into Pro on any number of accounts.
 *
 * A Stripe subscriber is refused rather than double-billed: money outranks
 * everything (the D-124 discipline), and an account already paying on the web
 * has nothing to buy here.
 *
 * Acknowledgement happens AFTER the plan write, so a failed write leaves an
 * unacknowledged purchase that Play auto-refunds in three days, never money
 * taken for a plan that was not granted.
 */
export async function POST(request: Request) {
  const auth = await authenticateMutation(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: "That request couldn't be read." }, { status: 400 });
  }
  const purchaseToken = (body.value as { purchase_token?: unknown } | null)?.purchase_token;
  if (!isPurchaseToken(purchaseToken)) {
    return NextResponse.json({ error: "That purchase couldn't be read." }, { status: 400 });
  }

  if (!playConfigured()) {
    // Fail closed, and say so honestly: the purchase exists on Google's side
    // and stays unacknowledged, so Play refunds it rather than this deploy
    // granting or eating it.
    console.error("[play] verify called but Play credentials are not configured");
    return NextResponse.json(
      { error: "Purchases can't be verified right now. Nothing was charged for keeps." },
      { status: 503 },
    );
  }

  const resource = await fetchPlaySubscription(purchaseToken);
  const read = readPlaySubscription(resource, new Date());

  if (!read.entitled || !isPlayProductId(read.productId)) {
    return NextResponse.json(
      { error: "Google doesn't show an active subscription for that purchase." },
      { status: 402 },
    );
  }
  if (read.obfuscatedAccountId !== auth.user.id) {
    // A real subscription, but not provably this account's purchase.
    return NextResponse.json(
      { error: "That purchase belongs to a different account." },
      { status: 403 },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[play] service role is not configured; verified purchase not applied");
    return NextResponse.json(
      { error: "The purchase is real but couldn't be applied. Try again shortly." },
      { status: 503 },
    );
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Your account couldn't be read." }, { status: 502 });
  }
  if (profile.stripe_subscription_id && !isPlaySubscriptionId(profile.stripe_subscription_id)) {
    return NextResponse.json(
      { error: "Your Pro is billed on the web, so there's nothing to buy here." },
      { status: 409 },
    );
  }

  const { error: writeError } = await supabase.rpc("set_subscription_plan", {
    p_user_id: auth.user.id,
    p_plan: "pro",
    p_renews_at: read.expiryTime,
    p_period_start: read.startTime,
    p_subscription_id: playSubscriptionMarker(purchaseToken),
    p_customer_id: null,
    p_event_at: new Date().toISOString(),
  });
  if (writeError) {
    console.error("[play] plan write failed after a verified purchase", {
      userId: auth.user.id,
      message: writeError.message,
    });
    return NextResponse.json(
      { error: "The purchase is real but couldn't be applied. Try again shortly." },
      { status: 502 },
    );
  }

  if (!read.acknowledged) {
    const acked = await acknowledgePlaySubscription(read.productId, purchaseToken);
    if (!acked) {
      // The plan is granted; the acknowledgement rides a later verify. Logged
      // because three days of this and Play refunds a purchase we honored.
      console.error("[play] acknowledge failed after grant", { userId: auth.user.id });
    }
  }

  return NextResponse.json({ plan: "pro", renews_at: read.expiryTime });
}
