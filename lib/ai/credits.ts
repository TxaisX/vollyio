// The prepaid balance, which it turns out the app CAN read.
//
// `docs/billing.md` said twice, and D-102 and D-109 said once each, that the app
// cannot read its own balance. That was never verified against the gateway and
// it is false: `GET /api/v1/credits` answers with the lifetime grant and the
// lifetime usage, authenticated by the same key every model call already sends.
// Checked 2026-08-11: `{"total_credits":100,"total_usage":20.709952016}`, HTTP
// 200, no extra scope and no second credential.
//
// This matters more than a stale sentence usually would, because that sentence
// was the stated reason the product had no spend warning at all. The balance is
// the one wall that takes the whole product down at once, for everyone, with no
// per-account quota able to see it coming, and the reason given for accepting
// that risk was an assumption nobody tested.

/** What the gateway answers. Both figures are LIFETIME, not per-period. */
export type CreditsReading = {
  totalCredits: number;
  totalUsage: number;
  /** What is left to spend. The only figure any caller should reason about. */
  remainingUsd: number;
};

// Measured, from `analyses.telemetry` in production (D-106). Used to express a
// dollar balance as the thing an owner actually needs to know: how many more
// reps can be coached before everything stops.
export const USD_PER_ANALYSIS = 0.0164;

export function analysesRemaining(remainingUsd: number): number {
  return Math.max(0, Math.floor(remainingUsd / USD_PER_ANALYSIS));
}

// Thresholds in ANALYSES, not dollars, because the dollar figure means nothing
// on its own and because the per-analysis cost has already changed by 14x once
// in this product's life. Expressed as "how much warning do I want": ~500 is a
// few weeks at any plausible near-term volume, ~100 is days.
export const LOW_ANALYSES = 500;
export const CRITICAL_ANALYSES = 100;

export type CreditsVerdict = "ok" | "low" | "critical" | "unreadable";

/**
 * Pure. `null` means the balance could not be read, which is deliberately NOT
 * the same as zero: a gateway that will not answer is a monitoring failure, and
 * reporting it as "out of credit" would trip a false alarm every time the
 * endpoint blips. It is its own verdict so a caller can tell the two apart.
 */
export function creditsVerdict(reading: CreditsReading | null): CreditsVerdict {
  if (reading === null) return "unreadable";
  const left = analysesRemaining(reading.remainingUsd);
  if (left <= CRITICAL_ANALYSES) return "critical";
  if (left <= LOW_ANALYSES) return "low";
  return "ok";
}

const ENDPOINT = "https://openrouter.ai/api/v1/credits";

// Short. This runs inside a player's request and the answer is a nicety; a slow
// billing endpoint must never add its latency to somebody's analysis.
const TIMEOUT_MS = 3000;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Never throws, never returns a partial reading. Any shape that is not two
 * finite numbers is `null`, because a balance that is guessed is worse than a
 * balance that is missing: the whole point of this module is to be trusted when
 * it says the money is nearly gone.
 */
export function parseCredits(payload: unknown): CreditsReading | null {
  if (payload === null || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const totalCredits = d.total_credits;
  const totalUsage = d.total_usage;
  if (typeof totalCredits !== "number" || !Number.isFinite(totalCredits)) return null;
  if (typeof totalUsage !== "number" || !Number.isFinite(totalUsage)) return null;
  return {
    totalCredits,
    totalUsage,
    // Clamped at zero. The gateway can report usage past the grant when a
    // request lands as the balance empties, and a negative "remaining" would
    // read as a surplus through `analysesRemaining`'s floor.
    remainingUsd: Math.max(0, totalCredits - totalUsage),
  };
}

export async function readCredits(
  deps: { fetchImpl?: FetchLike; apiKey?: string } = {},
): Promise<CreditsReading | null> {
  const key = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const doFetch = deps.fetchImpl ?? (fetch as unknown as FetchLike);
  try {
    const res = await doFetch(ENDPOINT, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseCredits(await res.json());
  } catch {
    return null;
  }
}

// Written for the owner. Says the number, says how long it buys, and names the
// one action that clears it. No vendor name, same rule as every other string.
export function formatCreditsAlert(
  reading: CreditsReading,
  verdict: Exclude<CreditsVerdict, "ok" | "unreadable">,
): { subject: string; text: string } {
  const left = analysesRemaining(reading.remainingUsd);
  const money = `$${reading.remainingUsd.toFixed(2)}`;
  return {
    subject:
      verdict === "critical"
        ? `Vollyio model credit CRITICAL: ${money} left`
        : `Vollyio model credit low: ${money} left`,
    text: [
      verdict === "critical"
        ? "The prepaid model balance is nearly gone. At zero, EVERY analysis"
        : "The prepaid model balance is running down. At zero, every analysis",
      "fails for everyone at once, paying subscribers included, and no",
      "per-account quota can see it coming.",
      "",
      `Remaining:      ${money}`,
      `That buys:      ~${left} analyses at the measured $${USD_PER_ANALYSIS}`,
      `Granted:        $${reading.totalCredits.toFixed(2)}`,
      `Used:           $${reading.totalUsage.toFixed(2)}`,
      "",
      "Fix: add credit at the gateway. Nothing in the app needs redeploying.",
    ].join("\n"),
  };
}
