import { z } from "zod";
import type { Skill } from "@/lib/skills";
import { METRICS } from "@/lib/ai/metrics";
import { drillSlugs } from "@/content/drills";

// Value constraints (enums, min/max counts, numeric ranges) are intentionally
// kept OUT of this schema. The SDK's zodOutputFormat demotes them to schema
// description text rather than API-enforced keywords, so the model is guided by
// them but not bound — yet messages.parse() still validates the reply against
// this schema client-side. Encoding them here made a slightly-off reply (an
// out-of-list drill slug, a 7th insight) throw and surface as a coaching-service
// outage. So this schema enforces only structure and types; the prompt (RUBRIC +
// outputSpec) carries the value guidance, and the route sanitizes the one field
// that feeds a lookup (drill_slugs).
export function analysisSchema(skill: Skill) {
  const metricShape: Record<string, z.ZodTypeAny> = {};
  for (const { key } of METRICS[skill]) {
    metricShape[key] = z.object({
      score: z.number().int(),
      note: z.string(),
    });
  }

  const slugs = drillSlugs(skill);
  const drillGuidance =
    slugs.length > 0
      ? `Recommend 1 to 3 drills for this player, each given as a slug chosen ONLY from: ${slugs.join(", ")}.`
      : "Recommend 1 to 3 drills for this player, each given as a short slug.";

  return z.object({
    overall_score: z.number().int(),
    // One sentence a human coach would open with. Optional so older stored
    // results stay valid.
    scene_read: z.string().optional(),
    // Per-rep mini-scores when more than one repetition is distinguishable.
    rep_scores: z
      .array(
        z.object({
          rep_index: z.number().int(),
          overall: z.number().int(),
          note: z.string(),
        }),
      )
      .optional(),
    metrics: z.object(metricShape),
    ball_track: z.array(
      z.object({
        frame_index: z.number().int(),
        x: z.number(),
        y: z.number(),
        visible: z.boolean(),
      }),
    ),
    contact_frame_index: z.number().int(),
    focus: z.object({
      frame_index: z.number().int(),
      label: z.string(),
      why: z.string(),
    }),
    insights: z
      .array(
        z.object({
          frame_index: z.number().int(),
          type: z.enum(["strength", "issue"]),
          observation: z.string(),
        }),
      )
      .describe("Return 3 to 6 insights, mixing clear strengths and the biggest issues."),
    changes: z
      .array(
        z.object({
          title: z.string(),
          detail: z.string(),
          target_metric: z.string(),
          expected_gain: z.number().int(),
          difficulty: z.enum(["quick", "moderate", "long-term"]),
          timeframe: z.string(),
        }),
      )
      .min(1)
      .describe("Return 1 to 3 changes, ranked most-impactful first."),
    drill_slugs: z.array(z.string()).min(1).describe(drillGuidance),
    summary: z.string(),
  });
}

export type RawAnalysis = z.infer<ReturnType<typeof analysisSchema>>;
