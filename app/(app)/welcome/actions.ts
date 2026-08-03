"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { SKILLS, SKILL_LABEL, DISCIPLINES } from "@/lib/skills";
import { FREQUENCIES, LEVELS, POSITIONS, TIMEFRAMES } from "@/lib/funnel";

const onboardingSchema = z.object({
  discipline: z.enum(DISCIPLINES).default("indoor"),
  level: z.enum(LEVELS),
  position: z.enum(POSITIONS).optional(),
  play_frequency: z.enum(FREQUENCIES).optional(),
  skill: z.enum(SKILLS),
  target_rating: z.coerce.number().int().min(1).max(100).optional(),
  timeframe_days: z.coerce
    .number()
    .int()
    .refine((d): d is (typeof TIMEFRAMES)[number] =>
      (TIMEFRAMES as readonly number[]).includes(d),
    )
    .default(90),
});

type OnboardingAnswers = z.infer<typeof onboardingSchema>;

async function applyAnswers(userId: string, answers: OnboardingAnswers) {
  const supabase = await createClient();
  const { discipline, level, position, play_frequency, skill, target_rating, timeframe_days } =
    answers;

  const { error } = await supabase
    .from("profiles")
    .update({
      level,
      discipline,
      position: position ?? null,
      play_frequency: play_frequency ?? null,
    })
    .eq("id", userId);
  // A constraint rejection here used to vanish silently and strand the player
  // with a half-applied profile; fail loudly instead.
  if (error) throw new Error(`profile update failed: ${error.message}`);

  if (target_rating) {
    const deadline = new Date(Date.now() + timeframe_days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await supabase.from("goals").insert({
      user_id: userId,
      title: `${SKILL_LABEL[skill]} to ${target_rating}`,
      skill,
      target_rating,
      deadline,
    });
  }
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) redirect("/login");

  const parsed = onboardingSchema.safeParse({
    discipline: formData.get("discipline") ?? undefined,
    level: formData.get("level"),
    position: formData.get("position") ?? undefined,
    play_frequency: formData.get("play_frequency") ?? undefined,
    skill: formData.get("skill"),
    target_rating: formData.get("target_rating") || undefined,
    timeframe_days: formData.get("timeframe_days") || undefined,
  });
  // A malformed submit used to silently drop every answer into /analyze,
  // which read as "saved" while nothing was. Landing back here with the
  // notice keeps the player in the flow and tells the truth: nothing stuck,
  // run it once more.
  if (!parsed.success) redirect("/welcome?retry=1");

  await applyAnswers(userId, parsed.data);
  redirect(
    `/analyze?skill=${parsed.data.skill}&discipline=${parsed.data.discipline}`,
  );
}

/**
 * Applies funnel answers parked in localStorage by the pre-signup quiz
 * (/start) once the player's first authed page mounts. Silently drops the
 * payload for players who already have reps: the funnel is a first-session
 * ramp, never an overwrite.
 */
export async function applyFunnel(payload: unknown) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return;

  const parsed = onboardingSchema.safeParse(payload);
  if (!parsed.success) return;

  const { count } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  await applyAnswers(userId, parsed.data);
  redirect(
    `/analyze?skill=${parsed.data.skill}&discipline=${parsed.data.discipline}`,
  );
}
