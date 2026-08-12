import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analysesRemaining,
  creditsVerdict,
  formatCreditsAlert,
  parseCredits,
  readCredits,
  CRITICAL_ANALYSES,
  LOW_ANALYSES,
  USD_PER_ANALYSIS,
} from "./credits.ts";
import {
  alertKey,
  claimAlert,
  isAlertDue,
  releaseAlertForRetry,
  ALERT_INTERVAL_MS,
  type AlertClaims,
} from "../credit-alert.ts";

// THE CLAIM THIS REPLACES: "the app cannot read its own balance", stated twice
// in docs/billing.md and twice in the decision ledger, and given as the reason
// the product shipped with no spend warning at all. It was never checked. The
// gateway answers on the key every model call already carries.

const LIVE_SHAPE = { data: { total_credits: 100, total_usage: 20.709952016 } };

test("the gateway's real response shape parses", () => {
  const r = parseCredits(LIVE_SHAPE);
  assert.ok(r);
  assert.equal(r.totalCredits, 100);
  assert.equal(Math.round(r.remainingUsd * 100) / 100, 79.29);
});

test("a balance is expressed in analyses, because dollars alone mean nothing", () => {
  // The per-analysis cost has already moved 14x once in this product's life,
  // so the thresholds are counts and the dollar figure is derived, not the
  // other way round.
  assert.equal(analysesRemaining(79.29), Math.floor(79.29 / USD_PER_ANALYSIS));
  assert.equal(analysesRemaining(0), 0);
  assert.equal(analysesRemaining(-5), 0, "a negative balance is not a surplus");
});

test("an unreadable balance is NOT reported as empty", () => {
  // The distinction the whole module turns on. A gateway that will not answer
  // is a monitoring failure; calling it zero would fire a false critical every
  // time the endpoint blipped, and the alert would stop being believed.
  assert.equal(creditsVerdict(null), "unreadable");
  assert.notEqual(creditsVerdict(null), "critical");
});

test("the three live verdicts sit where the thresholds say", () => {
  const at = (n: number) => creditsVerdict({ totalCredits: 100, totalUsage: 0, remainingUsd: n });
  assert.equal(at(CRITICAL_ANALYSES * USD_PER_ANALYSIS), "critical");
  assert.equal(at(LOW_ANALYSES * USD_PER_ANALYSIS), "low");
  assert.equal(at(LOW_ANALYSES * USD_PER_ANALYSIS + 1), "ok");
  assert.equal(at(0), "critical");
});

test("a malformed or partial answer is null, never a guess", () => {
  for (const bad of [
    null, undefined, 42, "100", {}, { data: null }, { data: {} },
    { data: { total_credits: 100 } },
    { data: { total_credits: "100", total_usage: 1 } },
    { data: { total_credits: Number.NaN, total_usage: 1 } },
    { data: { total_credits: Number.POSITIVE_INFINITY, total_usage: 1 } },
  ]) {
    assert.equal(parseCredits(bad), null, JSON.stringify(bad ?? null));
  }
});

test("usage past the grant clamps to zero rather than reading as surplus", () => {
  const r = parseCredits({ data: { total_credits: 100, total_usage: 104.5 } });
  assert.ok(r);
  assert.equal(r.remainingUsd, 0);
  assert.equal(creditsVerdict(r), "critical");
});

test("no key configured reads as unreadable, not as broke", async () => {
  const r = await readCredits({ apiKey: "", fetchImpl: async () => new Response("{}") });
  assert.equal(r, null);
});

test("a non-200, a timeout and junk all fail closed to null", async () => {
  assert.equal(
    await readCredits({ apiKey: "k", fetchImpl: async () => new Response("{}", { status: 401 }) }),
    null,
  );
  assert.equal(
    await readCredits({ apiKey: "k", fetchImpl: async () => { throw new Error("network"); } }),
    null,
  );
  assert.equal(
    await readCredits({ apiKey: "k", fetchImpl: async () => new Response("not json") }),
    null,
  );
});

test("the reading round-trips through a fetch that answers like the gateway", async () => {
  const r = await readCredits({
    apiKey: "k",
    fetchImpl: async (url, init) => {
      assert.match(url, /openrouter\.ai\/api\/v1\/credits$/);
      assert.equal(
        (init.headers as Record<string, string>).authorization,
        "Bearer k",
        "the same key every model call already sends",
      );
      return new Response(JSON.stringify(LIVE_SHAPE));
    },
  });
  assert.ok(r);
  assert.equal(r.totalUsage, 20.709952016);
});

test("the mail says the number, what it buys, and the one action", () => {
  const r = parseCredits({ data: { total_credits: 100, total_usage: 98.5 } });
  assert.ok(r);
  const { subject, text } = formatCreditsAlert(r, "critical");
  assert.match(subject, /CRITICAL/);
  assert.match(subject, /\$1\.50/);
  assert.match(text, /analyses/);
  assert.match(text, /add credit/i);
  // No vendor name anywhere in a player- or owner-facing string, same rule as
  // the rest of the repo.
  assert.doesNotMatch(text, /openrouter|gemini|deepseek|google/i);
  assert.doesNotMatch(subject, /openrouter|gemini|deepseek|google/i);
});

test("low and critical are separate conditions, so crossing over earns a mail", () => {
  // Keying the claim on the verdict rather than a time window is what makes
  // "it got worse" reportable instead of suppressed as a duplicate.
  assert.notEqual(alertKey("low"), alertKey("critical"));

  const c: AlertClaims = new Map();
  const t = 1_000_000;
  assert.equal(claimAlert(c, "low", t), true);
  assert.equal(claimAlert(c, "low", t + 1000), false, "same condition is suppressed");
  assert.equal(claimAlert(c, "critical", t + 1000), true, "worsening is not suppressed");
});

test("the interval holds, and a failed send comes due sooner than a good one", () => {
  const c: AlertClaims = new Map();
  const t = 5_000_000;
  claimAlert(c, "low", t);
  assert.equal(isAlertDue(c.get(alertKey("low")) ?? null, t + ALERT_INTERVAL_MS - 1), false);
  assert.equal(isAlertDue(c.get(alertKey("low")) ?? null, t + ALERT_INTERVAL_MS), true);

  releaseAlertForRetry(c, "low", t);
  assert.equal(
    claimAlert(c, "low", t + 5 * 60_000),
    true,
    "a dead mailbox must not silently disable the alert for a full interval",
  );
});

test("a clock that steps backwards suppresses rather than spams", () => {
  assert.equal(isAlertDue(9_000_000, 8_000_000), false);
});
