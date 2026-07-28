import { isPlan, type Plan } from "./plans.ts";

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

// The window is the UTC calendar month (docs/billing.md section 1), so the date
// is formatted in UTC: the server's own zone would tell anyone west of
// Greenwich that a reset landing on Aug 1 happens on Jul 31. The locale is
// pinned for the same reason, so the string does not change with the host.
export function resetCopy(a: Allowance): string {
  const when = new Date(a.resetsAt).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  return `Resets ${when}`;
}
