import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// The client a NATIVE request runs as (D-120).
//
// lib/supabase/server.ts builds its client out of the cookie jar, which is the
// right answer for a browser and no answer at all for the Android app: there
// are no cookies in an OkHttp call. This one is built out of the access token
// the app already holds from signing in, and is otherwise the same posture as
// the session client - the ANON key, so every table read and write still runs
// as the player under row security.
//
// It is NOT a second privileged client. The only thing it can do is what the
// player whose token was presented can do, which is why it takes the anon key
// and never SUPABASE_SERVICE_ROLE_KEY. Rule 10's two-importer limit is about
// lib/supabase/service.ts and is untouched by this file.

/**
 * Null when Supabase is unconfigured, matching the service client's posture: a
 * deploy missing its configuration denies the request rather than throwing at
 * import time and taking the whole route down.
 *
 * The token is placed in the request headers rather than in a persisted
 * session. That is what makes `auth.uid()` resolve to the player inside every
 * RPC and every RLS policy, and it keeps the client stateless: nothing is
 * cached at module scope, so two concurrent requests from different players
 * cannot see each other's identity.
 */
export function createBearerClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    // There is no session to keep and no refresh to run. The app owns the
    // refresh cycle and presents whatever token is current; a server-side
    // refresh timer here would be a background task on a serverless function
    // that outlives the request it was created for.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
