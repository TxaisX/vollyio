// Maps an /api/analyze failure to the client status states (D-054). The calm
// chalk "unavailable" rendering was previously reserved for 503; hourly-limit
// 429 and monthly-allowance 402 landed in the coral error state even though the
// player did nothing wrong and their clip was never read. A 409 conflict stays
// an error: it is genuinely actionable right now (an analysis is already
// running). Server-supplied copy always wins; fallbacks cover a body that
// failed to parse.
//
// Running out of analyses is the one failure the player can act on with money
// or with patience, so the reason and the reset instant travel with the state:
// a free player is pointed at the upgrade destination, a pro player is told
// when the window rolls and offered nothing to buy (docs/billing.md 4.5).

export type AnalyzeFailureReason =
  | "free_month_exhausted"
  | "plan_month_exhausted"
  // D-110's daily wall. Kept as separate literals rather than a period flag
  // because every existing consumer switches on this union exhaustively, and a
  // flag would let a surface forget the day case while still typechecking.
  | "free_day_exhausted"
  | "plan_day_exhausted"
  // D-118. Not a window at all: the anonymous player's one free read is spent
  // and nothing refills it, so this is the only refusal here whose answer is an
  // account rather than money or patience.
  | "anonymous_used";

// Which refusals belong to a paying player. Pro hits its own walls, and money
// buys them nothing when they do, so they are never sold to (docs/billing.md
// 4.5).
const PRO_REASONS: readonly AnalyzeFailureReason[] = [
  "plan_month_exhausted",
  "plan_day_exhausted",
];

// Every refusal that must NOT be answered with a checkout button. A pro player
// at their wall cannot buy their way past it, and an anonymous player has
// nothing to upgrade FROM: selling Pro to someone with no account would ask
// them to pay before there is anywhere for the purchase to land.
const NO_SALE_REASONS: readonly AnalyzeFailureReason[] = [
  ...PRO_REASONS,
  "anonymous_used",
];

// The 402 body the route sends. Every field is `unknown` because this is JSON
// off the wire: a field that arrives missing or as the wrong type has to
// degrade to vaguer copy, never throw in front of the player.
export type AnalyzeErrorBody = {
  error?: unknown;
  reason?: unknown;
  resets_at?: unknown;
};

export type AnalyzeFailure = {
  kind: "unavailable" | "error";
  message: string;
  reason: AnalyzeFailureReason | null;
  // Formatted for a human in the viewer's own timezone, or null when the
  // server sent no date or one that would not parse. Never a raw timestamp,
  // and never the string "Invalid Date".
  resetsAt: string | null;
  // Whether there is anything to buy. Only a free player at their monthly
  // limit: a pro player at theirs waits for the reset, and offering them a
  // purchase would promise something money cannot do this month.
  canUpgrade: boolean;
  // D-118. The refusal is answered by creating an account, not by paying and
  // not by waiting. Kept separate from `canUpgrade` being false, because "there
  // is nothing to sell you" and "there is one specific thing to do" are
  // different states, and a surface that conflated them would offer a pro
  // player a signup link.
  needsAccount: boolean;
};

const FALLBACKS: Record<number, string> = {
  503: "The coaching service is temporarily unavailable. Your clip wasn't counted against your limit. Try again later.",
  429: "You've hit the hourly analysis limit. Your clip wasn't counted. Try again soon.",
  402: "You've used your analyses for this month.",
};

const GENERIC_FALLBACK = "The coaching service is unavailable. Try again.";

export function analyzeFailureStatus(
  httpStatus: number,
  body: AnalyzeErrorBody | null | undefined,
): AnalyzeFailure {
  // `res.json()` returns whatever the response held, which on a proxy-written
  // error page can be a bare string, an array, or null, so nothing below may
  // assume an object.
  const fields: AnalyzeErrorBody =
    typeof body === "object" && body !== null ? body : {};
  const server =
    typeof fields.error === "string" && fields.error.trim() ? fields.error : null;

  const exhausted = httpStatus === 402;
  const reason = exhausted ? readReason(fields.reason) : null;
  const resetsAt = exhausted ? formatReset(fields.resets_at) : null;

  const calm = FALLBACKS[httpStatus];
  if (calm === undefined) {
    return {
      kind: "error",
      message: server ?? GENERIC_FALLBACK,
      reason: null,
      resetsAt: null,
      canUpgrade: false,
      needsAccount: false,
    };
  }
  return {
    kind: "unavailable",
    message:
      server ?? (exhausted ? exhaustedFallback(calm, reason, resetsAt) : calm),
    reason,
    resetsAt,
    // A 402 that arrived without a readable reason is treated as the free
    // case. The reason is written by our own route, so the only way to land
    // here is a body that was lost in transit, and stranding a free player
    // with no way forward is the worse of the two mistakes: the destination is
    // the plan card, which is honest for either plan.
    canUpgrade:
      exhausted && !NO_SALE_REASONS.includes(reason as AnalyzeFailureReason),
    needsAccount: reason === "anonymous_used",
  };
}

const REASONS: readonly string[] = [
  "free_month_exhausted",
  "plan_month_exhausted",
  "free_day_exhausted",
  "plan_day_exhausted",
  "anonymous_used",
];

function readReason(value: unknown): AnalyzeFailureReason | null {
  return typeof value === "string" && REASONS.includes(value)
    ? (value as AnalyzeFailureReason)
    : null;
}

// The viewer's own timezone, the way every other date in the app renders. An
// unparseable or absent instant yields null so the copy can drop the sentence
// instead of printing "Invalid Date" at a player who is already blocked. Only
// the fallback copy reads this: whenever the server's own message survives the
// trip it wins, so a locally rendered date and a server-rendered one can never
// end up side by side contradicting each other by a day.
function formatReset(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function exhaustedFallback(
  base: string,
  reason: AnalyzeFailureReason | null,
  resetsAt: string | null,
): string {
  // `base` is the 402 fallback, which is a sentence about a month. That is the
  // wrong sentence entirely for a player who never had a month, so this case
  // replaces it rather than appending to it.
  if (reason === "anonymous_used") {
    return "That was your free read, and it's saved. Create an account to keep it.";
  }
  if (PRO_REASONS.includes(reason as AnalyzeFailureReason)) {
    return resetsAt ? `${base} More unlock on ${resetsAt}.` : base;
  }
  return `${base} Upgrade to keep training.`;
}
