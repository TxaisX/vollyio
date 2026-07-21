import { test } from "node:test";
import assert from "node:assert/strict";
import { generateShareToken, hashShareToken } from "./share-token.ts";

test("tokens are unique, URL-safe, and long enough to be unguessable", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});

test("hashing is deterministic hex sha256 and never echoes the token", () => {
  const token = generateShareToken();
  const hash = hashShareToken(token);
  assert.equal(hash, hashShareToken(token));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(token));
  // Pinned vector so the DB-side digest in migration 019 can be checked
  // against the same input if it is ever rewritten.
  assert.equal(
    hashShareToken("sideout"),
    "7e5e2c5c4498902318cbcfe6db68da4652d9ef9dcef2c6b39dcea74e62846248",
  );
});
