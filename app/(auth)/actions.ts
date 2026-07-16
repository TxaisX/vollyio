"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginInput, parseSignupInput } from "@/lib/auth-input";

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
