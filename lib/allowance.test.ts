import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowanceCopy,
  allowanceLine,
  allowanceTone,
  limitOffer,
  planFromReason,
  readAllowance,
  resetCopy,
  resetDate,
  resetDateOf,
  type Allowance,
} from "./allowance.ts";
import { MONTHLY_ALLOWANCE, PRO_PRICE_LABEL } from "./plans.ts";

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
    // GOOD predates migration 040 and carries neither field, which is exactly
    // the deploy window this has to survive: null, not an invented grant.
    grantRemaining: null,
    monthlyRate: null,
    grant: null,
    lifetimeUsed: null,
  });
  assert.equal(name, "analysis_allowance");
  assert.equal(args, undefined);
});

test("the grant and the rate come through when the database sends them", async () => {
  const supabase = client({
    data: { ...GOOD, grant_remaining: 2, monthly_rate: 1 },
    error: null,
  });
  const read = await readAllowance(supabase);
  assert.equal(read!.grantRemaining, 2);
  assert.equal(read!.monthlyRate, 1);

  // A grant of zero is a real state and must not read as "absent". This is the
  // difference between a player whose trial is spent and a database that has
  // not been migrated yet, and the two want opposite copy.
  const spent = await readAllowance(
    client({ data: { ...GOOD, grant_remaining: 0, monthly_rate: 1 }, error: null }),
  );
  assert.equal(spent!.grantRemaining, 0);

  // Garbage in either field falls back to null rather than poisoning a counter
  // whose other three numbers are fine.
  const junk = await readAllowance(
    client({ data: { ...GOOD, grant_remaining: -1, monthly_rate: "1" }, error: null }),
  );
  assert.equal(junk!.grantRemaining, null);
  assert.equal(junk!.monthlyRate, null);
  assert.equal(junk!.remaining, 2);
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
    grantRemaining: null,
    monthlyRate: null,
    grant: null,
    lifetimeUsed: null,
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
    grantRemaining: null,
    monthlyRate: null,
    grant: null,
    lifetimeUsed: null,
  };
  // Midnight UTC on the 1st is still the previous evening in every zone west of
  // Greenwich. The player is told the month it belongs to, not the local clock.
  assert.equal(resetCopy(august), "Resets Aug 1");
  assert.equal(resetCopy({ ...august, resetsAt: "2027-01-01T00:00:00Z" }), "Resets Jan 1");
  // The bare date, which is what the offer copy interpolates.
  assert.equal(resetDate(august), "Aug 1");
});

