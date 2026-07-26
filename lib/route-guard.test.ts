import assert from "node:assert/strict";
import test from "node:test";

import { guardDecision, PROTECTED } from "./route-guard.ts";

test("a visitor is sent to login from every protected path, and its children", () => {
  for (const p of PROTECTED) {
    assert.equal(guardDecision(p, null), "to-login", p);
    assert.equal(guardDecision(`${p}/some-child-route`, null), "to-login", `${p} child`);
  }
});

test("a visitor passes through public paths", () => {
  for (const p of ["/", "/login", "/signup", "/privacy", "/terms", "/share/abc123"]) {
    assert.equal(guardDecision(p, null), "pass", p);
  }
});

test("a signed-in player is moved off the entry paths and left alone elsewhere", () => {
  for (const p of ["/", "/login", "/signup"]) {
    assert.equal(guardDecision(p, "user-1"), "to-dashboard", p);
  }
  for (const p of ["/dashboard", "/analyze", "/settings", "/privacy", "/share/abc123"]) {
    assert.equal(guardDecision(p, "user-1"), "pass", p);
  }
});

// The reason this function takes `userId: string | null` rather than a session
// object: a missing auth configuration and a failed lookup both arrive as null,
// so an unconfigured deployment cannot serve a protected page. Regression guard
// for the middleware crash that 500'd the whole site instead (see proxy.ts).
test("no verified user means protected paths are closed, however that happened", () => {
  assert.equal(guardDecision("/dashboard", null), "to-login");
  assert.equal(guardDecision("/analysis/some-id", null), "to-login");
  // A public page still renders when auth is unavailable, which is the whole
  // point of not throwing: marketing pages do not depend on a session.
  assert.equal(guardDecision("/", null), "pass");
  assert.equal(guardDecision("/login", null), "pass");
});
