"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { coach, COACH_MODEL, COACH_EFFORT } from "@/lib/ai/client";
import { todayKey } from "@/lib/progression";
import { PLAN_DAYS, planPrompt, weekStartKey, type PlanSeed } from "@/lib/weekly-plan";
import { DRILLS, drillBySlug } from "@/content/drills";
import { SKILLS, type Skill } from "@/lib/skills";

export type PlanState = { ok: boolean; error: string | null };

// Bounded on purpose. `days` is exactly seven because a plan with a missing
// Thursday is worse than no plan, and `minutes` is capped so a generated week
// cannot quietly prescribe a two-hour session to a fourteen-year-old.
const planSchema = z.object({
  headline: z.string(),
  why: z.string(),
  days: z
    .array(
      z.object({
        day: z.enum(PLAN_DAYS),
        focus: z.string(),
        detail: z.string(),
        drill_slug: z.string().nullable(),
        minutes: z.number().int().min(0).max(90),
      }),
    )
    .length(7),
});

export async function generateWeeklyPlan(
  _prev: PlanState,
  _formData: FormData,
): Promise<PlanState> {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return { ok: false, error: "Sign in to build a plan." };

  const weekStart = weekStartKey(todayKey());

  // Claim the week BEFORE spending. A second click, a second tab, or a
  // double-submitted form gets false here and never reaches the model, which
  // is the whole reason this is a reservation and not a write-when-finished.
  const { data: claimed, error: claimError } = await supabase.rpc(
    "reserve_weekly_plan",
    { p_week_start: weekStart },
  );
  if (claimError) {
    console.error("[plan] reservation failed", { message: claimError.message });
    return { ok: false, error: "Couldn't start a plan just now. Try again." };
  }
  if (claimed !== true) {
    // Already generated, or a generation is in flight. Either way the page
    // should show what is there rather than paying for a second one.
    revalidatePath("/plan");
    return { ok: true, error: null };
  }

  try {
    const seed = await readSeed(supabase, userId);
    const response = await coach().messages.parse(
      {
        model: COACH_MODEL,
        max_tokens: 2000,
        thinking: { type: "adaptive" },
        system: [
          {
            type: "text",
            text: "You are a volleyball development coach writing a training week for one player. They train mostly without a coach watching, and the audience starts at 13, so keep the loading conservative and the form cues explicit. Be specific and practical. Never invent facts about the player that the brief does not state.",
          },
        ],
        messages: [{ role: "user", content: planPrompt(seed) }],
        output_config: {
          effort: COACH_EFFORT,
          format: zodOutputFormat(planSchema),
        },
      },
      { maxRetries: 2 },
    );

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("no parsed output");

    // A slug the catalog does not know renders as a dead card forever, so an
    // invented one is dropped rather than stored. The day survives; it just
    // loses its drill link.
    const plan = {
      ...parsed,
      days: parsed.days.map((d) => ({
        ...d,
        drill_slug: d.drill_slug && drillBySlug(d.drill_slug) ? d.drill_slug : null,
      })),
    };

    const { error: saveError } = await supabase.rpc("save_weekly_plan", {
      p_week_start: weekStart,
      p_plan: plan,
      p_model: COACH_MODEL,
    });
    if (saveError) throw saveError;

    revalidatePath("/plan");
    revalidatePath("/dashboard");
    return { ok: true, error: null };
  } catch (err) {
    // Hand the week back so the player can retry immediately instead of
    // waiting out the reservation window with nothing to show for it.
    await supabase.rpc("release_weekly_plan", { p_week_start: weekStart });
    console.error("[plan] generation failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Couldn't build the plan just now. Try again." };
  }
}

async function readSeed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<PlanSeed> {
  const [{ data: profile }, { data: ratings }, { data: last }] = await Promise.all([
    supabase
      .from("profiles")
      .select("position, level, play_frequency")
      .eq("id", userId)
      .single(),
    supabase.from("skill_ratings").select("skill, rating").eq("user_id", userId),
    supabase
      .from("analyses")
      .select(
        "skill, fix:result->priority_fix->>title, metric:result->changes->0->>target_metric",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = (ratings as { skill: Skill; rating: number }[] | null) ?? [];
  const lastRow = last as
    | { skill: Skill; fix: string | null; metric: string | null }
    | null;

  return {
    position: (profile?.position as string | null) ?? null,
    level: (profile?.level as string | undefined) ?? "beginner",
    playFrequency: (profile?.play_frequency as string | null) ?? null,
    // Deduplicated to one rating per skill: a player who trains both indoor and
    // grass has a row per discipline, and sending both would read to the model
    // as two different numbers for the same ability.
    ratings: SKILLS.map((skill) => {
      const forSkill = rows.filter((r) => r.skill === skill);
      if (forSkill.length === 0) return null;
      const mean =
        forSkill.reduce((sum, r) => sum + r.rating, 0) / forSkill.length;
      return { skill, rating: mean };
    }).filter((r): r is { skill: Skill; rating: number } => r !== null),
    lastFix:
      lastRow?.fix != null
        ? { skill: lastRow.skill, title: lastRow.fix, metricKey: lastRow.metric }
        : null,
    allowedSlugs: DRILLS.map((d) => d.slug),
  };
}
