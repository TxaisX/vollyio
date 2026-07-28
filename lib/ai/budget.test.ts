import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkAnalyzeBudget,
  evaluateBudget,
  resetBudgetCacheForTests,
} from "./budget.ts";
import type { BudgetAlert } from "../owner-alert.ts";

// One month-to-date entry that prices to exactly $5 on claude-opus-4-8
// (1M input tokens at $5/MTok, nothing else).
const FIVE_DOLLARS = [
  {
    model: "claude-opus-4-8",
    analyses: 30,
    input_tokens: 1_000_000,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
];

function rpcClient(responses: Array<{ data?: unknown; error?: unknown } | Error>) {
  let calls = 0;
  return {
    calls: () => calls,
    rpc: async () => {
      const next = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      if (next instanceof Error) throw next;
      return { data: next.data ?? null, error: next.error ?? null };
    },
  };
}

// Recording alert sink. Every test that can produce a non-ok verdict injects
// one, and OWNER_ALERT_EMAIL is cleared besides, so a developer machine that
// happens to have the address set cannot make the suite send real mail.
function alertSink() {
  const seen: BudgetAlert[] = [];
  return { seen, alert: (alert: BudgetAlert) => void seen.push(alert) };
}

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  savedEnv.budget = process.env.ANALYZE_MONTHLY_BUDGET_USD;
  savedEnv.mock = process.env.AI_MOCK;
  savedEnv.owner = process.env.OWNER_ALERT_EMAIL;
  delete process.env.AI_MOCK;
  delete process.env.OWNER_ALERT_EMAIL;
  resetBudgetCacheForTests();
});
afterEach(() => {
  if (savedEnv.budget === undefined) delete process.env.ANALYZE_MONTHLY_BUDGET_USD;
  else process.env.ANALYZE_MONTHLY_BUDGET_USD = savedEnv.budget;
  if (savedEnv.mock === undefined) delete process.env.AI_MOCK;
  else process.env.AI_MOCK = savedEnv.mock;
  if (savedEnv.owner === undefined) delete process.env.OWNER_ALERT_EMAIL;
  else process.env.OWNER_ALERT_EMAIL = savedEnv.owner;
});

test("unset env disables the guard without touching the database", async () => {
  delete process.env.ANALYZE_MONTHLY_BUDGET_USD;
  const client = rpcClient([new Error("must not be called")]);
  assert.equal(await checkAnalyzeBudget(client), "ok");
  assert.equal(client.calls(), 0);
});

test("a malformed cap disables the guard, never kills the app", async () => {
  for (const bad of ["", "abc", "-5", "0"]) {
    process.env.ANALYZE_MONTHLY_BUDGET_USD = bad;
    resetBudgetCacheForTests();
    const client = rpcClient([new Error("must not be called")]);
    assert.equal(await checkAnalyzeBudget(client), "ok", `cap=${JSON.stringify(bad)}`);
  }
});

test("mock mode skips the guard entirely", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "1";
  process.env.AI_MOCK = "true";
  const client = rpcClient([new Error("must not be called")]);
  assert.equal(await checkAnalyzeBudget(client), "ok");
  assert.equal(client.calls(), 0);
});

test("spend under the cap passes, at or over the cap trips", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "6";
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }])), "ok");

  process.env.ANALYZE_MONTHLY_BUDGET_USD = "5";
  resetBudgetCacheForTests();
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }])), "tripped");

  process.env.ANALYZE_MONTHLY_BUDGET_USD = "4";
  resetBudgetCacheForTests();
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }])), "tripped");
});

test("an RPC failure with no cache fails closed", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  assert.equal(await checkAnalyzeBudget(rpcClient([new Error("db down")])), "unavailable");
  resetBudgetCacheForTests();
  assert.equal(
    await checkAnalyzeBudget(rpcClient([{ error: { message: "boom" } }])),
    "unavailable",
  );
});

test("a warm cache rides through an RPC failure", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  const client = rpcClient([{ data: FIVE_DOLLARS }, new Error("db down")]);
  let clock = 1_000_000;
  const now = () => clock;
  assert.equal(await checkAnalyzeBudget(client, { now }), "ok");
  clock += 6 * 60_000; // past the 5-minute TTL, so a re-fetch is attempted and fails
  assert.equal(await checkAnalyzeBudget(client, { now }), "ok");
  assert.equal(client.calls(), 2);
});

