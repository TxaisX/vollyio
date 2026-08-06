import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TURNSTILE_ORIGIN,
  TURNSTILE_SCRIPT_URL,
  captchaSiteKey,
  normalizeCaptchaToken,
} from "./captcha.ts";

const KEY = "NEXT_PUBLIC_TURNSTILE_SITE_KEY";

function withKey<T>(value: string | undefined, run: () => T): T {
  const saved = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  }
}

test("captcha is off until a site key is deliberately set", () => {
  // The default is the whole safety property. An unconfigured deployment must
  // render no widget and send no token, because arming Supabase against a
  // client that is not sending one rejects every signup and every login.
  withKey(undefined, () => assert.equal(captchaSiteKey(), null));
  withKey("", () => assert.equal(captchaSiteKey(), null));
  withKey("   ", () => assert.equal(captchaSiteKey(), null));
});

test("a configured site key is trimmed and returned", () => {
  withKey("0x4AAAAAAA", () => assert.equal(captchaSiteKey(), "0x4AAAAAAA"));
  withKey("  0x4AAAAAAA  ", () => assert.equal(captchaSiteKey(), "0x4AAAAAAA"));
});

test("an absent token is undefined, never an empty string", () => {
  // `captchaToken: ""` reads to the auth service as a present-but-invalid
  // token. Undefined spreads away to nothing, which is what "no captcha" means.
  for (const junk of [undefined, null, "", "   ", 7, {}, []]) {
    assert.equal(normalizeCaptchaToken(junk), undefined);
  }
});

test("a real token survives, an absurd one does not", () => {
  assert.equal(normalizeCaptchaToken(" abc.def "), "abc.def");
  assert.equal(normalizeCaptchaToken("x".repeat(4096)), "x".repeat(4096));
  assert.equal(normalizeCaptchaToken("x".repeat(4097)), undefined);
});

test("the CSP origin is a prefix of the script URL, so the two cannot drift", () => {
  // A CSP that names a different host than the loader fetches blocks the widget
  // silently: no puzzle, no token, and every signup fails captcha verification
  // with only a console error to show for it.
  assert.ok(TURNSTILE_SCRIPT_URL.startsWith(TURNSTILE_ORIGIN));
});
