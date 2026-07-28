import { test } from "node:test";
import assert from "node:assert/strict";
import { allowanceCopy, readAllowance, resetCopy } from "./allowance.ts";

const GOOD = {
  plan: "free",
  allowance: 3,
  used: 1,
  remaining: 2,
  resets_at: "2026-08-01T00:00:00+00:00",
};

function client(reply: { data: unknown; error: unknown }) {
  return { rpc: async () => reply };
}

test("a good reply becomes the counter, and asks for nothing but its own row", async () => {
  let name: unknown;
  let args: unknown;
  const supabase = {
    rpc: async (fn: string, value?: Record<string, unknown>) => {
      name = fn;
      args = value;
      return { data: GOOD, error: null };
    },
  };

  assert.deepEqual(await readAllowance(supabase), {
    plan: "free",
    allowance: 3,
    used: 1,
    remaining: 2,
    resetsAt: "2026-08-01T00:00:00+00:00",
  });
  assert.equal(name, "analysis_allowance");
  assert.equal(args, undefined);
});

test("remaining is derived, so the line cannot contradict its own numbers", async () => {
  // SQL says 9 left; the two numbers beside it say 1. A player who has been
  // downgraded mid-month is over their new allowance, which is expected
  // (docs/billing.md section 7) and must floor at none rather than go negative.
  const drifted = client({
    data: { plan: "pro", allowance: 18, used: 17, remaining: 9, resets_at: GOOD.resets_at },
    error: null,
  });
  const over = client({
    data: { plan: "free", allowance: 3, used: 11, remaining: 0, resets_at: GOOD.resets_at },
    error: null,
  });

  assert.equal((await readAllowance(drifted))?.remaining, 1);
  assert.equal((await readAllowance(over))?.remaining, 0);
});

test("a malformed reply hides the counter instead of inventing one", async () => {
  const cases: unknown[] = [
    null,
    "not an object",
    { ...GOOD, plan: "platinum" },
    { ...GOOD, plan: null },
    { ...GOOD, allowance: "3" },
    { ...GOOD, used: -1 },
    { ...GOOD, used: 1.5 },
    // No `remaining` at all: the migration that defines this RPC is not applied.
    { plan: "free", allowance: 3, used: 1, resets_at: GOOD.resets_at },
    { ...GOOD, resets_at: "the first of the month" },
    { ...GOOD, resets_at: 1_785_000_000_000 },
  ];

  for (const data of cases) {
    assert.equal(
      await readAllowance(client({ data, error: null })),
      null,
      `expected null for ${JSON.stringify(data)}`,
    );
  }
});

test("an RPC error or an unreachable client hides the counter and never throws", async () => {
  const failed = client({ data: GOOD, error: new Error("offline") });
  const throwing = {
    rpc: async (): Promise<never> => {
      throw new Error("network unavailable");
    },
  };

  assert.equal(await readAllowance(failed), null);
  assert.equal(await readAllowance(throwing), null);
});

test("the counter line reports plainly at three, one, and none", () => {
  const at = (used: number, allowance = 3) => ({
    plan: "free" as const,
    allowance,
    used,
    remaining: Math.max(0, allowance - used),
    resetsAt: GOOD.resets_at,
  });

  assert.equal(allowanceCopy(at(1)), "2 of 3 left this month");
  assert.equal(allowanceCopy(at(2)), "1 of 3 left this month");
  assert.equal(allowanceCopy(at(3)), "None left this month");
  assert.equal(allowanceCopy(at(4)), "None left this month");
  assert.equal(allowanceCopy(at(11, 18)), "7 of 18 left this month");

  // Nothing in the line shouts or names who takes the money. The long dash is
  // built from its code point because the character itself is banned from
  // source, comments included.
  const longDash = String.fromCharCode(0x2014);
  for (const used of [0, 1, 2, 3]) {
    const line = allowanceCopy(at(used));
    assert.equal(line.includes("!"), false);
    assert.equal(line.includes(longDash), false);
    assert.doesNotMatch(line, /stripe/i);
  }
});

test("the reset date is read in UTC, because the window is a UTC month", () => {
  const august = {
    plan: "pro" as const,
    allowance: 18,
    used: 7,
    remaining: 11,
    resetsAt: "2026-08-01T00:00:00+00:00",
  };
  // Midnight UTC on the 1st is still the previous evening in every zone west of
  // Greenwich. The player is told the month it belongs to, not the local clock.
  assert.equal(resetCopy(august), "Resets Aug 1");
  assert.equal(resetCopy({ ...august, resetsAt: "2027-01-01T00:00:00Z" }), "Resets Jan 1");
});
