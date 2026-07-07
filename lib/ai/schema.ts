import { z } from "zod";
import type { Skill } from "@/lib/skills";
import { METRICS } from "@/lib/ai/metrics";
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

  return z.object({
    overall_score: z.number().int().min(0).max(100),
    metrics: z.object(metricShape),
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
    priority_fix: z.object({
      title: z.string(),
      detail: z.string(),
      frame_index: z.number().int(),
    }),
    drill_slugs: z.array(slugSchema).min(1).max(3),
    summary: z.string(),
  });
}

export type RawAnalysis = z.infer<ReturnType<typeof analysisSchema>>;
