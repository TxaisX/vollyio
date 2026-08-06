// Bot protection for the auth forms, via Cloudflare Turnstile.
//
// This exists because account creation became free, in every sense, on
// 2026-08-06: D-102 turned email confirmation off, which was the last friction
// standing between a script and an unbounded number of accounts. Each account
// carries a six-analysis signup grant, so a farmed account is worth real money
// drawn from ONE prepaid model balance that the app cannot even read. The
// monthly spend cap was removed deliberately (D-104) because it answers the
// wrong question: it degrades the product for everyone once tripped, rather
// than stopping the thing doing the spending. This is the thing that stops it.
//
// SILENT BY REQUIREMENT. The widget runs in Turnstile's invisible /
// interaction-only mode, so a real player never sees a puzzle, never clicks a
// checkbox, and never knows it ran. A captcha that costs a legitimate signup
// any friction would be buying protection with the exact conversion this
// month's funnel work was spent earning.
//
// THE SITE KEY IS PUBLIC, BY DESIGN. Turnstile splits its credentials: the site
// key is embedded in the page and is meant to be, and the SECRET key is
// verified server-side by Supabase Auth and is set in the Supabase dashboard.
// The secret therefore never enters this repo, this bundle, or any environment
// variable here. If you find yourself pasting a Turnstile secret into the app,
// something has gone wrong.

// Cloudflare's fixed script URL. Explicit rendering, because implicit rendering
// scans the DOM at script load and React has not mounted the container yet.
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// The origin the CSP has to name. Kept here so `next.config.ts` and the loader
// cannot drift apart: a CSP that forgets this blocks the widget silently, and
// the symptom is every signup failing captcha verification with a console error
// nobody is watching.
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * The configured site key, or null.
 *
 * Null means captcha is not configured, the widget renders nothing, and the
 * forms behave exactly as they did before. That default is deliberate and it
 * has to stay: **the order of operations is app-first, Supabase-second.**
 * Turning on "Enable CAPTCHA protection" in Supabase while the client is not
 * yet sending a token rejects EVERY signup and login, including the owner's,
 * with a failure that looks like a broken password. Ship the key, confirm a
 * token is riding along, and only then arm Supabase.
 */
export function captchaSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Normalize a submitted token.
 *
 * Turnstile tokens are opaque and bounded; anything absurd is refused before it
 * reaches the auth service rather than forwarded. Returns undefined rather than
 * empty string so it can be spread into the Supabase options object and simply
 * vanish when absent, instead of sending `captchaToken: ""` which reads as a
 * present-but-invalid token.
 */
export function normalizeCaptchaToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > 4096) return undefined;
  return trimmed;
}
