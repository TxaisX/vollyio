import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OAUTH_LABEL,
  OAUTH_PROVIDERS,
  enabledOAuthProviders,
  isOAuthProvider,
} from "./oauth.ts";

test("nothing is offered until a provider is deliberately named", () => {
  // The default matters more than any other case here. An unconfigured
  // deployment must render zero social buttons, because a button that cannot
  // finish its round trip is worse than the password form it replaced.
  assert.deepEqual(enabledOAuthProviders(undefined), []);
  assert.deepEqual(enabledOAuthProviders(null), []);
  assert.deepEqual(enabledOAuthProviders(""), []);
  assert.deepEqual(enabledOAuthProviders("   "), []);
  assert.deepEqual(enabledOAuthProviders(",,"), []);
});

test("providers parse case and whitespace insensitively", () => {
  assert.deepEqual(enabledOAuthProviders("google"), ["google"]);
  assert.deepEqual(enabledOAuthProviders("  GOOGLE  "), ["google"]);
  assert.deepEqual(enabledOAuthProviders("google,apple"), ["google", "apple"]);
  assert.deepEqual(enabledOAuthProviders("google, apple"), ["google", "apple"]);
});

test("a typo costs one button, never the page", () => {
  assert.deepEqual(enabledOAuthProviders("google,githbu"), ["google"]);
  assert.deepEqual(enabledOAuthProviders("facebook"), []);
});

test("order is ours, not the environment's, and duplicates collapse", () => {
  // Otherwise the buttons reorder themselves when someone edits the variable,
  // and positional memory is the thing that makes a returning player's login
  // one tap instead of a decision.
  assert.deepEqual(enabledOAuthProviders("apple,google"), ["google", "apple"]);
  assert.deepEqual(enabledOAuthProviders("google,google,apple"), ["google", "apple"]);
});

test("the provider guard refuses anything not on the list", () => {
  // This is what stands between a forged form field and the auth service.
  for (const provider of OAUTH_PROVIDERS) assert.equal(isOAuthProvider(provider), true);
  for (const junk of ["", "GOOGLE", "facebook", "../google", null, undefined, 7, {}]) {
    assert.equal(isOAuthProvider(junk), false);
  }
});

test("every provider carries a label", () => {
  for (const provider of OAUTH_PROVIDERS) {
    assert.equal(typeof OAUTH_LABEL[provider], "string");
    assert.ok(OAUTH_LABEL[provider].length > 0);
  }
});
