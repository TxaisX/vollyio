import "server-only";
import { createSign } from "node:crypto";

// The IO half of Play Billing (D-125): a service-account token minted with
// node:crypto and the two androidpublisher calls the integration needs. No
// googleapis SDK - it would bring a dependency tree to sign one JWT and make
// two REST calls, and the repo's dependency budget (AGENTS.md) says no.
//
// Configuration, all Vercel env:
//   GOOGLE_PLAY_SA_EMAIL  service account email (roles: view financial data +
//                         manage orders, granted in Play Console)
//   GOOGLE_PLAY_SA_KEY    the account's private key, PKCS8 PEM, newlines as \n
//   PLAY_PACKAGE_NAME     defaults to com.vollyio.app
//
// Unset means every caller fails CLOSED: no verification can succeed, so no
// plan can be granted, which is the correct behavior for a misconfigured
// deploy.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";

export function playPackageName(): string {
  return process.env.PLAY_PACKAGE_NAME || "com.vollyio.app";
}

export function playConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SA_EMAIL && process.env.GOOGLE_PLAY_SA_KEY);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * A fresh access token per call, no cache. The verify route runs once per
 * purchase and the RTDN route once per billing event, so the token mint is a
 * rounding error and a cache would be one more thing to age out wrong.
 */
async function accessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_PLAY_SA_EMAIL;
  const key = process.env.GOOGLE_PLAY_SA_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 300,
    }),
  );
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(`${header}.${claims}`).end().sign(key, "base64url");
  } catch {
    // A malformed key is a configuration error, and it reads as "not
    // configured" rather than as a Google outage.
    return null;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) return null;
  const json = (await response.json().catch(() => null)) as { access_token?: string } | null;
  return typeof json?.access_token === "string" ? json.access_token : null;
}

/**
 * The live subscription behind a purchase token, or null when Google cannot
 * or will not say. Null is never treated as "entitled" by any caller.
 */
export async function fetchPlaySubscription(purchaseToken: string): Promise<unknown | null> {
  const token = await accessToken();
  if (!token) return null;

  const response = await fetch(
    `${API}/applications/${encodeURIComponent(playPackageName())}` +
      `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

/**
 * Acknowledge a purchase so Play does not refund it after three days.
 *
 * Called only AFTER the plan write succeeds: an acknowledged purchase whose
 * plan write failed would be money taken for nothing, while an unacknowledged
 * purchase whose plan write succeeded heals on the next verify or refunds
 * itself. Failure is returned, not thrown - the caller's work is already
 * done and a retry rides the next verification.
 */
export async function acknowledgePlaySubscription(
  productId: string,
  purchaseToken: string,
): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;

  const response = await fetch(
    `${API}/applications/${encodeURIComponent(playPackageName())}` +
      `/purchases/subscriptions/${encodeURIComponent(productId)}` +
      `/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    },
  );
  return response.ok;
}
