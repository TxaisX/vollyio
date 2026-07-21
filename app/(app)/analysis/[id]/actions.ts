"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { generateShareToken, hashShareToken } from "@/lib/share-token";
import { SITE_URL } from "@/lib/site";

const idSchema = z.string().uuid();

// Mints a fresh token each time; only its hash is stored, so this is the one
// moment the URL exists (D-049). RLS ties the insert to an analysis the
// caller owns.
export async function createShareLink(
  analysisId: string,
): Promise<{ url: string } | { error: string }> {
  const parsed = idSchema.safeParse(analysisId);
  if (!parsed.success) return { error: "Couldn't create a share link." };

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { error: "Please log in." };

  const token = generateShareToken();
  const { error } = await supabase.from("share_links").insert({
    analysis_id: parsed.data,
    user_id: userId,
    token_hash: hashShareToken(token),
  });
  if (error) return { error: "Couldn't create a share link." };

  revalidatePath(`/analysis/${parsed.data}`);
  return { url: `${SITE_URL}/share/${token}` };
}

export async function revokeShareLinks(
  analysisId: string,
): Promise<{ ok: boolean }> {
  const parsed = idSchema.safeParse(analysisId);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { ok: false };

  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("analysis_id", parsed.data)
    .is("revoked_at", null);

  revalidatePath(`/analysis/${parsed.data}`);
  return { ok: !error };
}
