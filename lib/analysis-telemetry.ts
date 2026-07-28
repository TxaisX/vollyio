// The server's measurement of what one coaching call cost, and after migration
// 029 the server is the only thing that can write it (D-065).
//
// The hole this closes: migration 016 put `analyses.telemetry` on the insert
// the analyze route performs with the PLAYER'S credentials, which forced
// `grant insert (telemetry) ... to authenticated`. `analyze_usage_month()`
// sums that column, lib/ai/budget.ts prices the sum, and a tripped budget
// answers 503 to every player, so one account posting absurd token counts
// could take the product offline for all of them. Migration 028 bounded the
// values, which caps the damage. Removing the grant is what removes the
// ability, and this module is the replacement writer.
//
// Nothing here may fail an analysis. By the time it runs the player already has
// a scored rep saved; a lost measurement is an operator problem, not theirs. So
// every path returns an outcome and none of them throws, and the caller reads
// the outcome for logging only.
//
// This module deliberately does not import lib/supabase/service.ts. That module
// is `server-only`, and a static import would put this whole file beyond the
// reach of `node --test`, which is where the bounds and every failure path are
// checked. The caller passes the client in, which also keeps the list of
// service-role importers something a reviewer can find by reading the routes.

type TelemetryRpcResult = PromiseLike<{ data: unknown; error: unknown }>;

export type TelemetryClient = {
  rpc(name: string, args?: Record<string, unknown>): TelemetryRpcResult;
};

/**
 * What happened, for the log line. Only `recorded` means a number was stored;
 * every other value means the analysis succeeded and the measurement did not.
 */
export type TelemetryOutcome =
  | "recorded"
  | "not_applied"
  | "no_service_client"
  | "nothing_to_record"
  | "invalid"
  | "failed";

/**
 * The per-field ceilings from migration 028's analyses_telemetry_bounds_check,
 * re-stated in TypeScript so a payload that the database would refuse is never
 * sent. These three copies (this map, the constraint, and the re-check inside
 * record_analysis_telemetry) must move together; analysis-telemetry.test.ts
 * pins them against the migration text so they cannot drift silently.
 */
export const TELEMETRY_CEILINGS = {
  input_tokens: 5000000,
  output_tokens: 1000000,
  cache_read_input_tokens: 5000000,
  cache_creation_input_tokens: 5000000,
  duration_ms: 600000,
} as const;

// Below the database's own 2000-character ceiling on the serialized document,
// so a payload that passes here cannot be refused there for size. The gap
// covers the whitespace the database adds when it re-serializes the value.
export const TELEMETRY_MAX_JSON_LENGTH = 1500;

// The write is one round trip inside the region the database sits in, so this
// is a bound and not a target: it exists so a hung connection cannot hold a
// scored rep hostage while the route waits to log a number nobody sees.
const DEFAULT_TIMEOUT_MS = 2000;

let warnedMissingServiceClient = false;

/**
 * The field that would make the database refuse this telemetry, or null when
 * the payload is storable. `size` names the whole-document ceiling rather than
 * a field. Absent and json-null fields are allowed: the constraint reads them
 * as zero, exactly as a mock run or an older reply shape would leave them.
 */
export function telemetryViolation(telemetry: Record<string, unknown>): string | null {
  if (JSON.stringify(telemetry).length > TELEMETRY_MAX_JSON_LENGTH) return "size";
  for (const [field, ceiling] of Object.entries(TELEMETRY_CEILINGS)) {
    const value = telemetry[field];
    if (value === undefined || value === null) continue;
    // Integers only: the constraint casts through bigint, so a fractional value
    // fails at the database as a cast error rather than as a bounds message.
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > ceiling
    ) {
      return field;
    }
  }
  return null;
}

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

async function sendTelemetry(
  client: TelemetryClient,
  analysisId: string,
  telemetry: Record<string, unknown>,
): Promise<TelemetryOutcome> {
  try {
    const { data, error } = await client.rpc("record_analysis_telemetry", {
      p_analysis_id: analysisId,
      p_telemetry: telemetry,
    });
    if (error) {
      console.error("[analyze] telemetry write failed", {
        analysisId,
        message: messageOf(error),
      });
      return "failed";
    }
    if (data === false) {
      // The function matched no row: this analysis already carries telemetry,
      // or it is older than the function's one-hour window. Neither is reachable
      // from the route's own path, so it is worth a line if it ever happens.
      console.warn("[analyze] telemetry write matched no row", { analysisId });
      return "not_applied";
    }
    return "recorded";
  } catch (err) {
    console.error("[analyze] telemetry write threw", {
      analysisId,
      message: messageOf(err),
    });
    return "failed";
  }
}

/**
 * Record the cost of one analysis, with credentials the player does not hold.
 *
 * Never throws and never rejects, on any path, because the caller has already
 * saved the player's rep and must return it whatever happens here. `client` is
 * null when SUPABASE_SERVICE_ROLE_KEY is absent, which is the state of the
 * production deployment as this ships: that path records nothing, warns once
 * per instance, and is not an error.
 */
export async function recordAnalysisTelemetry(
  client: TelemetryClient | null,
  analysisId: string,
  telemetry: Record<string, unknown> | null,
  opts: { timeoutMs?: number } = {},
): Promise<TelemetryOutcome> {
  // A mock run has nothing to measure and no spend to attribute.
  if (!telemetry) return "nothing_to_record";

  const violation = telemetryViolation(telemetry);
  if (violation) {
    // The database would refuse this too. Refusing here means a defect in how
    // the route builds the payload reads as itself in the log instead of as a
    // constraint error, and the wrong number is never offered for storage.
    console.error("[analyze] telemetry refused before the write", {
      analysisId,
      field: violation,
    });
    return "invalid";
  }

  if (!client) {
    // One line per server instance, not one per analysis: this is the live
    // configuration today, so a per-request warning would be noise in the only
    // log that would show a real failure. The line names the consequence
    // because it is not obvious from here: with nothing writing telemetry,
    // analyze_usage_month() sees no tokens and the monthly spend backstop in
    // lib/ai/budget.ts prices an empty month and never trips.
    if (!warnedMissingServiceClient) {
      warnedMissingServiceClient = true;
      console.warn(
        "[analyze] telemetry not recorded: service credentials unavailable, so the monthly spend estimate under-reports",
      );
    }
    return "no_service_client";
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // sendTelemetry resolves rather than rejects on every failure, so the loser of
  // this race can be abandoned without leaving an unhandled rejection behind.
  const work = sendTelemetry(client, analysisId, telemetry);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<TelemetryOutcome>((resolve) => {
    timer = setTimeout(() => {
      console.error("[analyze] telemetry write timed out", { analysisId, timeoutMs });
      resolve("failed");
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

export function resetAnalysisTelemetryWarningForTests(): void {
  warnedMissingServiceClient = false;
}