test("a reset instant off the wire is formatted in UTC or dropped entirely", () => {
  // Same UTC pinning as the validated path, because the 402 and the counter
  // must never name two different days for the same reset.
  assert.equal(resetDateOf("2026-08-01T00:00:00+00:00"), "Aug 1");
  assert.equal(resetDateOf("2026-08-01T00:00:00Z"), "Aug 1");

  // Anything unreadable drops the date rather than printing "Invalid Date" at
  // a player who is already blocked. `limitOffer` still has something true to
  // say without it.
  for (const bad of [null, undefined, "", "   ", "the first", 1_785_000_000_000, {}, []]) {
    assert.equal(resetDateOf(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

const counter = (
  used: number,
  allowance = 3,
  plan: "free" | "pro" = "free",
): Allowance => ({
  plan,
  allowance,
  used,
  remaining: Math.max(0, allowance - used),
  resetsAt: "2026-08-01T00:00:00+00:00",
  grantRemaining: null,
  monthlyRate: null,
  grant: null,
  lifetimeUsed: null,
});

test("the tone follows the remaining count and nothing else", () => {
  assert.equal(allowanceTone(counter(0)), "steady");
  assert.equal(allowanceTone(counter(1)), "steady");
  assert.equal(allowanceTone(counter(2)), "last");
  assert.equal(allowanceTone(counter(3)), "out");
  // Over the allowance after a mid-month downgrade is still just "out".
  assert.equal(allowanceTone(counter(4)), "out");
  // A Pro player's last one is the same kind of moment as a free player's.
  assert.equal(allowanceTone(counter(17, 18, "pro")), "last");
  assert.equal(allowanceTone(counter(18, 18, "pro")), "out");
});

test("the counter warns at one left and reports everywhere else", () => {
  // Two or more is a fact, stated the way the plan card states it.
  assert.equal(allowanceLine(counter(0)), "3 of 3 left this month");
  assert.equal(allowanceLine(counter(1)), "2 of 3 left this month");
  // One left is the moment worth interrupting for: it is the last chance to
  // learn this before filming, and the line carries its own answer.
  assert.equal(
    allowanceLine(counter(2)),
    "Last analysis this month. More on Aug 1.",
  );
  assert.equal(
    allowanceLine(counter(17, 18, "pro")),
    "Last analysis this month. More on Aug 1.",
  );
  assert.equal(allowanceLine(counter(3)), "None left this month");
});

test("a 402 reason names the plan, and an absent one names nothing", () => {
  assert.equal(planFromReason("free_month_exhausted"), "free");
  assert.equal(planFromReason("plan_month_exhausted"), "pro");
  // A body that lost its reason, a proxy error page, a future reason this
  // build has no name for: all leave the plan unknown rather than guessed.
  for (const bad of [null, undefined, "", "month_exhausted", "used", "pro"]) {
    assert.equal(planFromReason(bad), null, `expected null for ${String(bad)}`);
  }
});

test("a free player who is out gets the price, one action, and the date", () => {
  const offer = limitOffer({
    plan: "free",
    allowance: 3,
    resetsOn: "Aug 1",
    canBuy: true,
  });

  assert.equal(
    offer.headline,
    "You've used all 3 of your Free analyses this month.",
  );
  assert.equal(offer.action, "Upgrade to Pro");
  // What Pro gives and what it costs, both present, both from the pinned
  // constants rather than a number typed into copy.
  assert.match(offer.terms!, new RegExp(`${MONTHLY_ALLOWANCE.pro} analyses a month`));
  assert.ok(offer.terms!.includes(PRO_PRICE_LABEL));
  // Waiting is offered as the alternative, never hidden. The count here is the
  // RECURRING rate, not the 3 they just spent: those 3 were the one-time signup
  // grant (migration 040), and "your next 3 unlock" would be a promise the gate
  // refuses on Aug 1.
  assert.equal(offer.wait, "Or wait, and your next one unlocks on Aug 1.");
});

test("what unlocks at the reset is the rate, never the ceiling just spent", () => {
  // The exact shape of a player who has just burned the signup grant: the
  // window ceiling was 3, what arrives next month is 1.
  const grant = limitOffer({
    plan: "free",
    allowance: 3,
    nextWindow: 1,
    resetsOn: "Aug 1",
    canBuy: true,
  });
  assert.equal(
    grant.headline,
    "You've used all 3 of your Free analyses this month.",
  );
  assert.equal(grant.wait, "Or wait, and your next one unlocks on Aug 1.");

  // And the month after, where the ceiling and the rate agree at one. The
  // headline has to stop saying "all 1 of your Free analyses".
  const steady = limitOffer({
    plan: "free",
    allowance: 1,
    nextWindow: 1,
    resetsOn: "Sep 1",
    canBuy: true,
  });
  assert.equal(
    steady.headline,
    "You've used your Free analysis for this month.",
  );
  assert.equal(steady.wait, "Or wait, and your next one unlocks on Sep 1.");
});

test("a Pro player who is out is told when, and is sold nothing", () => {
  // The rule that overrides every conversion instinct: money buys this player
  // nothing this month, so there is no button and no price.
  const offer = limitOffer({
    plan: "pro",
    allowance: MONTHLY_ALLOWANCE.pro,
    resetsOn: "Aug 1",
    canBuy: true,
  });

  assert.equal(
    offer.headline,
    `You've used all ${MONTHLY_ALLOWANCE.pro} of your Pro analyses this month.`,
  );
  assert.equal(offer.terms, null);
  assert.equal(offer.action, null);
  assert.equal(offer.wait, `Your next ${MONTHLY_ALLOWANCE.pro} unlock on Aug 1.`);
});

test("no upgrade destination means no offer, only the wait", () => {
  // The button would 503 or lead nowhere, which is worse than no button.
  const offer = limitOffer({
    plan: "free",
    allowance: 3,
    resetsOn: "Aug 1",
    canBuy: false,
  });

  assert.equal(offer.terms, null);
  assert.equal(offer.action, null);
  assert.equal(offer.wait, "Your next one unlocks on Aug 1.");
});

test("an unreadable 402 still says something true and still offers a way out", () => {
  // No plan and no date: the headline drops the number, the wait falls back to
  // the calendar month, which is true whatever the provider said, and the
  // offer stays up rather than stranding a free player with nothing to do.
  const offer = limitOffer({ plan: null, resetsOn: null, canBuy: true });

  assert.equal(offer.headline, "You've used your analyses for this month.");
  assert.equal(offer.action, "Upgrade to Pro");
  assert.equal(offer.wait, "Or wait, and more unlock on the first of the month.");

  const waiting = limitOffer({ plan: null, resetsOn: null, canBuy: false });
  assert.equal(waiting.wait, "More unlock on the first of the month.");
});

test("the plan constant fills in when a surface did not read the count", () => {
  // The 402 carries a reason but no numbers; the constants are pinned against
  // the SQL that enforces them (lib/plans.test.ts), so this cannot promise an
  // allowance the reservation would refuse.
  const free = limitOffer({ plan: "free", resetsOn: "Aug 1", canBuy: true });
  const pro = limitOffer({ plan: "pro", resetsOn: "Aug 1", canBuy: true });

  // The free rate is one, so the headline says so in words rather than
  // rendering "all 1 of your Free analyses".
  assert.equal(free.headline, "You've used your Free analysis for this month.");
  assert.equal(free.wait, "Or wait, and your next one unlocks on Aug 1.");
  assert.ok(pro.headline.includes(`all ${MONTHLY_ALLOWANCE.pro} of your Pro`));
});

test("the offer is the same offer at every moment, and never manufactures urgency", () => {
  // Same terms and same action whatever the player's situation, so nothing in
  // this funnel can quietly become a different deal for someone more stuck.
  const shapes = [
    limitOffer({ plan: "free", allowance: 3, resetsOn: "Aug 1", canBuy: true }),
    limitOffer({ plan: "free", allowance: 3, resetsOn: null, canBuy: true }),
    limitOffer({ plan: null, resetsOn: "Sep 1", canBuy: true }),
  ];
  const terms = new Set(shapes.map((s) => s.terms));
  const actions = new Set(shapes.map((s) => s.action));
  assert.equal(terms.size, 1);
  assert.equal(actions.size, 1);

  const longDash = String.fromCharCode(0x2014);
  const every = [
    ...shapes,
    limitOffer({ plan: "pro", allowance: 18, resetsOn: "Aug 1", canBuy: true }),
    limitOffer({ plan: "free", allowance: 3, resetsOn: "Aug 1", canBuy: false }),
  ];
  for (const offer of every) {
    for (const line of [offer.headline, offer.terms, offer.action, offer.wait]) {
      if (line === null) continue;
      // No shouting, no long dash, no vendor name, and no countdown language:
      // the urgency belongs to the player's situation, not to the copy.
      assert.equal(line.includes("!"), false, line);
      assert.equal(line.includes(longDash), false, line);
      assert.doesNotMatch(line, /stripe/i);
      assert.doesNotMatch(line, /only today|hurry|last chance|expires|ends soon/i);
    }
  }
});

test("while the signup grant is live the counter reports lifetime, not the month", () => {
  // The exact shape that produced the complaint: a hand-set grant of 50 on an
  // account with 20 analyses behind it and 1 this window. The window ceiling
  // the SQL derives is 31 (30 remaining + 1 used), which is an artifact of the
  // arithmetic and means nothing to the player, and "this month" is false
  // because grant analyses do not reset. Both were being rendered.
  const granted = {
    plan: "pro" as const,
    allowance: 31,
    used: 1,
    remaining: 30,
    resetsAt: GOOD.resets_at,
    grantRemaining: 30,
    monthlyRate: 18,
    grant: 50,
    lifetimeUsed: 20,
  };

  assert.equal(allowanceCopy(granted), "20 of 50 used");
  // The two false things must both be gone.
  assert.doesNotMatch(allowanceCopy(granted), /this month/i);
  assert.equal(allowanceCopy(granted).includes("31"), false);

  // A fresh free account on the six-skill grant.
  const fresh = { ...granted, plan: "free" as const, allowance: 6, used: 0,
    remaining: 6, grantRemaining: 6, monthlyRate: 1, grant: 6, lifetimeUsed: 0 };
  assert.equal(allowanceCopy(fresh), "0 of 6 used");
});

test("once the grant is spent the counter goes back to speaking about the month", () => {
  const spent = {
    plan: "free" as const,
    allowance: 1,
    used: 0,
    remaining: 1,
    resetsAt: GOOD.resets_at,
    grantRemaining: 0,
    monthlyRate: 1,
    grant: 6,
    lifetimeUsed: 6,
  };
  // The monthly rate is what binds now, so the month is the honest frame.
  assert.equal(allowanceCopy(spent), "1 analysis this month");
  assert.equal(allowanceCopy({ ...spent, allowance: 18, remaining: 7, used: 11 }),
    "7 of 18 left this month");
});

test("a database that cannot report the grant falls back rather than guessing", () => {
  // Between a deploy and its migration the two new fields are absent. Inventing
  // a lifetime figure would be a number shown as a fact, so the copy reverts to
  // the window frame it can actually substantiate.
  const partial = {
    plan: "free" as const,
    allowance: 6,
    used: 2,
    remaining: 4,
    resetsAt: GOOD.resets_at,
    grantRemaining: 4,
    monthlyRate: 1,
    grant: null,
    lifetimeUsed: null,
  };
  assert.equal(allowanceCopy(partial), "4 of 6 left this month");
});
