import {
  isPlan,
  MONTHLY_ALLOWANCE,
  PLAN_LABEL,
  PRO_PRICE_LABEL,
  type Plan,
} from "./plans.ts";

type RpcResult = PromiseLike<{ data: unknown; error: unknown }>;

type AllowanceClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResult;
};

// The counter a player reads BEFORE they film, not after (docs/billing.md 4.6).
// Straight from `analysis_allowance()` (migration 026), which keys on auth.uid()
// and takes no argument, so there is nothing here a caller could point at
// somebody else's row.
export type Allowance = {
  plan: Plan;
  allowance: number;
  used: number;
  remaining: number;
  resetsAt: string;
};

// Fail soft, and deliberately so. Everything else on the analyze path fails
// closed because it decides whether a paid call happens; this decides whether a
// line of text appears. A database hiccup here must hide the counter, never
// block a rep and never throw inside the page it renders on, so anything
// unreadable comes back as null and the caller renders nothing at all.
export async function readAllowance(
  client: AllowanceClient,
): Promise<Allowance | null> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await client.rpc("analysis_allowance"));
  } catch {
    return null;
  }
  if (error || !data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const { plan, allowance, used, remaining, resets_at: resetsAt } = row;

  // A plan string this build has no name for means the database is ahead of the
  // deploy. Hiding the counter is the only honest answer: naming an allowance
  // for a plan we cannot resolve would be a guess shown as a fact.
  if (!isPlan(plan)) return null;
  if (!isCount(allowance) || !isCount(used) || !isCount(remaining)) return null;
  // A date the page cannot format renders as "Invalid Date" beside two real
  // numbers, which reads as the count itself being broken.
  if (typeof resetsAt !== "string" || !Number.isFinite(Date.parse(resetsAt))) {
    return null;
  }

  return {
    plan,
    allowance,
    used,
    // SQL sends `remaining` as well, and its absence above is what catches a
    // stale migration. The number actually shown is derived from the two
    // numbers shown next to it, so the line can never contradict itself if the
    // two ever drift. `used` can legitimately exceed the allowance after a
    // downgrade mid-month (docs/billing.md section 7), hence the floor.
    remaining: Math.max(0, allowance - used),
    resetsAt,
  };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// The whole line, for the dashboard, the analyze page and the plan card. Plain
// reporting: the plan card does the selling, this only says where they stand.
export function allowanceCopy(a: Allowance): string {
  if (a.remaining === 0) return "None left this month";
  return `${a.remaining} of ${a.allowance} left this month`;
}

// How loudly the counter is allowed to read. Derived from the number and
// nothing else: there is no moment where the same remaining count is urgent for
// one player and calm for another, because that is where invented scarcity
// starts.
export type AllowanceTone = "steady" | "last" | "out";

export function allowanceTone(a: Allowance): AllowanceTone {
  if (a.remaining === 0) return "out";
  if (a.remaining === 1) return "last";
  return "steady";
}

// The counter line for the analyze page and the dashboard. At two or more it
// reports a fact. At one it warns, and it warns BEFORE the camera comes out: a
// player who films, marks their athlete and waits, only to learn at the 402
// that there was one left and now none, has done 90 seconds of work to find out
// something we could have told them first (docs/billing.md 4.6). The warning
// carries the date the next ones land, so it is never just a number going down.
export function allowanceLine(a: Allowance): string {
  if (allowanceTone(a) === "last") {
    return `Last analysis this month. More on ${resetDate(a)}.`;
  }
  return allowanceCopy(a);
}

// The window is the UTC calendar month (docs/billing.md section 1), so the date
// is formatted in UTC: the server's own zone would tell anyone west of
// Greenwich that a reset landing on Aug 1 happens on Jul 31. The locale is
// pinned for the same reason, so the string does not change with the host.
function utcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export function resetDate(a: Allowance): string {
  return utcDay(a.resetsAt);
}

export function resetCopy(a: Allowance): string {
  return `Resets ${resetDate(a)}`;
}

// The same date, read off the wire instead of out of a validated Allowance.
// The 402 carries the reset instant raw so the client can render it, and that
// body can arrive truncated, reshaped by a proxy, or not at all, so anything
// unreadable comes back null and the copy drops the date. A player who is
// already blocked must never be handed "Invalid Date" as the answer to when
// they can train again.
export function resetDateOf(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!Number.isFinite(Date.parse(value))) return null;
  return utcDay(value);
}

// The 402 reason names which wall was hit, and each wall belongs to exactly one
// plan (docs/billing.md 4.5). A body that lost its reason leaves this null,
// which is the honest answer: guessing would eventually tell a paying player
// they are on the free plan, in the same breath as asking them to buy it.
export function planFromReason(reason: string | null | undefined): Plan | null {
  if (reason === "free_month_exhausted") return "free";
  if (reason === "plan_month_exhausted") return "pro";
  return null;
}

// The offer for a player whose month is spent, in parts rather than as one
// sentence, so the surface rendering it can put the action where an action
// belongs instead of burying it in prose with a link in it.
export type LimitOffer = {
  // What happened, stated plainly. No blame: running out is a state.
  headline: string;
  // What the paid plan is and what it costs, or null when there is nothing to
  // sell to this player.
  terms: string | null;
  // The one primary action, or null. There is never a second one.
  action: string | null;
  // The alternative to paying. Always present, because waiting always works.
  wait: string;
};

/**
 * The same offer at every moment it appears: after the refusal, on the analyze
 * page before a clip is picked, and on the dashboard. Only the player's
 * situation changes, never the price and never the terms. Nothing here counts
 * down, expires, or gets better if they hesitate.
 *
 * `allowance` is the player's own number when a surface has read it, and the
 * plan constant otherwise (`lib/plans.test.ts` pins those against the SQL that
 * actually enforces them, so the two cannot drift apart unnoticed).
 */
export function limitOffer({
  plan,
  allowance = null,
  resetsOn,
  canBuy,
}: {
  plan: Plan | null;
  allowance?: number | null;
  resetsOn: string | null;
  canBuy: boolean;
}): LimitOffer {
  const count = allowance ?? (plan ? MONTHLY_ALLOWANCE[plan] : null);
  const headline =
    plan && count != null
      ? `You've used all ${count} of your ${PLAN_LABEL[plan]} analyses this month.`
      : "You've used your analyses for this month.";

  // Never sell to somebody who already pays. Money buys a Pro player nothing
  // this month, so an upgrade button in front of them is a charge for a wait
  // they are going to do anyway (docs/billing.md 4.5). An unknown plan is
  // treated as free, matching the 402's own fallback: stranding a free player
  // with no way forward is the worse of the two mistakes.
  const sell = canBuy && plan !== "pro";
  const terms = sell
    ? `${PLAN_LABEL.pro} is ${MONTHLY_ALLOWANCE.pro} analyses a month for ${PRO_PRICE_LABEL}, on the same monthly reset. Cancel any time.`
    : null;
  const action = sell ? `Upgrade to ${PLAN_LABEL.pro}` : null;

  // The window is a UTC calendar month whether or not the reset instant
  // survived the trip, so there is always a true thing to say about when this
  // lifts, and the wait is never left open-ended.
  const when = resetsOn ? `on ${resetsOn}` : "on the first of the month";
  let wait: string;
  if (count == null) {
    wait = sell ? `Or wait, and more unlock ${when}.` : `More unlock ${when}.`;
  } else {
    wait = sell
      ? `Or wait, and your next ${count} unlock ${when}.`
      : `Your next ${count} unlock ${when}.`;
  }

  return { headline, terms, action, wait };
}
