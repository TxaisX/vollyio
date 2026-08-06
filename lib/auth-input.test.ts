import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseForgotInput,
  parseLoginInput,
  parseResetInput,
  parseSignupInput,
} from "./auth-input.ts";

test("login input normalizes email and caps password length", () => {
  const valid = new FormData();
  valid.set("email", " PLAYER@EXAMPLE.COM ");
  valid.set("password", "correct horse battery staple");
  assert.deepEqual(parseLoginInput(valid), {
    success: true,
    data: {
      email: "player@example.com",
      password: "correct horse battery staple",
    },
  });

  const oversized = new FormData();
  oversized.set("email", "player@example.com");
  oversized.set("password", "x".repeat(129));
  assert.equal(parseLoginInput(oversized).success, false);
});

test("signup is two fields, normalized and bounded", () => {
  const valid = new FormData();
  valid.set("email", "PLAYER@EXAMPLE.COM");
  valid.set("password", "eight-or-more");
  assert.deepEqual(parseSignupInput(valid), {
    success: true,
    data: {
      email: "player@example.com",
      password: "eight-or-more",
    },
  });

  const tooShort = new FormData();
  tooShort.set("email", "player@example.com");
  tooShort.set("password", "short");
  assert.equal(parseSignupInput(tooShort).success, false);

  const junkEmail = new FormData();
  junkEmail.set("email", "not-an-email");
  junkEmail.set("password", "eight-or-more");
  assert.equal(parseSignupInput(junkEmail).success, false);
});

test("signup ignores a name or terms field rather than requiring one", () => {
  // Both were required until the funnel work. A stale cached form, or a bot
  // replaying the old shape, must not be refused for sending extra fields, and
  // must not be able to smuggle either one back into the parsed account data.
  const legacyShape = new FormData();
  legacyShape.set("display_name", "Player One");
  legacyShape.set("terms", "on");
  legacyShape.set("email", "player@example.com");
  legacyShape.set("password", "eight-or-more");
  const parsed = parseSignupInput(legacyShape);
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data, {
    email: "player@example.com",
    password: "eight-or-more",
  });

  // And the new shape succeeds with neither field present at all.
  const minimal = new FormData();
  minimal.set("email", "player@example.com");
  minimal.set("password", "eight-or-more");
  assert.equal(parseSignupInput(minimal).success, true);
});

test("a reset request normalizes the email the same way login does", () => {
  const valid = new FormData();
  valid.set("email", "  PLAYER@EXAMPLE.COM  ");
  assert.deepEqual(parseForgotInput(valid), {
    success: true,
    data: { email: "player@example.com" },
  });

  const junk = new FormData();
  junk.set("email", "not-an-email");
  assert.equal(parseForgotInput(junk).success, false);
});

test("a new password must be long enough and typed twice identically", () => {
  const valid = new FormData();
  valid.set("password", "eight-or-more");
  valid.set("confirm", "eight-or-more");
  assert.equal(parseResetInput(valid).success, true);

  // The player is locked out already; a silent typo would lock them out again.
  const mismatched = new FormData();
  mismatched.set("password", "eight-or-more");
  mismatched.set("confirm", "eight-or-mors");
  assert.equal(parseResetInput(mismatched).success, false);

  const tooShort = new FormData();
  tooShort.set("password", "short");
  tooShort.set("confirm", "short");
  assert.equal(parseResetInput(tooShort).success, false);

  const missingConfirm = new FormData();
  missingConfirm.set("password", "eight-or-more");
  assert.equal(parseResetInput(missingConfirm).success, false);
});
