export type ApiQuotaScope = "analyze" | "coach" | "account_delete";

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
