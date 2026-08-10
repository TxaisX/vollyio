import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_FAILED_MESSAGE } from "@/lib/auth-errors";
import { enabledOAuthProviders, isOAuthProvider } from "@/lib/oauth";
import { SITE_URL } from "@/lib/site";

/**
 * WHERE SOCIAL SIGN-IN STARTS, and why it is a route handler rather than the
 * server action it used to be.
 *
 * THE BUG THIS EXISTS TO FIX. Google sign-in had never once worked: the Google
 * Cloud OAuth user cap read 0 of 100 on 2026-08-10, meaning no human had ever
 * completed the round trip. Every layer of configuration was checked in both
 * consoles and every one was correct - matching client IDs, the right callback
 * URI, `https://vollyio.com/**` allowlisted in Supabase, publishing status In
 * production so no tester allowlist was blocking anyone. The fault was ours.
 *
 * `signInWithOAuth` runs the PKCE flow, which mints a code VERIFIER that must
 * be written to a cookie and read back by /auth/callback to exchange the code
 * for a session. The old caller was a Server Action that wrote that cookie and
 * then `redirect()`ed to an EXTERNAL url (Google's). A Server Action answers
 * with a payload the client router interprets rather than a plain 3xx, and its
 * Set-Cookie did not survive being sent off-origin, so the verifier was gone by
 * the time Google sent the player back. The exchange then failed for everyone,
 * every time, and the callback dropped them on /login.
 *
 * A route handler returns an ordinary HTTP redirect. THE COOKIES ARE WRITTEN
 * ONTO THAT RESPONSE OBJECT BY HAND, deliberately, rather than through
 * `cookies()` from next/headers: relying on framework propagation is the same
 * class of assumption that caused the original bug, and here the write has to
 * land on the exact response the browser follows.
 *
 * GET, not POST, because this is where the browser is SENT: a plain link works,
 * survives being opened in a new tab, and needs no JavaScript. There is nothing
 * for CSRF to reach - the endpoint takes no input but a provider name, and the
 * worst a forged request can do is start a sign-in the player must finish at
 * Google themselves.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const enabled = enabledOAuthProviders(process.env.OAUTH_PROVIDERS);

  const failed = () =>
    NextResponse.redirect(
      `${SITE_URL}/login?error=${encodeURIComponent(OAUTH_FAILED_MESSAGE)}`,
    );

  // Validated against the environment on the SERVER, so a caller never gets to
  // name a provider this deployment has not configured.
  if (!isOAuthProvider(provider) || !enabled.includes(provider)) return failed();

  // Built up front so the client has something concrete to write the verifier
  // cookie onto. The Location is replaced once Supabase hands back the real
  // provider url; the cookies set along the way ride out on this same response.
  const response = NextResponse.redirect(`${SITE_URL}/login`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${SITE_URL}/auth/callback` },
  });

  // No url means the provider is not enabled on the Supabase project, which is
  // the one failure this cannot recover from.
  if (error || !data?.url) return failed();

  // Same response, so the verifier cookie set above is still attached.
  response.headers.set("Location", data.url);
  return response;
}
