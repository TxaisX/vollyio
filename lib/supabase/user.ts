import type { SupabaseClient } from "@supabase/supabase-js";

// Resolve the signed-in user's id without a network round trip.
//
// getClaims() verifies the access token locally against the project's public
// signing keys (fetched once and cached per server instance), so the common
// case costs microseconds instead of an auth-server round trip. An expired or
// missing token falls back to getUser(), which refreshes the session over the
// network. Row-level security still enforces every query with the same JWT,
// so this changes latency, not authority. Money-spending API routes keep
// calling getUser() directly for server-side revocation checks.
export async function getAuthUserId(supabase: SupabaseClient): Promise<string | null> {
  const { userId } = await getAuthIdentity(supabase);
  return userId;
}

// The id plus the `is_anonymous` claim, for the surfaces that render
// differently for a session that never gave us an email address (D-121).
//
// The claim defaults to FALSE when absent, the same deliberate direction as
// lib/route-guard.ts: reading a real account as anonymous would lock a player
// out of the breakdown they paid an analysis for, while reading an anonymous
// session as an account only shows them a page the wall would have covered.
// The boundary that spends money stays in Postgres either way.
export async function getAuthIdentity(
  supabase: SupabaseClient,
): Promise<{ userId: string | null; isAnonymous: boolean }> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && typeof sub === "string" && sub.length > 0) {
      const claims = data?.claims as { is_anonymous?: unknown } | undefined;
      return { userId: sub, isAnonymous: claims?.is_anonymous === true };
    }
  } catch {
    // Fall through to the network path.
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { userId: null, isAnonymous: false };
  return { userId: user.id, isAnonymous: user.is_anonymous === true };
}
