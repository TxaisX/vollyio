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
/**
 * Give back the hourly slot a request consumed before the paid work turned out
 * to be impossible (D-043).
 *
 * The reservation id is required and is the whole security property. This
 * function is SECURITY DEFINER and granted to `authenticated`, so PostgREST
 * publishes it and a player can call it with their own token. Before migration
 * 030 that was a quota escape: refund after every analysis and the fixed window
 * never advanced, so the 20 per hour cap never fired and each extra request
 * still paid for a coaching call before the insert trigger rejected it. The
 * reservation id is generated in the database, handed to this route, and never
 * sent to a client, so presenting it is proof the caller is the route.
 */
export async function refundApiQuota(
  client: RpcClient,
  scope: ApiQuotaScope,
  reservationId: string,
): Promise<boolean> {
  try {
    const { error } = await client.rpc("refund_api_quota", {
      p_scope: scope,
      p_reservation_id: reservationId,
    });
    return !error;
  } catch {
    return false;
  }
}
