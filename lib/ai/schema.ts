import { z } from "zod";
import type { Skill } from "@/lib/skills";
import { METRICS } from "@/lib/ai/metrics";
import { drillSlugs } from "@/content/drills";

// Value constraints (enums, min/max counts, numeric ranges) are intentionally
// kept OUT of this schema. The SDK's zodOutputFormat demotes them to schema
// description text rather than API-enforced keywords, so the model is guided by
// them but not bound. Yet messages.parse() still validates the reply against this
// schema client-side, so encoding them here made a slightly-off reply (an
// out-of-list drill slug, a 7th insight) throw and surface as a coaching-service
// outage. This schema now enforces only structure and types; the prompt (RUBRIC +
// outputSpec) carries the value guidance, and the route sanitizes the one field
// that feeds a lookup (drill_slugs).
export function analysisSchema(skill: Skill) {
  const metricShape: Record<string, z.ZodTypeAny> = {};
  for (const { key } of METRICS[skill]) {
    metricShape[key] = z.object({
      score: z.number().int(),
      note: z.string(),
      // False when this checkpoint's mechanics are genuinely not visible in
      // the frames (occluded, cropped, cut away). An unobserved checkpoint is
      // excluded from the overall instead of dragging it with a default.
      observed: z.boolean(),
    });
  }

  const slugs = drillSlugs(skill);
  const drillGuidance =
    slugs.length > 0
      ? `Recommend 1 to 3 drills for this player, each given as a slug chosen ONLY from: ${slugs.join(", ")}.`
      : "Recommend 1 to 3 drills for this player, each given as a short slug.";

  return z.object({
    overall_score: z.number().int(),
    // Who the model actually analyzed, and whether that is the marked athlete.
    // Free-form strings, not enums: a mis-worded verdict must degrade to a
    // weaker signal, never throw and take the whole analysis down with it.
    // Optional so older stored results stay valid.
    subject_check: z
      .object({
        analyzed: z.string(),
        marker_match: z.string(),
      })
      .optional(),
    // One sentence a human coach would open with. Optional so older stored
    // results stay valid.
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
