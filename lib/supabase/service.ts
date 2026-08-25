import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// The ONLY service-role client in this repo, and it must stay that way.
//
// Every other client in lib/supabase runs as the signed-in player under row
// security, which is what keeps the tenant boundary in the database instead of
// in route code. This key has none of that: it bypasses RLS on every table, so
// a single careless import turns any bug in the calling route into a
// cross-account read or write.
//
// It exists because the plan writers (set_subscription_plan,
// user_id_for_billing_customer) are granted to service_role only (migration
// 027) and the routes that must call them have no player session to run as.
//
// FOUR importers, each with a row in docs/security.md and an answer to "why can
// this not run as the signed-in player": the Stripe webhook, /api/analyze
// (telemetry and quota refunds the player must not be able to write),
// /api/play/verify and /api/play/rtdn (D-125). Adding a fifth is a change to
// that document, not a refactor.
//
// Do not import this from anything that lets the REQUEST BODY choose the target.
// /api/play/verify is the closest call and shows the shape that makes it safe:
// the body carries only a purchase token, the entitlement is re-derived from
// Google's live resource, and the write is refused unless that resource names
// the verified user id. A route that accepts a user id and then acts on it with
// this client has no ownership check left anywhere in the stack.

/**
 * Null when the service key is absent, so a deploy that lacks it denies the
 * plan write rather than throwing at import time and taking the route down. The
 * client is built per call: nothing is cached at module scope, so this key
 * cannot be reached by importing the module alone.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  // No session persistence and no refresh timer: this client is not a user and
  // has no session to keep. Persisting one would also write the service key
  // into whatever storage the SDK picked as a default.
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
