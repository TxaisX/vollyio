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

// The player's decision on a breakdown (the flywheel ground-truth signal): was
// the opus-low COACHING helpful, and if not, WHAT was off + an optional note.
// The skill/subject are user-declared, so this grades the coaching, not the skill.
// Upserts one row per analysis; RLS ties the write to an analysis the caller owns.
const FEEDBACK_REASONS = ["wrong_player", "off_read", "not_helpful"] as const;
const feedbackSchema = z.object({
  analysisId: z.string().uuid(),
  wasRight: z.boolean(),
  reasons: z.array(z.enum(FEEDBACK_REASONS)).max(3).optional(),
  note: z.string().trim().max(500).nullish(),
});

export async function submitAnalysisFeedback(
  input: unknown,
): Promise<{ ok: boolean } | { error: string }> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: "Couldn't save that." };
  const { analysisId, wasRight, reasons, note } = parsed.data;

  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { error: "Please log in." };

  const { error } = await supabase.from("analysis_feedback").upsert(
    {
      analysis_id: analysisId,
      user_id: userId,
      was_right: wasRight,
      // reasons only apply when they said it missed
      reasons: wasRight ? [] : (reasons ?? []),
      note: note && note.length > 0 ? note : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "analysis_id" },
  );
  if (error) return { error: "Couldn't save that." };

  revalidatePath(`/analysis/${analysisId}`);
  return { ok: true };
}