test("a fresh cache short-circuits the RPC inside the TTL", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  const client = rpcClient([{ data: FIVE_DOLLARS }]);
  let clock = 1_000_000;
  const now = () => clock;
  await checkAnalyzeBudget(client, { now });
  clock += 60_000; // within TTL
  await checkAnalyzeBudget(client, { now });
  assert.equal(client.calls(), 1);
});

test("malformed payloads fail closed", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  for (const data of [null, "nope", { model: 1 }, [{ model: "claude-opus-4-8" }]]) {
    resetBudgetCacheForTests();
    assert.equal(
      await checkAnalyzeBudget(rpcClient([{ data }])),
      "unavailable",
      JSON.stringify(data),
    );
  }
});

test("an unpriceable model in the aggregate fails closed", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  const data = [{ ...FIVE_DOLLARS[0], model: "claude-mystery-model" }];
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data }])), "unavailable");
});

test("evaluateBudget is a plain threshold", () => {
  assert.equal(evaluateBudget(4.99, 5), "ok");
  assert.equal(evaluateBudget(5, 5), "tripped");
  assert.equal(evaluateBudget(5.01, 5), "tripped");
});

test("a trip alerts the owner with the estimate and the cap it broke", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "4";
  const sink = alertSink();
  const verdict = await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }]), {
    now: () => 1_000_000,
    alert: sink.alert,
  });
  assert.equal(verdict, "tripped");
  assert.deepEqual(sink.seen, [
    { verdict: "tripped", capUsd: 4, estimatedUsd: 5, atMs: 1_000_000 },
  ]);
});

test("an unavailable verdict alerts with no estimate, because there is none", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  const sink = alertSink();
  assert.equal(
    await checkAnalyzeBudget(rpcClient([new Error("db down")]), { alert: sink.alert }),
    "unavailable",
  );

  resetBudgetCacheForTests();
  const unpriceable = [{ ...FIVE_DOLLARS[0], model: "claude-mystery-model" }];
  assert.equal(
    await checkAnalyzeBudget(rpcClient([{ data: unpriceable }]), { alert: sink.alert }),
    "unavailable",
  );

  assert.equal(sink.seen.length, 2);
  for (const alert of sink.seen) {
    assert.equal(alert.verdict, "unavailable");
    assert.equal(alert.estimatedUsd, null);
    assert.equal(alert.capUsd, 10);
  }
});

test("an ok verdict never alerts, whatever produced it", async () => {
  const sink = alertSink();

  delete process.env.ANALYZE_MONTHLY_BUDGET_USD;
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: [] }]), { alert: sink.alert }), "ok");

  process.env.ANALYZE_MONTHLY_BUDGET_USD = "abc";
  resetBudgetCacheForTests();
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: [] }]), { alert: sink.alert }), "ok");

  process.env.ANALYZE_MONTHLY_BUDGET_USD = "1";
  process.env.AI_MOCK = "true";
  resetBudgetCacheForTests();
  assert.equal(await checkAnalyzeBudget(rpcClient([{ data: [] }]), { alert: sink.alert }), "ok");

  delete process.env.AI_MOCK;
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "6";
  resetBudgetCacheForTests();
  assert.equal(
    await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }]), { alert: sink.alert }),
    "ok",
  );

  assert.deepEqual(sink.seen, []);
});

test("a warm cache riding through an RPC failure stays ok and stays silent", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "10";
  const sink = alertSink();
  const client = rpcClient([{ data: FIVE_DOLLARS }, new Error("db down")]);
  let clock = 1_000_000;
  const now = () => clock;
  await checkAnalyzeBudget(client, { now, alert: sink.alert });
  clock += 6 * 60_000;
  assert.equal(await checkAnalyzeBudget(client, { now, alert: sink.alert }), "ok");
  assert.deepEqual(sink.seen, [], "a cache that covered the outage is not news for the owner");
});

test("an alert that throws does not change the verdict", async () => {
  process.env.ANALYZE_MONTHLY_BUDGET_USD = "4";
  const verdict = await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }]), {
    alert: () => {
      throw new Error("mail is on fire");
    },
  });
  assert.equal(verdict, "tripped", "the verdict is the product behaviour, the mail is not");

  resetBudgetCacheForTests();
  const rejected = await checkAnalyzeBudget(rpcClient([{ data: FIVE_DOLLARS }]), {
    alert: async () => {
      throw new Error("mail is still on fire");
    },
  });
  assert.equal(rejected, "tripped");
});
