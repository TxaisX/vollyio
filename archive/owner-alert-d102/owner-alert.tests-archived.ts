import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_INTERVAL_MS,
  ALERT_RETRY_MS,
  alertKey,
  alertOwnerBudget,
  claimAlert,
  formatBudgetAlert,
  isAlertDue,
  resetOwnerAlertsForTests,
  utcMonthKey,
  type AlertClaims,
} from "./owner-alert.ts";
// Type-only, so the server-only mail module is never loaded by the test run.
import type { EmailMessage } from "./email.ts";

// 2026-07-15 12:00 UTC, comfortably inside a month so the month key is stable.
const JULY = Date.UTC(2026, 6, 15, 12);

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  savedEnv.owner = process.env.OWNER_ALERT_EMAIL;
  delete process.env.OWNER_ALERT_EMAIL;
  resetOwnerAlertsForTests();
});
afterEach(() => {
  if (savedEnv.owner === undefined) delete process.env.OWNER_ALERT_EMAIL;
  else process.env.OWNER_ALERT_EMAIL = savedEnv.owner;
  resetOwnerAlertsForTests();
});

test("the first alert for a condition sends and an immediate repeat does not", () => {
  const claims: AlertClaims = new Map();
  assert.equal(claimAlert(claims, "tripped", JULY), true);
  assert.equal(claimAlert(claims, "tripped", JULY), false);
  assert.equal(claimAlert(claims, "tripped", JULY + 1000), false);
  assert.equal(
    claimAlert(claims, "tripped", JULY + ALERT_INTERVAL_MS - 1),
    false,
    "one millisecond short of the interval is still the same alert",
  );
});

test("a repeat after the interval sends again", () => {
  const claims: AlertClaims = new Map();
  assert.equal(claimAlert(claims, "tripped", JULY), true);
  assert.equal(claimAlert(claims, "tripped", JULY + ALERT_INTERVAL_MS), true);
  assert.equal(claimAlert(claims, "tripped", JULY + ALERT_INTERVAL_MS), false);
  assert.equal(claimAlert(claims, "tripped", JULY + 2 * ALERT_INTERVAL_MS), true);
});

test("a different verdict is a different condition and sends", () => {
  const claims: AlertClaims = new Map();
  assert.equal(claimAlert(claims, "tripped", JULY), true);
  assert.equal(
    claimAlert(claims, "unavailable", JULY),
    true,
    "a guard that cannot read spend is not the same news as a guard that tripped",
  );
  assert.equal(claimAlert(claims, "unavailable", JULY), false);
});

test("a new UTC month is a different condition even inside the interval", () => {
  const claims: AlertClaims = new Map();
  const julyLate = Date.UTC(2026, 6, 31, 23);
  const augustEarly = Date.UTC(2026, 7, 1, 1);
  assert.ok(augustEarly - julyLate < ALERT_INTERVAL_MS);
  assert.equal(claimAlert(claims, "tripped", julyLate), true);
  assert.equal(
    claimAlert(claims, "tripped", augustEarly),
    true,
    "the cap resets with the month, so the trip is new news",
  );
});

test("isAlertDue is a pure function of the last send and the instant", () => {
  assert.equal(isAlertDue(null, JULY), true);
  assert.equal(isAlertDue(JULY, JULY), false);
  assert.equal(isAlertDue(JULY, JULY + ALERT_INTERVAL_MS - 1), false);
  assert.equal(isAlertDue(JULY, JULY + ALERT_INTERVAL_MS), true);
  assert.equal(isAlertDue(JULY, JULY, 0), true, "the interval is injectable");
});

test("a clock that steps backwards suppresses rather than spams", () => {
  assert.equal(isAlertDue(JULY, JULY - ALERT_INTERVAL_MS), false);
});

test("the alert key names the month and the verdict", () => {
  assert.equal(utcMonthKey(JULY), "2026-07");
  assert.equal(alertKey("tripped", JULY), "2026-07:tripped");
  assert.notEqual(alertKey("tripped", JULY), alertKey("unavailable", JULY));
});

test("the tripped mail carries the estimate, the cap, and the one fix", () => {
  const { subject, text } = formatBudgetAlert({
    verdict: "tripped",
    capUsd: 5,
    estimatedUsd: 5.12,
    atMs: JULY,
  });
  assert.match(subject, /tripped/);
  assert.match(subject, /2026-07/);
  assert.match(text, /Verdict:\s+tripped/);
  assert.match(text, /\$5\.12 estimated/);
  assert.match(text, /Monthly cap:\s+\$5\.00/);
  assert.match(text, /ANALYZE_MONTHLY_BUDGET_USD/);
});

test("the unavailable mail says the estimate is unknown and points at the aggregate", () => {
  const { subject, text } = formatBudgetAlert({
    verdict: "unavailable",
    capUsd: 5,
    estimatedUsd: null,
    atMs: JULY,
  });
  assert.match(subject, /cannot read spend/);
  assert.match(text, /Verdict:\s+unavailable/);
  assert.match(text, /Month to date:\s+unknown/);
  assert.match(text, /Monthly cap:\s+\$5\.00/);
  assert.match(text, /analyze_usage_month/);
});

