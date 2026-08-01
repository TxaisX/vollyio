import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/request";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";
import { billingOpen } from "@/lib/billing";
import { consumeApiQuota } from "@/lib/security/rate-limit";

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
  if (!hasTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

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

  // Same-origin passed above, so the request's own origin is the one the
  // player's browser is on: correct on production, preview deployments, and
  // localhost with no domain compiled in, and a caller-supplied return URL
  // never enters the calculation.
  const planCard = `${new URL(req.url).origin}/settings#plan`;
  // The plan only turns pro when the webhook lands, which is seconds after the
  // player is returned here. Without a marker they arrive back on a card that
  // still says Free with an upgrade button, and the reasonable reaction to that
  // is to click it again. The marker lets the card say the payment is
  // processing instead of inviting a second purchase.
  const returnUrl = `${new URL(req.url).origin}/settings?checkout=complete#plan`;

  const session = await createCheckoutSession({
    userId: user.id,
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
