import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// SOCIAL SIGN-IN MUST START FROM A ROUTE HANDLER, NEVER A SERVER ACTION.
//
// This is not a style preference. Google sign-in had never once worked: the
// Google Cloud OAuth user cap read 0 of 100 on 2026-08-10, meaning no human had
// ever completed the round trip, while every setting in both consoles was
// correct (matching client IDs, right callback URI, vollyio.com allowlisted,
// publishing status In production).
//
// `signInWithOAuth` runs PKCE, which mints a code verifier that must be written
// to a cookie and read back by /auth/callback. A server action redirecting to
// an EXTERNAL url does not deliver that Set-Cookie to the browser, so the
// verifier was gone by the time Google sent the player back and the exchange
// failed every time, for everyone. A route handler returns a plain 3xx, and the
// cookie is written onto that exact response.
const ROUTE = await readFile(
  new URL("../app/auth/signin/[provider]/route.ts", import.meta.url),
  "utf8",
);
const ACTIONS = await readFile(
  new URL("../app/(auth)/actions.ts", import.meta.url),
  "utf8",
);
const BUTTONS = await readFile(
  new URL("../app/(auth)/oauth-buttons.tsx", import.meta.url),
  "utf8",
);

test("the OAuth handoff is a GET route handler, not a server action", () => {
  assert.match(ROUTE, /export async function GET/);
  assert.match(ROUTE, /signInWithOAuth/);

  // The action is gone, not merely unused. Leaving a working-looking export
  // behind is an invitation to wire the broken path back up.
  assert.doesNotMatch(
    ACTIONS,
    /export async function signInWithProvider/,
    "social sign-in must not move back into a server action",
  );
  // The CALL, not the word: the comment left in that file explains why social
  // sign-in moved out, and naming the method is the whole point of it.
  assert.doesNotMatch(ACTIONS, /supabase\.auth\.signInWithOAuth/);
});

test("the verifier cookie is written onto the redirect the browser follows", () => {
  // Cookies go on the response OBJECT by hand. Relying on next/headers
  // propagation is the same class of assumption that caused the original bug.
  assert.match(ROUTE, /response\.cookies\.set/);
  assert.match(ROUTE, /response\.headers\.set\("Location"/);
  assert.doesNotMatch(
    ROUTE,
    /from "next\/headers"/,
    "this route must own its own cookie writes",
  );
});

test("the provider is still validated against the deployment's own list", () => {
  // The path segment is caller-supplied. Without this a crafted request could
  // aim the round trip at any provider the project happens to hold keys for.
  assert.match(ROUTE, /enabledOAuthProviders\(process\.env\.OAUTH_PROVIDERS\)/);
  assert.match(ROUTE, /isOAuthProvider\(provider\)/);
  assert.match(ROUTE, /enabled\.includes\(provider\)/);
});

test("the button is a link, so the browser follows a real redirect", () => {
  // A form posting to a server action reintroduces the bug even if the route
  // still exists, so the markup is pinned too.
  assert.match(BUTTONS, /href=\{`\/auth\/signin\/\$\{provider\}`\}/);
  assert.doesNotMatch(BUTTONS, /signInWithProvider/);
  assert.doesNotMatch(BUTTONS, /<form/);
});
