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
    args: { p_scope: ApiQuotaScope },
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
export async function refundApiQuota(
  client: RpcClient,
  scope: ApiQuotaScope,
): Promise<boolean> {
  try {
    const { error } = await client.rpc("refund_api_quota", { p_scope: scope });
    return !error;
  } catch {
    return false;
  }
}
