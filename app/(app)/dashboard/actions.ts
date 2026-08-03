"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { todayKey } from "@/lib/progression";
import { claimAchievements, type AchievementKey } from "@/lib/achievements";
import { SKILLS } from "@/lib/skills";
import { drillBySlug } from "@/content/drills";

// What the player reports having done. Every field is checked here AND by the
// table's own constraints (migration 036): this layer exists to give a usable
// error, not to be the guard. `felt` is a self-rating, not a score -- it never
// touches skill_ratings, because a player's opinion of a drill is not evidence
// about their technique and must never be laundered into one.
const completion = z.object({
  kind: z.enum(["drill", "study"]),
  skill: z.enum(SKILLS),
  drill_slug: z.string().min(1).max(120).nullable(),
  reps: z.coerce.number().int().min(0).max(500).nullable(),
  felt: z.enum(["easy", "right", "hard"]).nullable(),
});

export type ChallengeState = {
  ok: boolean;
  error: string | null;
  awarded: number;
  badges: AchievementKey[];
};

export async function completeChallenge(
  _prev: ChallengeState,
  formData: FormData,
): Promise<ChallengeState> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { ok: false, error: "Sign in to log today's work.", awarded: 0, badges: [] };

  const parsed = completion.safeParse({
    kind: formData.get("kind"),
    skill: formData.get("skill"),
    drill_slug: emptyToNull(formData.get("drill_slug")),
    reps: emptyToNull(formData.get("reps")),
    felt: emptyToNull(formData.get("felt")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "That didn't look right. Check the reps and try again.",
      awarded: 0,
      badges: [],
    };
  }
  const value = parsed.data;

  // A slug that is not in the catalog is a client that invented one. Reject
  // rather than store it: content/drills.ts is the only source of drills, and a
  // stored slug that resolves to nothing becomes a broken card forever.
  if (value.drill_slug && !drillBySlug(value.drill_slug)) {
    return { ok: false, error: "That drill doesn't exist.", awarded: 0, badges: [] };
  }
  if (value.kind === "drill" && !value.drill_slug) {
    return { ok: false, error: "A logged drill has to say which drill.", awarded: 0, badges: [] };
  }

  // The day key is sent, but the database checks it against its OWN clock and
  // accepts only today or yesterday (036). A client cannot backfill a streak.
  const { data, error } = await supabase.rpc("complete_daily_challenge", {
    p_day_key: todayKey(),
    p_kind: value.kind,
    p_skill: value.skill,
    p_drill_slug: value.drill_slug,
    p_reps: value.reps,
    p_felt: value.felt,
  });

  if (error) {
    console.error("[challenge] completion failed", { message: error.message });
    return { ok: false, error: "Couldn't save that just now. Try again.", awarded: 0, badges: [] };
  }

  // A logged day can tip a streak or challenge-count badge over, so the claim
  // runs while the player is still looking at the card that earned it. Fails
  // soft to [] and never blocks the completion (migration 050).
  const badges = await claimAchievements(supabase);

  revalidatePath("/dashboard");
  // Zero awarded is a success, not a failure: it means today was already
  // logged. The work is recorded either way and the card should read as done.
  return {
    ok: true,
    error: null,
    awarded: typeof data === "number" ? data : 0,
    badges,
  };
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}
