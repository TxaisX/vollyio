import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIRM_SENT_MESSAGE,
  DEAD_LINK_MESSAGE,
  RESET_SENT_MESSAGE,
  loginErrorMessage,
  resetRequestErrorMessage,
  signupErrorMessage,
  updatePasswordErrorMessage,
} from "./auth-errors.ts";

// The regression this whole module exists for. An unconfirmed account with the
// correct password must never be told the password is wrong: that is what sent
// a real signup into a loop of re-creating the account on 2026-08-03 (D-092).
test("an unconfirmed email is never reported as a wrong password", () => {
  const unconfirmed = loginErrorMessage(400, "email_not_confirmed");
  assert.match(unconfirmed, /not confirmed/i);
  assert.doesNotMatch(unconfirmed, /password is incorrect/i);
  // It has to name the way out, not just the diagnosis.
  assert.match(unconfirmed, /Forgot your password/i);
  assert.match(unconfirmed, /newest/i);

  const wrongPassword = loginErrorMessage(400, "invalid_credentials");
  assert.match(wrongPassword, /Email or password is incorrect/i);
  assert.notEqual(wrongPassword, unconfirmed);
});

// Signing up again with the same address keeps the ORIGINAL password and says
// nothing about it, so the generic failure has to volunteer that.
test("the generic login failure explains the kept-first-password trap", () => {
  const message = loginErrorMessage(400, "invalid_credentials");
  assert.match(message, /first password/i);
  assert.match(message, /Forgot your password/i);
});

test("rate limits are told apart from credential failures everywhere", () => {
  assert.match(loginErrorMessage(429), /Too many login attempts/i);
  assert.match(loginErrorMessage(undefined, "over_request_rate_limit"), /Too many/i);
  assert.match(signupErrorMessage(429), /Too many signups/i);
  assert.match(
    signupErrorMessage(undefined, "over_email_send_rate_limit"),
    /Too many signups/i,
  );
  assert.match(resetRequestErrorMessage(429), /Too many attempts/i);
  assert.match(updatePasswordErrorMessage(429), /Too many attempts/i);
});

test("signup failures stay specific where the service is specific", () => {
  assert.match(signupErrorMessage(422, "weak_password"), /stronger password/i);
  assert.match(signupErrorMessage(422, "user_already_exists"), /already has an account/i);
  assert.match(signupErrorMessage(500), /Couldn't create your account/i);
});

test("a dead recovery session sends the player back for a fresh link", () => {
  for (const failure of [
    updatePasswordErrorMessage(401),
    updatePasswordErrorMessage(403),
    updatePasswordErrorMessage(400, "session_not_found"),
  ]) {
    assert.match(failure, /expired/i);
    assert.match(failure, /new one/i);
  }
  assert.match(updatePasswordErrorMessage(422, "weak_password"), /stronger password/i);
  assert.match(updatePasswordErrorMessage(422, "same_password"), /different one/i);
});

// An account-existence oracle is the classic way a reset form leaks. The copy
// must read identically whether or not the address is registered, so it may not
// contain a definite claim either way.
test("the reset confirmation cannot reveal whether the account exists", () => {
  assert.match(RESET_SENT_MESSAGE, /if that email has/i);
  assert.doesNotMatch(RESET_SENT_MESSAGE, /\bwe sent you\b|\byour account\b/i);
});

test("link copy tells the player which email to open", () => {
  assert.match(DEAD_LINK_MESSAGE, /newest/i);
  assert.match(CONFIRM_SENT_MESSAGE, /newest/i);
});

// House rule, enforced by scripts/lint.mjs for source but worth pinning on the
// copy itself: no em dashes, and no vendor names in anything a player reads.
test("player-facing copy keeps the house voice", () => {
  const all = [
    loginErrorMessage(400, "email_not_confirmed"),
    loginErrorMessage(400, "invalid_credentials"),
    signupErrorMessage(422, "weak_password"),
    resetRequestErrorMessage(500),
    updatePasswordErrorMessage(401),
    RESET_SENT_MESSAGE,
    DEAD_LINK_MESSAGE,
    CONFIRM_SENT_MESSAGE,
  ];
  // Written as an escape, not the character: scripts/lint.mjs bans the literal
  // from source, and this file is source.
  const emDash = /\u2014/;
  for (const message of all) {
    assert.doesNotMatch(message, emDash, `em dash in: ${message}`);
    assert.doesNotMatch(
      message,
      /\b(?:Anthropic|Claude|OpenAI|Supabase|Vercel)\b/i,
      `vendor name in: ${message}`,
    );
  }
});
