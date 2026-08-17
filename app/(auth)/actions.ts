"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CONFIRM_SENT_MESSAGE,
  RESET_SENT_MESSAGE,
  anonymousStartErrorMessage,
  loginErrorMessage,
  resetRequestErrorMessage,
  signupErrorMessage,
  updatePasswordErrorMessage,
} from "@/lib/auth-errors";
import {
  captchaTokenFrom,
  parseForgotInput,
  parseLoginInput,
  parseResetInput,
  parseSignupInput,
} from "@/lib/auth-input";
import { SITE_URL } from "@/lib/site";
import { claimDestination } from "@/lib/signup-destination";

export async function login(formData: FormData) {
  const parsed = parseLoginInput(formData);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email and password.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    // Spread rather than assigned: when captcha is not configured this key is
    // absent entirely, rather than sent as an empty string the auth service
    // would read as a present-but-invalid token.
    options: { captchaToken: captchaTokenFrom(formData) },
  });

  // The code matters. `email_not_confirmed` and `invalid_credentials` are
  // different failures with different fixes, and this used to answer both with
  // "Email or password is incorrect." See lib/auth-errors.ts and D-092.
  if (error) {
    redirect(`/login?error=${encodeURIComponent(loginErrorMessage(error.status, error.code))}`);
  }
  redirect("/dashboard");
}

/**
 * D-118. The free read: a session with no email address behind it.
 *
 * This is a REAL Supabase session, not a cookie of our own invention, and that
 * is the whole design. `auth.uid()` resolves, so every RLS policy, every
 * `${user.id}/` storage path and the entitlement function all work unchanged,
 * and `signup` below turns this same row into an account rather than copying
 * anything across.
 *
 * The captcha rides on this call for the same reason it rides on signup: this
 * is now the cheapest way to spend model budget without an account, so it is
 * the door that has to be watched. Supabase verifies the token against the
 * secret it already holds; nothing is verified here (`lib/captcha.ts`).
 *
 * Consent is recorded exactly as the signup form records it: submitting the
 * button under the disclosure IS the assent, and the timestamp is written onto
 * the row, where it survives the conversion because the row survives it.
 *
 * The disclosure on /try is the general one, and the age and recording
 * statements are spelled out at signup instead (D-118a). This timestamp is
 * unaffected by that: it records that the Terms were accepted here, which they
 * were, and it is the same field the signup path writes.
 */
export async function startAnonymously(formData: FormData) {
  const supabase = await createClient();

  // ANY existing session short-circuits this, and the anonymous case is the one
  // that actually matters. `signInAnonymously` does not resume a session, it
  // mints a NEW user, and the one-run cap is counted per user: a player who
  // spent their free read and came back to this page would be handed a fresh
  // row and a fresh free read, by us, in one tap. Clearing storage to get
  // another read is a leak this decision accepts (D-118); putting a button on
  // the site that does it is not.
  //
  // A player with a real account is sent on for a different reason: minting
  // here would REPLACE the session they are holding and strand them in a lane
  // with one analysis and no settings.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/analyze");

  const { error } = await supabase.auth.signInAnonymously({
    options: {
      captchaToken: captchaTokenFrom(formData),
      data: { terms_accepted_at: new Date().toISOString() },
    },
  });

  if (error) {
    redirect(
      `/try?error=${encodeURIComponent(anonymousStartErrorMessage(error.status, error.code))}`,
    );
  }
  redirect("/analyze");
}

export async function signup(formData: FormData) {
  // D-121. The wall's return address, allowlisted before anything trusts it.
  // Carried through the error redirects below so a typo in the password does
  // not cost an anonymous player the way back to their locked breakdown.
  const next = claimDestination(formData.get("next"));
  const nextParam = next === "/welcome" ? "" : `&next=${encodeURIComponent(next)}`;

  const parsed = parseSignupInput(formData);
  if (!parsed.success) {
    redirect(
      `/signup?error=${encodeURIComponent("Check your name, email, password, and terms agreement.")}${nextParam}`,
    );
  }
  const supabase = await createClient();

  // D-118. An anonymous player claiming the read they are already looking at.
  // This is an UPDATE, not a second account: the row keeps its id, so the
  // analysis, the rating and the skill history it already owns stay exactly
  // where they are. Creating a fresh account here instead would silently orphan
  // the one thing that made them willing to sign up.
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  if (current?.is_anonymous) {
    const { data: claimed, error: claimError } = await supabase.auth.updateUser({
      email: parsed.data.email,
      password: parsed.data.password,
      data: { terms_accepted_at: new Date().toISOString() },
    });
    if (claimError) {
      redirect(
        `/signup?error=${encodeURIComponent(signupErrorMessage(claimError.status, claimError.code))}${nextParam}`,
      );
    }
    // Email confirmation is off (D-102), so the address lands immediately and
    // the row stops being anonymous inside this call. If it is ever turned back
    // on, the update is held until the link is clicked and the player is STILL
    // anonymous here: say so, rather than sending them onward into a product
    // that will keep refusing them.
    if (claimed?.user?.is_anonymous) {
      redirect(`/login?message=${encodeURIComponent(CONFIRM_SENT_MESSAGE)}`);
    }
    // Back to the breakdown the wall refused them (D-121), which their row now
    // opens in full; /welcome only when the claim started somewhere else.
    redirect(next);
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      captchaToken: captchaTokenFrom(formData),
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
        // No display_name: the form no longer asks for one, and the onboarding
        // flow collects it a moment later at no cost. Sending an empty string
        // here would write a blank name over nothing and make `/welcome`
        // greet the player by no one.
        //
        // Consent is still recorded. Submitting the form IS the assent now,
        // disclosed directly above the button, so the timestamp means exactly
        // what it meant when a checkbox produced it.
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

/*
 * SOCIAL SIGN-IN NO LONGER LIVES HERE. It was a server action, and that is
 * precisely why it never worked: `signInWithOAuth` runs PKCE, whose code
 * verifier must be written to a cookie and read back by /auth/callback, and a
 * server action redirecting to an EXTERNAL url does not get that Set-Cookie to
 * the browser. Google's OAuth user cap read 0 of 100 on 2026-08-10 - not one
 * human had ever completed it - while every console setting was correct.
 *
 * It is now app/auth/signin/[provider]/route.ts, which answers with a plain
 * HTTP redirect and writes the cookie onto that exact response. Do not move it
 * back. There is still no email confirmation on this path, which remains the
 * point: an address vouched for by Google arrives already verified, so the
 * player goes from one tap to a session with no trip through an inbox, and
 * that inbox round trip is where a quarter of our signups have died.
 */

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseForgotInput(formData);
  if (!parsed.success) {
    redirect(`/forgot?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: captchaTokenFrom(formData),
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
  // Home, not the login form. Signing out is not the first step of signing back
  // in: dropping someone on a form they did not ask for reads as "you are
  // locked out" rather than "you are out", and the marketing page is the one
  // surface that says what they just stopped paying attention to.
  redirect("/");
}
