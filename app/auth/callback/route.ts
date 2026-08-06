import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { DEAD_LINK_MESSAGE } from "@/lib/auth-errors";
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

  const supabase = await createClient();

  if (code && code.length <= 2048) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination(type)}`);
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
