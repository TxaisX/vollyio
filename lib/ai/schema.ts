import { z } from "zod";
import type { Skill } from "@/lib/skills";
import { METRICS, metricKeys } from "@/lib/ai/metrics";
import { drillSlugs } from "@/content/drills";

export function analysisSchema(skill: Skill) {
  const metricShape: Record<string, z.ZodTypeAny> = {};
  for (const { key } of METRICS[skill]) {
    metricShape[key] = z.object({
      score: z.number().int().min(0).max(100),
      note: z.string(),
    });
  }

  const slugs = drillSlugs(skill);
  const slugSchema =
    slugs.length > 0 ? z.enum(slugs as [string, ...string[]]) : z.string();

  const keys = metricKeys(skill);
  const metricKeySchema = z.enum(keys as [string, ...string[]]);

  return z.object({
    overall_score: z.number().int().min(0).max(100),
    // One sentence a human coach would open with: visible setting, rep count,
    // apparent context. Optional so older stored results stay valid.
    scene_read: z.string().optional(),
    // Per-rep mini-scores when more than one repetition is distinguishable.
    rep_scores: z
      .array(
        z.object({
          rep_index: z.number().int().min(0),
          overall: z.number().int().min(0).max(100),
          note: z.string(),
        }),
      )
      .max(8)
      .optional(),
    metrics: z.object(metricShape),
    ball_track: z
      .array(
        z.object({
          frame_index: z.number().int(),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          visible: z.boolean(),
        }),
      )
      .min(2),
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
      .min(3)
      .max(6),
    changes: z
      .array(
        z.object({
          title: z.string(),
          detail: z.string(),
          target_metric: metricKeySchema,
          expected_gain: z.number().int().min(1).max(40),
          difficulty: z.enum(["quick", "moderate", "long-term"]),
          timeframe: z.string(),
        }),
      )
      .min(1)
      .max(3),
    drill_slugs: z.array(slugSchema).min(1).max(3),
    summary: z.string(),
  });
}

export type RawAnalysis = z.infer<ReturnType<typeof analysisSchema>>;
