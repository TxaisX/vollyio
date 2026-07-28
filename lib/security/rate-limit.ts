// Mirrors the scope check in the newest migration that redefines
// consume_api_quota. An unknown scope raises in SQL rather than silently
// passing, so adding one here without adding it there fails closed.
export type ApiQuotaScope =
  | "analyze"
  | "coach"
  | "coach_daily"
  | "account_delete"
  | "billing";

type RpcClient = {
  rpc(
    name: string,
    args: { p_scope: ApiQuotaScope; p_reservation_id?: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

export async function consumeApiQuota(
  client: RpcClient,
  scope: ApiQuotaScope,
): Promise<{ ok: boolean; allowed: boolean }> {
  try {
    const { data, error } = await client.rpc("consume_api_quota", { p_scope: scope });
    if (error || typeof data !== "boolean") {
      return { ok: false, allowed: false };
    }
    return { ok: true, allowed: data };
  } catch {
    return { ok: false, allowed: false };
  }
}

// Give back one unit of the current window after a paid call that did no
// billable work (e.g. the coaching service refused before charging), so the
// player's hourly slot is not burned by our own outage. Best-effort: the caller
// is already returning an error, so a failed refund is logged and ignored, never
// surfaced. Safe against rate-limit escape because the DB function only
// decrements inside the active window and never below the floor (see
// refund_api_quota); it cannot manufacture extra allowance.
type ServiceRpcClient = {
  rpc(
    name: string,
    args: { p_user_id: string; p_scope: ApiQuotaScope },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Give back the hourly slot a request consumed before the paid work turned out
 * to be impossible (D-043).
 *
 * MUST be called with the SERVICE-ROLE client, not the player's. Refunding is
 * the one quota operation a player must never be able to perform: call it after
 * every analysis and the fixed window never advances, so the 20 per hour cap
 * never fires and each extra request still pays for a coaching call before the
 * insert trigger rejects it.
 *
 * Migration 030 tried to gate this on an entitlement reservation id, reasoning
 * that only the server holds one. That was wrong:
 * `reserve_analysis_entitlement` is granted to `authenticated` and returns the
 * id, so a player could fetch one through the data API. Migration 033 made the
 * function service_role only, which is a boundary rather than a secret.
 *
 * Returns false when the service client is unavailable, which is the state on
 * any deploy without the service key. The slot is simply not returned; nothing
 * is granted and nothing throws.
 */
export async function refundApiQuota(
  client: ServiceRpcClient | null,
  userId: string,
  scope: ApiQuotaScope,
): Promise<boolean> {
  if (!client) return false;
  try {
    const { error } = await client.rpc("refund_api_quota", {
      p_user_id: userId,
      p_scope: scope,
    });
    return !error;
  } catch {
    return false;
  }
}
