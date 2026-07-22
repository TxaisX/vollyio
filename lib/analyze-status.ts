// Maps an /api/analyze failure to the client status states (D-054). The calm
// chalk "unavailable" rendering was previously reserved for 503; hourly-limit
// 429 and free-cap 402 landed in the coral error state even though the player
// did nothing wrong and their clip was never read. A 409 conflict stays an
// error: it is genuinely actionable right now (an analysis is already
// running). Server-supplied copy always wins; fallbacks cover a body that
// failed to parse.
export type AnalyzeFailure = {
  kind: "unavailable" | "error";
  message: string;
};

const FALLBACKS: Record<number, string> = {
  503: "The coaching service is temporarily unavailable. Your clip wasn't counted against your limit. Try again later.",
  429: "You've hit the hourly analysis limit. Your clip wasn't counted. Try again soon.",
  402: "Your free analysis is used. Upgrade to keep training.",
};

const GENERIC_FALLBACK = "The coaching service is unavailable. Try again.";

export function analyzeFailureStatus(
  httpStatus: number,
  serverError: string | null | undefined,
): AnalyzeFailure {
  const server = serverError && serverError.trim() ? serverError : null;
  const calm = FALLBACKS[httpStatus];
  if (calm !== undefined) {
    return { kind: "unavailable", message: server ?? calm };
  }
  return { kind: "error", message: server ?? GENERIC_FALLBACK };
}
