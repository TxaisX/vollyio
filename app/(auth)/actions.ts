"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginInput, parseSignupInput } from "@/lib/auth-input";
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

  if (error) {
    const message =
      error.status === 429
        ? "Too many login attempts. Wait a bit and try again."
        : "Email or password is incorrect.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  redirect("/dashboard");
}

function friendlySignupError(status?: number, code?: string): string {
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "Too many signups this hour. Your answers are saved on this device. Wait a bit and try again.";
  }
  if (code === "weak_password") return "Use a stronger password and try again.";
  return "Couldn't create your account. Try again.";
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
      `/signup?error=${encodeURIComponent(friendlySignupError(error.status, error.code))}`,
    );
  }
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account.")}`);
  }
  redirect("/welcome");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
