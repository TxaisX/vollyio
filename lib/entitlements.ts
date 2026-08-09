type RpcResult = PromiseLike<{ data: unknown; error: unknown }>;

type EntitlementClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResult;
};

// What the 402 needs in order to say something true: which plan, how many the
// plan allows, how many are spent, and when the window rolls. Null when the
// database reply did not carry them, in which case the client says "you're
// out" without inventing a number.
export type AllowanceDetail = {
  plan: string;
  allowance: number;
  used: number;
  resetsAt: string;
};

type ReservationResult =
  | { ok: true; allowed: true; reservationId: string }
  | { ok: true; allowed: false; reason: "in_progress" }
  | {
      ok: true;
      allowed: false;
      reason: "month_exhausted";
      detail: AllowanceDetail | null;
    }
  // D-110's daily wall. Same shape as the monthly refusal on purpose: it
  // carries the same numbers, and only the period they describe differs, so
  // every surface downstream renders it through one code path with one noun
  // swapped rather than growing a parallel set of strings.
  | {
      ok: true;
      allowed: false;
      reason: "day_exhausted";
      detail: AllowanceDetail | null;
    }
  | { ok: false; allowed: false };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function reserveAnalysisEntitlement(
  client: EntitlementClient,
  enforceBilling: boolean,
): Promise<ReservationResult> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await client.rpc("reserve_analysis_entitlement", {
      p_enforce_free: enforceBilling,
    }));
  } catch {
    return { ok: false, allowed: false };
  }
  if (error || !data || typeof data !== "object") {
    return { ok: false, allowed: false };
  }

  const row = data as Record<string, unknown>;
  if (
    typeof row.allowed !== "boolean" ||
    !("reservation_id" in row) ||
    !("reason" in row)
  ) {
    return { ok: false, allowed: false };
  }

  if (row.allowed) {
    const reservationId = row.reservation_id;
    if (
      typeof reservationId !== "string" ||
      !UUID_PATTERN.test(reservationId)
    ) {
      return { ok: false, allowed: false };
    }
    return { ok: true, allowed: true, reservationId };
  }

  if (row.reason === "in_progress") {
    return { ok: true, allowed: false, reason: "in_progress" };
  }

  // 'used' is migration 011's lifetime-one reason, superseded by 026's monthly
  // window. Accepting it here makes the deploy order not matter: code that
  // lands before the migration still denies with an upsell instead of reading
  // as a malformed reply and returning a 503.
  if (row.reason === "month_exhausted" || row.reason === "used") {
    return {
      ok: true,
      allowed: false,
      reason: "month_exhausted",
      detail: allowanceDetail(row),
    };
  }
  // Migration 057. Deliberately accepted even by builds that predate it in the
  // same way 'used' is above: the reason arrives from the database, so during a
  // deploy window the code may be older than the function answering it, and an
  // unrecognized reason would read as malformed and 503 a player who is simply
  // out for the day.
  if (row.reason === "day_exhausted") {
    return {
      ok: true,
      allowed: false,
      reason: "day_exhausted",
      detail: allowanceDetail(row),
    };
  }
  return { ok: false, allowed: false };
}

function allowanceDetail(row: Record<string, unknown>): AllowanceDetail | null {
  const { plan, allowance, used, resets_at: resetsAt } = row;
  if (
    typeof plan !== "string" ||
    typeof allowance !== "number" ||
    !Number.isFinite(allowance) ||
    typeof used !== "number" ||
    !Number.isFinite(used) ||
    typeof resetsAt !== "string"
  ) {
    return null;
  }
  return { plan, allowance, used, resetsAt };
}

export async function releaseAnalysisEntitlement(
  client: EntitlementClient,
  reservationId: string,
): Promise<boolean> {
  try {
    const { error } = await client.rpc("release_analysis_entitlement", {
      p_reservation_id: reservationId,
    });
    return !error;
  } catch {
    return false;
  }
}
