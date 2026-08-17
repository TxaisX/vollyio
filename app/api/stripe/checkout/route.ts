import { NextResponse, type NextRequest } from "next/server";
import { authenticateMutation } from "@/lib/security/api-auth";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";
import { billingOpen } from "@/lib/billing";
import { consumeApiQuota } from "@/lib/security/rate-limit";
import { DEFAULT_OFFER, isOfferKey, type OfferKey } from "@/lib/offers";

/**
 * Which offer the caller asked for, or the default.
 *
 * The body carries a KEY, never a price and never an amount. That is the whole
 * security property of this function: the worst a forged body can do is name
 * one of our own three offers, and the cheapest of those is a price we chose to
 * sell. A body that carried a price id or a number would let the caller decide
 * what to charge themselves.
 *
 * An unparseable or absent body is not an error. The plan card posts JSON, but
 * the 402 upsell surfaces post nothing at all, and those should keep working.
 */
async function readOffer(req: NextRequest): Promise<OfferKey> {
  const body = (await req.json().catch(() => null)) as { offer?: unknown } | null;
  return isOfferKey(body?.offer) ? body.offer : DEFAULT_OFFER;
}

export const runtime = "nodejs";

type BillingProfile = {
  plan: string | null;
  stripe_customer_id: string | null;
};

// Start a paid subscription for the signed-in player. The route only ever
// returns a URL; the client navigates. Redirecting from here would break the
// `fetch` that calls it, the same reason docs/billing.md 4.5 forbids it for the
// 402.
//
// The atomic quota below runs on the dedicated 'billing' scope (migration
// 028, 10 per hour), never 'analyze': borrowing the analyze scope would let a
// player who clicks upgrade twice burn the analysis slots they are trying to
// buy more of. Every session created below is bound to the verified user id
// rather than to anything the caller sent.
export async function POST(req: NextRequest) {
  const auth = await authenticateMutation(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Upgrades aren't available right now. Try again later." },
      { status: 503 },
    );
  }

  // Selling is gated on the purchase path existing, NOT on the cap being on
  // (D-066). Those are separate product decisions: the launch posture is an
  // open product where Pro is a choice, and requiring the cap first would have
  // meant closing the product on the same day it started selling.
  //
  // What this route must still guarantee is that the plan card told the truth
  // about what Pro gives. That lives in components/plan-card.tsx, which reads
  // the same two predicates and describes the allowance as active or as coming.
  if (!billingOpen()) {
    return NextResponse.json(
      { error: "Upgrades aren't available right now. Try again later." },
      { status: 503 },
    );
  }

  // Atomic, before any provider object is minted. Cheap per call, but each one
  // creates a real session at the provider and an unbounded loop is both a bill
  // and a mess to reconcile.
  const quota = await consumeApiQuota(supabase, "billing");
  if (!quota.ok) {
    return NextResponse.json(
      { error: "Upgrades aren't available right now. Try again later." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a bit and try again." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  // Fail closed on an unreadable or missing profile. Without the stored plan we
  // cannot rule out an active subscription, and with no profile row at all the
  // webhook's `set_subscription_plan` would later raise 'profile unavailable',
  // leaving a player who has paid on a plan nothing in the system can grant.
  if (error || !data) {
    return NextResponse.json(
      { error: "Upgrades aren't available right now. Try again later." },
      { status: 503 },
    );
  }
  const profile = data as BillingProfile;

  // The stored plan, not anything the client claims. Only the webhook writes
  // it (migration 027), so it is the one trustworthy answer to "are they
  // already paying", and a second subscription would double-charge for an
  // allowance the player already has.
  if (profile.plan === "pro") {
    return NextResponse.json({ error: "You're already on Pro." }, { status: 409 });
  }

  // The SERVER's own origin, read off the URL this handler was reached at, not
  // the caller's `Origin` header. That distinction stopped being academic with
  // D-120: a native caller sends no Origin at all, and this still resolves to
  // production, a preview deployment, or localhost correctly, because it never
  // asked the client where to send anyone. A caller-supplied return URL never
  // enters the calculation.
  //
  // The native app opens the returned URL in a Custom Tab, so a player who
  // upgrades from the app lands back on this same web settings page. That is
  // the deliberate shape: the purchase happens on the web, off the app's own
  // surface (D-120).
  const planCard = `${new URL(req.url).origin}/settings#plan`;
  // The plan only turns pro when the webhook lands, which is seconds after the
  // player is returned here. Without a marker they arrive back on a card that
  // still says Free with an upgrade button, and the reasonable reaction to that
  // is to click it again. The marker lets the card say the payment is
  // processing instead of inviting a second purchase.
  const returnUrl = `${new URL(req.url).origin}/settings?checkout=complete#plan`;

  // Read after the auth, origin, quota and plan checks rather than before, so a
  // malformed body from an unauthenticated caller is refused on identity and
  // never gets as far as being parsed.
  const offer = await readOffer(req);

  const session = await createCheckoutSession({
    userId: user.id,
    offer,
    // A returning player already has a provider customer record; a first-time
    // upgrade has only the verified address on their session, which is what the
    // provider needs to open one.
    customerId: profile.stripe_customer_id,
    email: user.email ?? null,
    successUrl: returnUrl,
    cancelUrl: planCard,
  });
  if (!session.ok) {
    console.error("[checkout] session creation failed", { reason: session.error });
    return NextResponse.json(
      { error: "Couldn't start the upgrade. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
