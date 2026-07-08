import { NextResponse, type NextRequest } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { coach, MODEL } from "@/lib/ai/client";
import { analysisSchema } from "@/lib/ai/schema";
import { getRubric } from "@/lib/ai/rubrics";
import { outputSpec } from "@/lib/ai/output-spec";
import { mockResult } from "@/lib/ai/mock";
import { METRICS } from "@/lib/ai/metrics";
import { updateRating } from "@/lib/ratings";
import { awardXp, XP_AWARDS } from "@/lib/progression";
import { canAnalyze } from "@/lib/entitlements";
import { SKILLS, SKILL_LABEL, DISCIPLINES, type Level } from "@/lib/skills";
import { MAX_FRAMES, type AnalysisResult } from "@/lib/analysis-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  skill: z.enum(SKILLS),
  discipline: z.enum(DISCIPLINES).default("indoor"),
  source: z.enum(["video", "photos"]),
  duration_s: z.number().nullable(),
  has_clip: z.boolean().optional(),
  clip_ext: z.string().nullable().optional(),
  frames: z
    .array(
      z.object({
        index: z.number().int(),
        time_s: z.number().nullable(),
        data: z.string().min(1),
      }),
    )
    .min(2)
    .max(MAX_FRAMES),
});

function safeClipExt(ext: string | null | undefined): string {
  const e = (ext ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e.length >= 2 && e.length <= 4 ? e : "webm";
}

export async function POST(req: NextRequest) {
  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { skill, discipline, source, duration_s, frames } = parsedBody.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const gate = await canAnalyze(user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= 20) {
    return NextResponse.json(
      { error: "You've hit the hourly analysis limit. Try again soon." },
      { status: 429 },
    );
  }

  const timeAt = (index: number) =>
    frames.find((f) => f.index === index)?.time_s ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("level")
    .eq("id", user.id)
    .single();
  const level = (profile?.level ?? "beginner") as Level;

  let result: AnalysisResult;

  if (process.env.AI_MOCK === "true") {
    result = mockResult(skill, timeAt);
  } else {
    try {
      const content = frames.flatMap((f) => [
        {
          type: "text" as const,
          text: f.time_s != null ? `Frame ${f.index} — t=${f.time_s}s` : `Frame ${f.index}`,
        },
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.data },
        },
      ]);

      const response = await coach().messages.parse({
        model: MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: getRubric(skill, discipline),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: outputSpec(skill, level),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              ...content,
              {
                type: "text",
                text: `Discipline: ${discipline}. Player level: ${level}. Analyze this ${SKILL_LABEL[skill].toLowerCase()} rep sequence across the whole clip.`,
              },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(analysisSchema(skill)) },
      });

      const raw = response.parsed_output;
      if (!raw) {
        return NextResponse.json(
          { error: "The coaching service couldn't read that clip. Try again." },
          { status: 502 },
        );
      }

      const metricsMap = raw.metrics as Record<string, { score: number; note: string }>;
      const top = raw.changes[0];
      result = {
        skill,
        overall_score: raw.overall_score,
        metrics: METRICS[skill].map((m) => ({
          key: m.key,
          score: metricsMap[m.key].score,
          note: metricsMap[m.key].note,
        })),
        ball_track: raw.ball_track,
        contact_frame_index: raw.contact_frame_index,
        focus: { ...raw.focus, time_s: timeAt(raw.focus.frame_index) },
        insights: raw.insights.map((i) => ({ ...i, time_s: timeAt(i.frame_index) })),
        changes: raw.changes,
        priority_fix: {
          title: top.title,
          detail: top.detail,
          frame_index: raw.focus.frame_index,
          time_s: timeAt(raw.focus.frame_index),
        },
        drill_slugs: raw.drill_slugs,
        summary: raw.summary,
      };
    } catch {
      return NextResponse.json(
        { error: "The coaching service is unavailable. Try again." },
        { status: 502 },
      );
    }
  }

  result.discipline = discipline;

  const analysisId = crypto.randomUUID();

  const wantsClip = source === "video" && parsedBody.data.has_clip === true;
  const clipPath = wantsClip
    ? `${user.id}/${analysisId}/clip.${safeClipExt(parsedBody.data.clip_ext)}`
    : null;

  const framePaths: string[] = [];
  for (const f of frames) {
    const path = `${user.id}/${analysisId}/f${String(f.index).padStart(2, "0")}.jpg`;
    const bytes = Buffer.from(f.data, "base64");
    const { error } = await supabase.storage
      .from("frames")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (!error) framePaths.push(path);
  }

  const { error: insertError } = await supabase.from("analyses").insert({
    id: analysisId,
    user_id: user.id,
    skill,
    discipline,
    source,
    duration_s,
    frame_count: frames.length,
    frame_paths: framePaths,
    thumb_path: framePaths[0] ?? null,
    clip_path: clipPath,
    overall_score: result.overall_score,
    result,
    model: process.env.AI_MOCK === "true" ? "mock" : MODEL,
  });
  if (insertError) {
    return NextResponse.json({ error: "Couldn't save your analysis." }, { status: 500 });
  }

  const { data: prev } = await supabase
    .from("skill_ratings")
    .select("rating, analyses_count")
    .eq("user_id", user.id)
    .eq("skill", skill)
    .eq("discipline", discipline)
    .maybeSingle();

  await supabase.from("skill_ratings").upsert(
    {
      user_id: user.id,
      skill,
      discipline,
      rating: updateRating(prev?.rating ?? null, result.overall_score),
      analyses_count: (prev?.analyses_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,skill,discipline" },
  );

  const awarded = await awardXp(
    supabase,
    user.id,
    XP_AWARDS.analysis,
    `analysis:${analysisId}`,
  );

  return NextResponse.json({
    analysisId,
    clipPath,
    xpAwarded: awarded ? XP_AWARDS.analysis : 0,
  });
}
