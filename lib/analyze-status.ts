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
  | "plan_month_exhausted";

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
    canUpgrade: exhausted && reason !== "plan_month_exhausted",
  };
}

function readReason(value: unknown): AnalyzeFailureReason | null {
  return value === "free_month_exhausted" || value === "plan_month_exhausted"
    ? value
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
  if (reason === "plan_month_exhausted") {
    return resetsAt ? `${base} More unlock on ${resetsAt}.` : base;
  }
  return `${base} Upgrade to keep training.`;
}
