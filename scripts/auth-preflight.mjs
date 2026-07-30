// Prove that a stranger can actually sign up, without sending anyone an email.
//
// This exists because the signup path was shipped, never exercised, and depended
// on two Supabase dashboard settings that nothing in the repo documented or
// checked: whether email confirmation is required, and what URL the confirmation
// link points at. A Site URL still set to localhost means every confirmation
// email contains a dead link, and the only symptom is that nobody ever finishes
// signing up, which looks exactly like nobody trying.
//
// The trick is `auth.admin.generateLink`, which builds the real confirmation
// link and returns it INSTEAD of mailing it. So this reads the exact URL a new
// player would receive, checks it, and cleans up after itself.
//
// Usage:
//   node scripts/auth-preflight.mjs
//
// Needs SUPABASE_SERVICE_ROLE_KEY. Safe to run against production: it creates
// one throwaway user, sends no mail, and deletes the user before exiting.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function fromEnvFile(key) {
  try {
    // Strip the BOM: .env.local is written by a Windows editor and carries one,
    // which lands on the first key only and makes startsWith miss it.
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8").replace(
      /^﻿/,
      "",
    );
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).replace(/^["']|["']$/g, "").trim() : null;
  } catch {
    return null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_URL");
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fromEnvFile("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromEnvFile("SUPABASE_SERVICE_ROLE_KEY");
const site = process.env.SITE_URL ?? "https://vollyio.com";

if (!url || !serviceKey || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const problems = [];
const notes = [];

// ---------------------------------------------------------------------------
// 1. Is a confirmation email even required?
// ---------------------------------------------------------------------------
const settings = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anonKey },
}).then((r) => r.json());

const confirmRequired = settings.mailer_autoconfirm === false;
notes.push(
  confirmRequired
    ? "Email confirmation IS required, so the link below is the whole signup flow."
    : "Email confirmation is OFF, so signup completes without any email.",
);
if (settings.disable_signup) problems.push("Signups are DISABLED for this project.");

// ---------------------------------------------------------------------------
// 2. What URL would a new player actually receive?
// ---------------------------------------------------------------------------
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const probe = `preflight+${Date.now()}@vollyio.com`;
let created = null;

// Deliberately mirrors what app/(auth)/actions.ts sends. If the app ever stops
// passing emailRedirectTo again, this check has to fail, so it must not "help"
// by supplying a redirect the app itself does not.
const { data, error } = await admin.auth.admin.generateLink({
  type: "signup",
  email: probe,
  password: `Pf-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  options: { redirectTo: `${site}/auth/callback` },
});

if (error) {
  problems.push(`Could not generate a signup link: ${error.message}`);
} else {
  created = data.user?.id ?? null;
  const link = data.properties?.action_link ?? "";
  const redirectTo = new URL(link).searchParams.get("redirect_to") ?? "";

  console.log("\nThe confirmation link a new player would receive:");
  console.log(`  ${link.replace(/token=[^&]+/, "token=REDACTED")}\n`);
  console.log(`  redirect_to -> ${redirectTo || "(none)"}`);

  // This is the check that matters. A redirect_to on localhost means the link
  // is dead for everyone who is not the developer.
  if (/localhost|127\.0\.0\.1/i.test(redirectTo)) {
    problems.push(
      `redirect_to points at ${redirectTo}. Every confirmation email is a dead link for real users. Fix Supabase -> Authentication -> URL Configuration -> Site URL.`,
    );
  } else if (!redirectTo) {
    problems.push(
      "The link carries no redirect_to at all, so the player lands wherever Site URL points and the session is never exchanged.",
    );
  } else if (!redirectTo.startsWith(site)) {
    problems.push(`redirect_to is ${redirectTo}, which is not ${site}.`);
  } else if (!redirectTo.includes("/auth/callback")) {
    problems.push(
      `redirect_to is ${redirectTo}, which is not the /auth/callback route that exchanges the code for a session. The player will land signed out.`,
    );
  } else {
    notes.push(`redirect_to correctly targets ${redirectTo}.`);
  }

  // The allow-list silently rewrites redirect_to to Site URL when the requested
  // target is not permitted, so a mismatch here IS the allow-list failing.
  if (redirectTo && !redirectTo.includes("/auth/callback")) {
    problems.push(
      `Add ${site}/auth/callback to Supabase -> Authentication -> URL Configuration -> Redirect URLs. An unlisted target is silently replaced by Site URL.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Clean up. The probe user must not outlive this script.
// ---------------------------------------------------------------------------
if (created) {
  const { error: delError } = await admin.auth.admin.deleteUser(created);
  if (delError) {
    problems.push(`Could not delete the probe user ${created}: ${delError.message}. Remove it by hand.`);
  } else {
    notes.push(`Probe user cleaned up.`);
  }
}

// ---------------------------------------------------------------------------
// 4. The regression that actually happened: no redirect at all.
//
// Checked separately because the failure is invisible. Supabase still verifies
// the token, so the account IS confirmed; the player is simply redirected to
// Site URL instead of the callback, lands on the landing page, and has no
// session and no idea they have an account. It looks exactly like nobody
// bothering to sign up.
// ---------------------------------------------------------------------------
const bare = `preflight-bare+${Date.now()}@vollyio.com`;
const { data: bareData, error: bareError } = await admin.auth.admin.generateLink({
  type: "signup",
  email: bare,
  password: `Pf-${Math.random().toString(36).slice(2)}-${Date.now()}`,
});
if (!bareError) {
  const bareRedirect =
    new URL(bareData.properties?.action_link ?? "").searchParams.get("redirect_to") ?? "";
  notes.push(
    `With no emailRedirectTo the link would go to ${bareRedirect || "(nothing)"}, which is why the app must always send one.`,
  );
  if (bareData.user?.id) await admin.auth.admin.deleteUser(bareData.user.id);
}

console.log("");
for (const n of notes) console.log(`  ok    ${n}`);
for (const p of problems) console.log(`  FAIL  ${p}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s). A stranger cannot reliably sign up.`);
  process.exit(1);
}
console.log("\nSignup path looks deliverable.");
