"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}

// Auth errors surface to the form as-is unless mapped here. The rate-limit one
// is the email-sending cap on the account-confirmation mail, not anything this
// app enforces; players get told what to actually do about it.
function friendlyAuthError(message: string): string {
  if (/rate limit/i.test(message)) {
    return "Too many signups this hour. Your answers are saved on this device. Wait a bit and try again.";
  }
  return message;
}

export async function signup(formData: FormData) {
  // Clickwrap: the terms only bind people who assent, so assent is required
  // here on the server, not just by the checkbox in the browser. The
  // acceptance instant rides the auth record as evidence.
  if (formData.get("terms") !== "on") {
    redirect(
      `/signup?error=${encodeURIComponent("Please confirm you are at least 13 and agree to the terms.")}`,
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: {
      data: {
        display_name: String(formData.get("display_name") ?? ""),
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
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
