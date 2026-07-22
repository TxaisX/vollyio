import { estimateCostUsd, type UsageTokens } from "./pricing.ts";

// Self-imposed monthly spend ceiling for the analyze route (D-054). The
// provider's account-level cap killed production on 2026-07-20 because local
// dev shared it; this guard trips first, through the same calm 503 path the
// capacity outage already uses, so the app degrades instead of dying.
//
// Semantics: env unset or malformed = guard disabled (a misconfigured deploy
// degrades to "no guard", never to "dead app"); AI_MOCK = skipped; the
// month-to-date aggregate is cached for 5 minutes per server instance; an
// aggregate we cannot fetch or cannot price = "unavailable" = fail closed,
// matching the house rule for spend protection and the route's existing
// behavior on rate-limit RPC failures.
export type BudgetVerdict = "ok" | "tripped" | "unavailable";

type ModelUsage = UsageTokens & { model: string };

type RpcClient = {
  rpc(name: string): PromiseLike<{ data: unknown; error: unknown }>;
};

const CACHE_TTL_MS = 5 * 60_000;

let cache: { entries: ModelUsage[]; fetchedAt: number } | null = null;
let warnedDisabled = false;

export function evaluateBudget(estimatedUsd: number, capUsd: number): "ok" | "tripped" {
  return estimatedUsd >= capUsd ? "tripped" : "ok";
}

function parseEntries(data: unknown): ModelUsage[] | null {
  if (!Array.isArray(data)) return null;
  const entries: ModelUsage[] = [];
  for (const row of data) {
    if (row === null || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (typeof r.model !== "string") return null;
    const fields = [
      "input_tokens",
      "output_tokens",
      "cache_read_input_tokens",
      "cache_creation_input_tokens",
    ] as const;
    const tokens: Record<string, number> = {};
    for (const field of fields) {
      const value = r[field];
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      tokens[field] = value;
    }
    entries.push({ model: r.model, ...tokens } as ModelUsage);
  }
  return entries;
}

export async function checkAnalyzeBudget(
  client: RpcClient,
  opts: { now?: () => number } = {},
): Promise<BudgetVerdict> {
  const capRaw = process.env.ANALYZE_MONTHLY_BUDGET_USD;
  if (capRaw === undefined || capRaw === "") return "ok";
  const capUsd = Number(capRaw);
  if (!Number.isFinite(capUsd) || capUsd <= 0) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn(
        `[budget] ANALYZE_MONTHLY_BUDGET_USD=${JSON.stringify(capRaw)} is not a positive number; guard disabled`,
      );
    }
    return "ok";
  }
  if (process.env.AI_MOCK === "true") return "ok";

  const now = (opts.now ?? Date.now)();
  let entries: ModelUsage[] | null = null;
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    entries = cache.entries;
  } else {
    try {
      const { data, error } = await client.rpc("analyze_usage_month");
      const parsed = error ? null : parseEntries(data);
      if (parsed) {
        entries = parsed;
        cache = { entries: parsed, fetchedAt: now };
      }
    } catch {
      // fall through to the stale cache, then to fail-closed
    }
    if (!entries && cache) entries = cache.entries;
  }
  if (!entries) return "unavailable";

  let totalUsd = 0;
  for (const entry of entries) {
    try {
      totalUsd += estimateCostUsd(entry, entry.model);
    } catch {
      return "unavailable";
    }
  }
  return evaluateBudget(totalUsd, capUsd);
}

export function resetBudgetCacheForTests(): void {
  cache = null;
  warnedDisabled = false;
}
