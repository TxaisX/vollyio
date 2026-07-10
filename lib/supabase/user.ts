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
  try {
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && typeof sub === "string" && sub.length > 0) return sub;
  } catch {
    // Fall through to the network path.
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
