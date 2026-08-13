import assert from "node:assert/strict";
import test from "node:test";

import { ANONYMOUS_ALLOWED, guardDecision, PROTECTED } from "./route-guard.ts";

test("a visitor is sent to login from every protected path, and its children", () => {
  for (const p of PROTECTED) {
    assert.equal(guardDecision(p, null, false), "to-login", p);
    assert.equal(
      guardDecision(`${p}/some-child-route`, null, false),
      "to-login",
      `${p} child`,
    );
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
    assert.equal(guardDecision(p, null, false), "pass", p);
  }
});

// The recovery flow signs the player in BEFORE they choose a password, so the
// page that collects it is reached only ever by someone the guard already
// counts as signed in. If /reset-password were treated as an entry path it
// would bounce to the dashboard and password reset would be unreachable. This
// is the regression test for that, not a style preference (D-092).
test("password recovery is reachable with the session its own link creates", () => {
  assert.equal(guardDecision("/reset-password", "user-1", false), "pass");
  assert.equal(guardDecision("/forgot", "user-1", false), "pass");
});

test("a signed-in player is moved off the entry paths and left alone elsewhere", () => {
  for (const p of ["/", "/login", "/signup"]) {
    assert.equal(guardDecision(p, "user-1", false), "to-dashboard", p);
  }
  for (const p of ["/dashboard", "/analyze", "/settings", "/privacy", "/share/abc123"]) {
    assert.equal(guardDecision(p, "user-1", false), "pass", p);
  }
});

// The reason this function takes `userId: string | null` rather than a session
// object: a missing auth configuration and a failed lookup both arrive as null,
// so an unconfigured deployment cannot serve a protected page. Regression guard
// for the middleware crash that 500'd the whole site instead (see proxy.ts).
test("no verified user means protected paths are closed, however that happened", () => {
  assert.equal(guardDecision("/dashboard", null, false), "to-login");
  assert.equal(guardDecision("/analysis/some-id", null, false), "to-login");
  // A public page still renders when auth is unavailable, which is the whole
  // point of not throwing: marketing pages do not depend on a session.
  assert.equal(guardDecision("/", null, false), "pass");
  assert.equal(guardDecision("/login", null, false), "pass");
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
    assert.equal(guardDecision(p, null, false), "pass", `${p} must be public`);
  }
  assert.ok(
    !PROTECTED.some((p) => "/drills".startsWith(p) || "/learn".startsWith(p)),
    "content that belongs to nobody must not be in PROTECTED",
  );
});

// D-118. The anonymous lane, and the three properties it has to hold.

test("an anonymous session reaches the flow that produces its one read, and its result", () => {
  for (const p of ["/analyze", "/analyze?skill=attack", "/analysis/some-id"]) {
    assert.equal(guardDecision(p, "anon-1", true), "pass", p);
  }
});

// Deny by default. Every one of these assumes an account: a plan to change, a
// body of work to show, or a budget to spend.
test("an anonymous session is refused every account-only path", () => {
  for (const p of PROTECTED.filter(
    (p) => !ANONYMOUS_ALLOWED.some((a) => p.startsWith(a)),
  )) {
    assert.equal(guardDecision(p, "anon-1", true), "to-signup", p);
    assert.equal(
      guardDecision(`${p}/child`, "anon-1", true),
      "to-signup",
      `${p} child`,
    );
  }
});

// The loop this prevents: /login and /signup bounce a signed-in user to
// /dashboard, /dashboard refuses an anonymous one, and if that refusal pointed
// anywhere in ENTRY_PATHS the two rules would hand the player back and forth
// forever. Signing up is the conversion, so the signup page must simply render.
test("an anonymous session is never bounced off the page that converts it", () => {
  assert.equal(guardDecision("/signup", "anon-1", true), "pass");
  assert.equal(guardDecision("/login", "anon-1", true), "pass");
  assert.equal(guardDecision("/", "anon-1", true), "pass");
  assert.notEqual(guardDecision("/dashboard", "anon-1", true), "to-login");
});

test("public content stays public for an anonymous session too", () => {
  for (const p of ["/drills", "/learn/attack", "/share/abc123", "/privacy", "/terms"]) {
    assert.equal(guardDecision(p, "anon-1", true), "pass", p);
  }
});
