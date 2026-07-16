type RpcResult = PromiseLike<{ data: unknown; error: unknown }>;

type EntitlementClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResult;
};

type ReservationResult =
  | { ok: true; allowed: true; reservationId: string }
  | { ok: true; allowed: false; reason: "used" | "in_progress" }
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

  if (row.reason === "used" || row.reason === "in_progress") {
    return { ok: true, allowed: false, reason: row.reason };
  }
  return { ok: false, allowed: false };
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
