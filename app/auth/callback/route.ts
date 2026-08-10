import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  DEAD_LINK_MESSAGE,
  OAUTH_DECLINED_MESSAGE,
  OAUTH_EXCHANGE_FAILED_MESSAGE,
} from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

// Where a verified link lands. A recovery link is the only one that is not
// finished once the session exists: the player came here to set a password, and
// dropping them on the dashboard signed in would leave them holding an account
// whose password they still do not know. The destination is derived from the
// link type rather than from a query parameter on purpose, so there is no
// caller-supplied redirect target to validate or abuse.
//
// Everything else lands on `/welcome` rather than `/dashboard`, because this
// route is now also where SOCIAL sign-in arrives, and a player who signed in
// with one tap never passed through the onboarding funnel at all. `/welcome`
// is the right target for both cases without a branch: it counts the player's
// analyses and forwards anyone who has run one straight to the dashboard, so a
// returning player pays one query and a redirect, and a brand new one gets the
// ramp they would otherwise have skipped.
function destination(type: EmailOtpType | null): string {
  return type === "recovery" ? "/reset-password" : "/welcome";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const type = rawType && OTP_TYPES.has(rawType) ? rawType : null;

  // THE PROVIDER'S OWN REFUSAL, read FIRST, because until this existed the
  // route simply fell past it: an OAuth round trip that came back with an
  // error carries no `code` and no `token_hash`, so it landed on the dead-link
  // message at the bottom and told a Google user to go and open an email. That
  // wrong message is what sent this investigation down the wrong path - the
  // outbound leg was verified correct (cookie set, PKCE challenge issued,
  // Google reached) while the real reason was being discarded here.
  //
  // The provider's `error_description` is NOT rendered. It is attacker-supplied
  // text on a public URL, and this value is echoed into the login page, so it
  // is mapped to our own copy and logged instead.
  const providerError = searchParams.get("error");
  if (providerError) {
    console.error("[auth] provider returned an error", {
      error: providerError,
      code: searchParams.get("error_code"),
      description: searchParams.get("error_description"),
    });
    const message =
      providerError === "access_denied"
        ? OAUTH_DECLINED_MESSAGE
        : OAUTH_EXCHANGE_FAILED_MESSAGE;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`,
    );
  }

  const supabase = await createClient();

  // A `code` means this arrived from SOCIAL sign-in, not from an email link.
  // Its failure must be reported as its own thing: the dead-link copy below
  // tells the player to open the newest Vollyio email, which is advice about a
  // link a one-tap Google user never had and cannot go and find. That wrong
  // message is what the login page has been showing after a failed Google
  // round trip.
  if (code && code.length <= 2048) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination(type)}`);
    // The one failure that is genuinely ours, so it is logged with its reason
    // rather than being inferred from a screenshot later.
    console.error("[auth] code exchange failed", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(OAUTH_EXCHANGE_FAILED_MESSAGE)}`,
    );
  }

  if (tokenHash && tokenHash.length <= 2048 && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${destination(type)}`);
  }

  // Nearly always a STALE link rather than a truly expired one: every resend
  // invalidates the previous email's token, so a player who signed up twice has
  // a dead link sitting in their inbox above the live one. The old copy said
  // only "invalid or expired", which gave them nothing to do about it.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(DEAD_LINK_MESSAGE)}`,
  );
}
