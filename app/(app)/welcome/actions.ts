"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { SKILLS, DISCIPLINES } from "@/lib/skills";
import { FREQUENCIES, LEVELS, POSITIONS, TIMEFRAMES } from "@/lib/funnel";
import { CHAT_MODEL } from "@/lib/ai/client";
import { completeObject, hasChatKey } from "@/lib/ai/chat";
import {
  ONBOARDING_BRIEF_SYSTEM,
  fallbackGoalTitle,
  onboardingBriefPrompt,
  onboardingBriefSchema,
  type BriefSeed,
} from "@/lib/ai/onboarding-brief";
import { generateWeeklyPlan } from "../plan/actions";

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

/**
 * Ask the model for a goal the player recognises as theirs, and decorate the
 * row that was already written with it.
 *
 * FAILS OPEN, and the ordering is what guarantees that: the deterministic goal
 * is inserted first and is complete on its own, so this only ever runs an
 * UPDATE over a row that is already correct. A timeout, a refusal, a schema
 * miss, an empty prepaid balance or a missing credential all leave the account
 * exactly as it shipped before personalization existed. Nothing a player needs
 * is downstream of a model call.
 *
 * Bounded hard at 12 seconds with one retry, unlike the weekly plan's 50. This
 * one is INLINE in the signup redirect, and a new account waiting on a spinner
 * is the most expensive place in the product to spend time (D-102: the funnel
 * already loses 88.5% before this point). Better a generic title instantly than
 * a bespoke one in forty seconds.
 */
async function personalizeGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  goalId: string,
  seed: BriefSeed,
): Promise<void> {
  if (!hasChatKey()) return;
  try {
    const { parsed } = await completeObject({
      model: CHAT_MODEL,
      system: ONBOARDING_BRIEF_SYSTEM,
      messages: [{ role: "user", content: onboardingBriefPrompt(seed) }],
      schema: onboardingBriefSchema,
      schemaName: "onboarding_brief",
      // Sized from the worst reasoning draw, not from the answer (D-096). The
      // reply itself is two short strings; the ceiling covers an upstream that
      // reasons for two thousand tokens before writing any of it.
      maxTokens: 4096,
      timeoutMs: 12_000,
      maxRetries: 1,
    });
    if (!parsed) return;
    await supabase
      .from("goals")
      .update({ title: parsed.goal_title, note: parsed.focus_note })
      .eq("id", goalId);
  } catch (err) {
    // Deliberately swallowed. The account is already set up; this was the
    // decoration on top of it.
    console.error("[onboarding] personalization skipped", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

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

  // The deterministic goal, written FIRST and complete without any model. The
  // title it carries here is the one that shipped for months; personalization
  // overwrites it a moment later or does not, and either account works.
  const deadline = new Date(Date.now() + timeframe_days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: goal } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: fallbackGoalTitle(skill, target_rating),
      skill,
      target_rating: target_rating ?? null,
      deadline,
    })
    .select("id")
    .single();

  if (goal?.id) {
    await personalizeGoal(supabase, goal.id, {
      skill,
      level,
      discipline,
      position,
      playFrequency: play_frequency,
      targetRating: target_rating,
      timeframeDays: timeframe_days,
    });
  }

  // The first training week, generated AFTER the response has gone out.
  //
  // It cannot run inline: measured healthy draws take 20 to 38 seconds against
  // a 50 second ceiling, which is a spinner no new account should ever see.
  // `after()` streams the redirect first and does the work behind it, so the
  // player is filming their first rep while their week is being written. It is
  // registered before the redirect below, because `redirect()` throws and
  // anything scheduled after the throw never runs.
  //
  // Its own reservation (migration 038) makes this safe to fire blind: if the
  // player opens /plan and generates one manually in the meantime, whichever
  // claims the week first wins and the other returns without spending.
  after(async () => {
    try {
      await generateWeeklyPlan({ ok: true, error: null }, new FormData());
    } catch (err) {
      console.error("[onboarding] first plan skipped", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
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
