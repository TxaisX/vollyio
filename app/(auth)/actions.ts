"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CONFIRM_SENT_MESSAGE,
  RESET_SENT_MESSAGE,
  loginErrorMessage,
  resetRequestErrorMessage,
  signupErrorMessage,
  updatePasswordErrorMessage,
} from "@/lib/auth-errors";
import {
  parseForgotInput,
  parseLoginInput,
  parseResetInput,
  parseSignupInput,
} from "@/lib/auth-input";
import { SITE_URL } from "@/lib/site";

export async function login(formData: FormData) {
  const parsed = parseLoginInput(formData);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email and password.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // The code matters. `email_not_confirmed` and `invalid_credentials` are
  // different failures with different fixes, and this used to answer both with
  // "Email or password is incorrect." See lib/auth-errors.ts and D-092.
  if (error) {
    redirect(`/login?error=${encodeURIComponent(loginErrorMessage(error.status, error.code))}`);
  }
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const parsed = parseSignupInput(formData);
  if (!parsed.success) {
    redirect(
      `/signup?error=${encodeURIComponent("Check your name, email, password, and terms agreement.")}`,
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Without this the confirmation link's redirect_to falls back to the
      // project's Site URL, which is the LANDING PAGE. The player clicks the
      // link, the token is verified, and they are dropped on the marketing page
      // with the code never exchanged for a session: confirmed, and apparently
      // signed out, with no way to tell they have an account. That is a silent
      // total blocker on signup and it is why nobody ever finished one.
      //
      // /auth/callback is the route that actually exchanges the code. It must
      // also be listed under Authentication -> URL Configuration -> Redirect
      // URLs, because an unlisted target is silently rewritten back to Site URL,
      // which reproduces the same bug with the fix apparently in place.
      // scripts/auth-preflight.mjs checks all of this against the live project.
      emailRedirectTo: `${SITE_URL}/auth/callback`,
      data: {
        display_name: parsed.data.display_name,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    redirect(
      `/signup?error=${encodeURIComponent(signupErrorMessage(error.status, error.code))}`,
    );
  }
  // Signing up again on an address that already has an unconfirmed account
  // lands here too, and looks identical to a first signup: the service answers
  // 200, returns the same user, resends the confirmation, and silently KEEPS
  // THE ORIGINAL PASSWORD. There is nothing in the response that distinguishes
  // the two, so the copy has to cover both cases honestly rather than pretend
  // this is always a fresh account.
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent(CONFIRM_SENT_MESSAGE)}`);
  }
  redirect("/welcome");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseForgotInput(formData);
  if (!parsed.success) {
    redirect(`/forgot?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // The send-email hook rebuilds this as origin + /auth/callback and drops any
    // path or query given here, so this only has to carry the right ORIGIN. It
    // is written out in full anyway: if the hook is ever disabled the default
    // template uses this verbatim, and a bare origin would land the player on
    // the landing page with the token unexchanged.
    redirectTo: `${SITE_URL}/auth/callback`,
  });

  // Rate limiting is the one failure worth naming, because waiting genuinely
  // fixes it. Everything else falls through to the same neutral confirmation:
  // /recover deliberately answers identically for addresses that do and do not
  // have an account, and reporting a failure here would undo that and turn this
  // form into an account-existence oracle.
  if (error && (error.status === 429 || error.code?.includes("rate_limit"))) {
    redirect(
      `/forgot?error=${encodeURIComponent(resetRequestErrorMessage(error.status, error.code))}`,
    );
  }
  redirect(`/forgot?message=${encodeURIComponent(RESET_SENT_MESSAGE)}`);
}

export async function updatePassword(formData: FormData) {
  const parsed = parseResetInput(formData);
  if (!parsed.success) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Use at least 8 characters, and make both fields match.")}`,
    );
  }

  const supabase = await createClient();
  // Verifying the recovery link already put a real session in the cookie jar,
  // which is what authorizes this. It also confirms the email as a side effect,
  // so a player who never confirmed is fully recovered by this one path.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(
      `/reset-password?error=${encodeURIComponent(updatePasswordErrorMessage(error.status, error.code))}`,
    );
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
