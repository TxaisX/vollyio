import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFailureStatus } from "./analyze-status.ts";

// The UTC calendar-month boundary the reservation reports. Assertions about
// the rendered form stay locale- and timezone-agnostic on purpose: the format
// belongs to the viewer's machine, only the "not raw, not Invalid Date"
// property belongs to this module.
const RESETS_AT = "2026-08-01T00:00:00+00:00";

test("503 stays the calm unavailable state", () => {
  const s = analyzeFailureStatus(503, null);
  assert.equal(s.kind, "unavailable");
  assert.match(s.message, /wasn't counted/);
  assert.equal(s.reason, null);
  assert.equal(s.resetsAt, null);
  assert.equal(s.canUpgrade, false);
});

test("429 hourly limit reads as calm, not as a failure", () => {
  const s = analyzeFailureStatus(429, null);
  assert.equal(s.kind, "unavailable");
  assert.match(s.message, /hourly/i);
  assert.equal(s.canUpgrade, false);
});

test("402 on a free plan routes to the upgrade destination", () => {
  const s = analyzeFailureStatus(402, {
    error: "You've used all 3 of your Free analyses this month.",
    reason: "free_month_exhausted",
    resets_at: RESETS_AT,
  });
  assert.equal(s.kind, "unavailable");
  assert.equal(s.reason, "free_month_exhausted");
  assert.equal(s.canUpgrade, true);
  assert.equal(s.message, "You've used all 3 of your Free analyses this month.");
  assert.notEqual(s.resetsAt, null);
  assert.notEqual(s.resetsAt, RESETS_AT);
  assert.doesNotMatch(String(s.resetsAt), /Invalid Date/);
});

test("402 on a paid plan offers nothing to buy but keeps the reset date", () => {
  const s = analyzeFailureStatus(402, {
    error: "You've used all 18 of your Pro analyses this month.",
    reason: "plan_month_exhausted",
    resets_at: RESETS_AT,
  });
  assert.equal(s.kind, "unavailable");
  assert.equal(s.reason, "plan_month_exhausted");
  assert.equal(s.canUpgrade, false);
  assert.notEqual(s.resetsAt, null);
});

test("402 with no body still says something true and offers a way out", () => {
  const s = analyzeFailureStatus(402, null);
  assert.equal(s.kind, "unavailable");
  assert.equal(s.reason, null);
  assert.equal(s.resetsAt, null);
  assert.equal(s.canUpgrade, true);
  assert.match(s.message, /month/i);
  assert.match(s.message, /upgrade/i);
});

test("402 fallback for a paid plan names the reset instead of an upgrade", () => {
  const s = analyzeFailureStatus(402, {
    reason: "plan_month_exhausted",
    resets_at: RESETS_AT,
  });
  assert.doesNotMatch(s.message, /upgrade/i);
  assert.ok(s.resetsAt && s.message.includes(s.resetsAt));
});

test("an unparseable reset date is omitted, never printed", () => {
  for (const resets of ["not a date", "", 17, null, undefined, {}]) {
    const s = analyzeFailureStatus(402, {
      reason: "plan_month_exhausted",
      resets_at: resets,
    });
    assert.equal(s.resetsAt, null);
    assert.doesNotMatch(s.message, /Invalid Date/);
    assert.equal(s.kind, "unavailable");
  }
});

test("a 402 never returns kind error, whatever the body looks like", () => {
  const bodies: unknown[] = [
    null,
    undefined,
    {},
    "a string body",
    ["an", "array"],
    { error: null, reason: null, resets_at: null },
    { reason: "something_else_entirely" },
    { error: "   ", reason: 42, resets_at: RESETS_AT },
  ];
  for (const body of bodies) {
    const s = analyzeFailureStatus(402, body as never);
    assert.equal(s.kind, "unavailable");
    assert.notEqual(s.message.trim(), "");
  }
});

test("a reason on a non-402 is ignored: only running out can be upgraded out of", () => {
  for (const status of [503, 429]) {
    const s = analyzeFailureStatus(status, {
      reason: "free_month_exhausted",
      resets_at: RESETS_AT,
    });
    assert.equal(s.kind, "unavailable");
    assert.equal(s.reason, null);
    assert.equal(s.resetsAt, null);
    assert.equal(s.canUpgrade, false);
  }
});

test("server copy wins over the fallback when present", () => {
  for (const status of [503, 429, 402, 502]) {
    assert.equal(
      analyzeFailureStatus(status, { error: "Server says so." }).message,
      "Server says so.",
    );
  }
});

test("blank server copy falls back", () => {
  assert.notEqual(analyzeFailureStatus(503, { error: "" }).message, "");
  assert.notEqual(analyzeFailureStatus(502, { error: "   " }).message.trim(), "");
});

test("conflicts and unknown failures stay the coral error state", () => {
  const conflict = analyzeFailureStatus(409, {
    error: "An analysis is already running.",
  });
  assert.equal(conflict.kind, "error");
  assert.equal(conflict.canUpgrade, false);
  assert.equal(analyzeFailureStatus(502, null).kind, "error");
  assert.equal(analyzeFailureStatus(500, null).kind, "error");
  assert.equal(analyzeFailureStatus(400, null).kind, "error");
});
