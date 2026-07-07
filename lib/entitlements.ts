import { createClient } from "@/lib/supabase/server";

export async function canAnalyze(
  userId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (process.env.BILLING_ENABLED !== "true") return { ok: true };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  if (profile?.plan && profile.plan !== "free") return { ok: true };

  const { count } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= 1) {
    return { ok: false, reason: "Your free analysis is used. Upgrade to keep training." };
  }
  return { ok: true };
}
