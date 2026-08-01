import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/request";
import { createPortalSession, stripeConfigured } from "@/lib/stripe";
import { consumeApiQuota } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type BillingProfile = {
  stripe_customer_id: string | null;
};

// Hand a paying player a one-time link into the provider's own management page,
// where cancelling and changing a card live. Returns the URL for the client to
// navigate to, never a redirect, because the caller is a `fetch`.
//
// Like the checkout route this consumes the atomic 'billing' quota (migration
// 028, 10 per hour, shared with checkout), never 'analyze': spending an
// analysis slot to open a cancellation page would punish the player for
// leaving. Same-origin plus a verified session gate the call, and the
// customer id comes from their own profile row rather than the request.
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
      { error: "Plan management isn't available right now. Try again later." },
      { status: 503 },
    );
  }

  // Same atomic quota as checkout, for the same reason: every call mints a real
  // session at the provider. Deliberately NOT the analyze scope, which would
  // let opening plan settings eat an analysis.
  const quota = await consumeApiQuota(supabase, "billing");
  if (!quota.ok) {
    return NextResponse.json(
      { error: "Plan management isn't available right now. Try again later." },
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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  // Fail closed rather than falling through to the "nothing to manage" answer
  // below: telling a subscriber they have no plan is worse than telling them to
  // try again, because the first reads as their subscription having vanished.
  if (error || !data) {
    return NextResponse.json(
      { error: "Plan management isn't available right now. Try again later." },
      { status: 503 },
    );
  }
  const { stripe_customer_id: customerId } = data as BillingProfile;

  // Nothing to open, and nothing to create. A customer record is opened by
  // checkout and recorded by the webhook; minting one here would leave a
  // billing record with no subscription behind it and a profile pointing at it,
  // which is exactly the state that makes later provider events unmatchable.
  if (!customerId) {
    return NextResponse.json(
      { error: "There's nothing to manage yet. Upgrade to Pro first." },
      { status: 409 },
    );
  }

  // Derived from the request the same way checkout derives its return URLs:
  // same-origin already passed, so this is the origin the player is really on,
  // with no domain compiled in and nothing caller-supplied trusted.
  const planCard = `${new URL(req.url).origin}/settings#plan`;

  const session = await createPortalSession({ customerId, returnUrl: planCard });
  if (!session.ok) {
    console.error("[portal] session creation failed", { reason: session.error });
    return NextResponse.json(
      { error: "Couldn't open your plan settings. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