test("no vendor name reaches the mail", () => {
  const forbidden = /stripe|resend|anthropic|claude|opus|sonnet|supabase|vercel/i;
  for (const verdict of ["tripped", "unavailable"] as const) {
    const { subject, text } = formatBudgetAlert({
      verdict,
      capUsd: 5,
      estimatedUsd: verdict === "tripped" ? 5.12 : null,
      atMs: JULY,
    });
    assert.doesNotMatch(subject, forbidden, verdict);
    assert.doesNotMatch(text, forbidden, verdict);
  }
});

function mailbox(result: { ok: true; id: string } | { ok: false; error: string }) {
  const sent: EmailMessage[] = [];
  return {
    sent,
    send: async (message: EmailMessage) => {
      sent.push(message);
      return result;
    },
  };
}

test("no owner address means no mail and no noise", async () => {
  const box = mailbox({ ok: true, id: "m1" });
  await alertOwnerBudget(
    { verdict: "tripped", capUsd: 5, estimatedUsd: 6, atMs: JULY },
    { send: box.send },
  );
  assert.equal(box.sent.length, 0);
});

test("the owner gets one mail per condition per interval, not one per request", async () => {
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  const box = mailbox({ ok: true, id: "m1" });
  const claims: AlertClaims = new Map();
  const alert = { verdict: "tripped", capUsd: 5, estimatedUsd: 6, atMs: JULY } as const;

  for (let i = 0; i < 50; i += 1) {
    await alertOwnerBudget({ ...alert, atMs: JULY + i * 1000 }, { send: box.send, claims });
  }
  assert.equal(box.sent.length, 1);
  assert.equal(box.sent[0].to, "owner@example.test");

  await alertOwnerBudget({ ...alert, atMs: JULY + ALERT_INTERVAL_MS }, { send: box.send, claims });
  assert.equal(box.sent.length, 2);
});

test("a failed send never throws and never retries inside the interval", async () => {
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  const box = mailbox({ ok: false, error: "mailbox unreachable" });
  const claims: AlertClaims = new Map();
  const alert = { verdict: "unavailable", capUsd: 5, estimatedUsd: null, atMs: JULY } as const;

  await alertOwnerBudget(alert, { send: box.send, claims });
  await alertOwnerBudget(alert, { send: box.send, claims });
  assert.equal(
    box.sent.length,
    1,
    "a slow or dead mailbox must not add its timeout to every request",
  );
});

test("a mail client that throws is contained", async () => {
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  await alertOwnerBudget(
    { verdict: "tripped", capUsd: 5, estimatedUsd: 6, atMs: JULY },
    {
      claims: new Map(),
      send: async () => {
        throw new Error("network down");
      },
    },
  );
});

test("a failed send comes due again in minutes, not in six hours", async () => {
  // Claiming before the send keeps a slow mailbox off the request path, but if
  // the claim then stood for the full interval a misconfigured mail key would
  // silently disable the alert while every log line still looked healthy.
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  const box = mailbox({ ok: false, error: "mailbox unreachable" });
  const claims: AlertClaims = new Map();
  const alert = { verdict: "tripped", capUsd: 5, estimatedUsd: 9, atMs: JULY } as const;

  await alertOwnerBudget(alert, { send: box.send, claims });
  assert.equal(box.sent.length, 1);

  await alertOwnerBudget({ ...alert, atMs: JULY + 60_000 }, { send: box.send, claims });
  assert.equal(box.sent.length, 1, "one minute later is still inside the retry window");

  await alertOwnerBudget(
    { ...alert, atMs: JULY + ALERT_RETRY_MS + 1000 },
    { send: box.send, claims },
  );
  assert.equal(box.sent.length, 2, "past the retry window it tries again");
});

test("a successful send holds its slot for the full interval", async () => {
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  const box = mailbox({ ok: true, id: "msg_1" });
  const claims: AlertClaims = new Map();
  const alert = { verdict: "tripped", capUsd: 5, estimatedUsd: 9, atMs: JULY } as const;

  await alertOwnerBudget(alert, { send: box.send, claims });
  await alertOwnerBudget(
    { ...alert, atMs: JULY + ALERT_RETRY_MS + 1000 },
    { send: box.send, claims },
  );
  assert.equal(box.sent.length, 1, "the retry window is only for failures");
});

test("a mailbox that never answers cannot hold the request open", async () => {
  // The mail client sets no request timeout of its own and this runs inside a
  // player's analyze request, which is already on its way to a 503.
  process.env.OWNER_ALERT_EMAIL = "owner@example.test";
  let settled = false;
  const hang = new Promise<never>(() => {});
  const started = Date.now();
  await alertOwnerBudget(
    { verdict: "tripped", capUsd: 5, estimatedUsd: 9, atMs: JULY },
    {
      claims: new Map(),
      send: () => hang,
      timeoutMs: 40,
    },
  );
  settled = true;
  assert.equal(settled, true);
  assert.ok(Date.now() - started < 2000, "the alert path returned without waiting on the mailbox");
});
