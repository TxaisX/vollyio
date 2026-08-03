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

test("signup requires bounded identity fields and terms assent", () => {
  const valid = new FormData();
  valid.set("display_name", "  Player One  ");
  valid.set("email", "PLAYER@EXAMPLE.COM");
  valid.set("password", "eight-or-more");
  valid.set("terms", "on");
  assert.deepEqual(parseSignupInput(valid), {
    success: true,
    data: {
      display_name: "Player One",
      email: "player@example.com",
      password: "eight-or-more",
      terms: true,
    },
  });

  const missingTerms = new FormData();
  missingTerms.set("email", "player@example.com");
  missingTerms.set("password", "eight-or-more");
  assert.equal(parseSignupInput(missingTerms).success, false);

  const longName = new FormData();
  longName.set("display_name", "x".repeat(81));
  longName.set("email", "player@example.com");
  longName.set("password", "eight-or-more");
  longName.set("terms", "on");
  assert.equal(parseSignupInput(longName).success, false);
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
