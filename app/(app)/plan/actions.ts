"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { CHAT_MODEL } from "@/lib/ai/client";
import { completeObject, hasChatKey } from "@/lib/ai/chat";
import { todayKey } from "@/lib/progression";
import {
  PLAN_DAYS,
  planHeadline,
  planPrompt,
  weekStartKey,
  type PlanSeed,
} from "@/lib/weekly-plan";
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

  // Fail closed on a missing credential BEFORE the claim below, not after. A
  // deployment without the key would otherwise take the week, fail inside the
  // call, and hand it back through the catch, which works but only because
  // nothing between here and there can crash the process. Checking first means
  // the claim is never taken for a call that could not have been made, and the
  // player gets the same "try again" they would get from an outage.
  //
  // This is a precondition of the deploy, not a runtime condition: serverless
  // environment is snapshotted at build time, so a function built while
  // OPENROUTER_API_KEY is absent does not pick it up when it appears later.
  if (!hasChatKey()) {
    console.error("[plan] provider credential missing");
    return { ok: false, error: "Couldn't build the plan just now. Try again." };
  }

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
    const { parsed, usage } = await completeObject({
      model: CHAT_MODEL,
      system:
        "You are a volleyball development coach writing a training week for one player. They train mostly without a coach watching, and the audience starts at 13, so keep the loading conservative and the form cues explicit. Be specific and practical. Never invent facts about the player that the brief does not state.",
      messages: [{ role: "user", content: planPrompt(seed) }],
      schema: planSchema,
      schemaName: "weekly_plan",
      // NOT sized to the reply, and that is the whole point. The gateway routes
      // one model id across several upstreams that do not behave alike, and the
      // ones that reason bill that reasoning against this ceiling BEFORE any
      // content (D-096), so a budget fitted to the answer returns an empty
      // string on exactly the upstreams that think hardest.
      //
      // Measured on THIS prompt, 2026-08-06, 21 draws: six different upstreams
      // answered. Four of them reported zero reasoning tokens and produced
      // ~1,000 tokens of plan; the rest reasoned first, spending 1,147, 2,205
      // and 2,309 tokens before any content, for totals up to 3,156. So the
      // reasoning half of the bill is roughly twice the plan itself on a draw
      // that thinks, and which draw arrives is not this code's choice.
      //
      // The chat path settled on 6,000 and the analyze path on 8,192. This
      // takes the higher one. Both cover every draw seen here, and the margin is
      // free: the ceiling is only ever billed to the extent it is used, and a
      // full draw at this one still prices at a fraction of a cent. Length stays
      // the prompt's job, which is where that control belongs.
      maxTokens: 8192,
      // Sized from the same 21 draws, and NOT from the time to the first byte.
      // On a non-streaming request this gateway answers 200 within a second and
      // then pads the body with whitespace until the upstream finishes, so the
      // ceiling has to cover the whole upstream turn. Healthy draws completed in
      // 20 to 38 seconds. Three did not complete at all: two were still padding
      // at 60 seconds and one at 170, which says the stuck case does not recover
      // if given longer, and a retry is what clears it rather than patience.
      //
      // Hence a short ceiling and two retries instead of one long wait. 50s
      // matches the analyze route's read timeout for the same reason it was
      // chosen there: leave room inside the budget for the attempt that
      // succeeds. Worst case is three attempts plus backoff, comfortably inside
      // the ten minute claim window (migration 038), so even a run the platform
      // kills outright leaves the week reclaimable rather than stranded.
      timeoutMs: 50_000,
      maxRetries: 2,
    });

    // A reply the schema refuses is not an outage, but there is nothing to
    // store either, so it takes the same path: release the week and let the
    // player retry. The provider and the reasoning spend go in the log because
    // without them an empty reply cannot be told apart from a refusal (D-096).
    if (!parsed) {
      throw new Error(
        `plan reply did not match the schema (provider ${usage.provider ?? "unreported"}, reasoning ${usage.reasoning_tokens}, output ${usage.output_tokens})`,
      );
    }

    // A slug the catalog does not know renders as a dead card forever, so an
    // invented one is dropped rather than stored. The day survives; it just
    // loses its drill link.
    const plan = {
      ...parsed,
      // The one model-authored string the page renders as a heading. Cleaned
      // rather than rejected: a long dash or an over-long title is not worth
      // costing the player their week over (lib/weekly-plan.ts).
      headline: planHeadline(parsed.headline),
      days: parsed.days.map((d) => ({
        ...d,
        drill_slug: d.drill_slug && drillBySlug(d.drill_slug) ? d.drill_slug : null,
      })),
    };

    const { error: saveError } = await supabase.rpc("save_weekly_plan", {
      p_week_start: weekStart,
      p_plan: plan,
      p_model: CHAT_MODEL,
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
