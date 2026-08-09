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
  for (const p of [
    "/",
    "/login",
    "/signup",
    "/forgot",
    "/reset-password",
    "/privacy",
    "/terms",
    "/share/abc123",
  ]) {
    assert.equal(guardDecision(p, null), "pass", p);
  }
});

// The recovery flow signs the player in BEFORE they choose a password, so the
// page that collects it is reached only ever by someone the guard already
// counts as signed in. If /reset-password were treated as an entry path it
// would bounce to the dashboard and password reset would be unreachable. This
// is the regression test for that, not a style preference (D-092).
test("password recovery is reachable with the session its own link creates", () => {
  assert.equal(guardDecision("/reset-password", "user-1"), "pass");
  assert.equal(guardDecision("/forgot", "user-1"), "pass");
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

// The teaching content is public and has to STAY public, because the share page
// links into it. `/drills` sat in PROTECTED once, purely because it lives in the
// (app) route group, and the cost of that was invisible: every stranger arriving
// through a share link - the one channel that has ever brought this product
// traffic - read the recommended drills as dead text with nowhere to go.
//
// If a future change puts either path back behind the guard, the share page
// starts emitting links to /login instead, and nothing else will fail. This test
// is the only thing that would notice.
test("teaching content stays reachable without a session, so share links lead somewhere", () => {
  for (const p of [
    "/drills",
    "/drills/serve-toss-and-freeze",
    "/learn",
    "/learn/attack",
    "/samples",
    "/share/abc123",
  ]) {
    assert.equal(guardDecision(p, null), "pass", `${p} must be public`);
  }
  assert.ok(
    !PROTECTED.some((p) => "/drills".startsWith(p) || "/learn".startsWith(p)),
    "content that belongs to nobody must not be in PROTECTED",
  );
});
