import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { coach, COACH_MODEL } from "@/lib/ai/client";
import { coachSystemPrompt, type CoachContext } from "@/lib/ai/coach-prompt";
import { DRILLS, drillsForSkill } from "@/content/drills";
import { techniqueFor } from "@/content/technique";
import { METRICS, metricLabel } from "@/lib/ai/metrics";
import { SKILL_LABEL, type Level, type Skill } from "@/lib/skills";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ message: z.string().min(1).max(2000) });

type RatingRow = { skill: Skill; rating: number; analyses_count: number };
type AnalysisRow = {
  skill: Skill;
  overall_score: number;
  result: { priority_fix?: { title?: string; detail?: string } } | null;
  created_at: string;
};
type GoalRow = {
  skill: Skill;
  title: string;
  target_rating: number | null;
  deadline: string | null;
};
type HistoryRow = { role: "user" | "assistant"; content: string };

function mockReply(ratings: RatingRow[], level: Level): string {
  if (ratings.length === 0) {
    return "I don't have any film on you yet, so let's fix that first. Head to Analyze and record a rep of the skill you use most in games. Once I've scored it, I can point you at the exact fix that will move your game fastest. Come back after and we'll build a plan around it.";
  }
  const lowest = [...ratings].sort((a, b) => a.rating - b.rating)[0];
  const label = SKILL_LABEL[lowest.skill].toLowerCase();
  const drills = drillsForSkill(lowest.skill);
  const drill = drills.find((d) => d.level === level) ?? drills[0];
  return `Right now your ${label} is the weakest link at ${Math.round(lowest.rating)}, so that's where we start. Short, focused reps beat long unfocused sessions every time. Run ${drill.name} this week, then log another analysis so I can measure the change. If the score moves even a few points, we know the work is landing.`;
}

function* textChunks(text: string, size = 12) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { message } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= 60) {
    return NextResponse.json(
      { error: "You've hit the hourly message limit. Try again soon." },
      { status: 429 },
    );
  }

  const { error: sendError } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, role: "user", content: message });
  if (sendError) {
    return NextResponse.json({ error: "Couldn't send your message." }, { status: 500 });
  }

  const [
    { data: profile },
    { data: ratingsData },
    { data: analysesData },
    { data: goalsData },
    { data: historyData },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, level").eq("id", user.id).single(),
    supabase
      .from("skill_ratings")
      .select("skill, rating, analyses_count")
      .eq("user_id", user.id)
      // Coach context uses indoor ratings for now; per-discipline context is a follow-up.
      .eq("discipline", "indoor"),
    supabase
      .from("analyses")
      .select("skill, overall_score, result, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("goals")
      .select("skill, title, target_rating, deadline")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const level = (profile?.level as Level) ?? "beginner";
  const ratings = (ratingsData as RatingRow[] | null) ?? [];

  // Enrich with "what good looks like" for the player's weakest 1-2 skills.
  const techniqueNotes = [...ratings]
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 2)
    .map((r) => {
      const v = techniqueFor(r.skill, "indoor");
      return {
        skill: r.skill,
        overview: v.overview,
        highest_leverage: `${metricLabel(r.skill, v.highest_leverage_metric)}: ${v.highest_leverage_note}`,
        elite_markers: METRICS[r.skill].map((m) => ({
          metric: m.label,
          marker: v.metrics[m.key].elite_marker,
        })),
      };
    });

  const context: CoachContext = {
    player: { display_name: profile?.display_name ?? null, level },
    skill_ratings: ratings,
    recent_analyses: ((analysesData as AnalysisRow[] | null) ?? []).map((a) => ({
      skill: a.skill,
      overall_score: a.overall_score,
      priority_fix: a.result?.priority_fix?.title
        ? {
            title: a.result.priority_fix.title,
            detail: a.result.priority_fix.detail ?? "",
          }
        : null,
      date: a.created_at.slice(0, 10),
    })),
    active_goals: (goalsData as GoalRow[] | null) ?? [],
    drill_catalog: DRILLS.map((d) => ({
      name: d.name,
      slug: d.slug,
      skill: d.skill,
      level: d.level,
    })),
    ...(techniqueNotes.length > 0 ? { technique_notes: techniqueNotes } : {}),
  };

  const history = (((historyData as HistoryRow[] | null) ?? [])).slice().reverse();
  // The Messages API requires the first turn to be from the user, and this
  // model rejects a trailing assistant turn — so trim and re-anchor here.
  while (history.length > 0 && history[0].role !== "user") history.shift();
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || last.content !== message) {
    history.push({ role: "user", content: message });
  }
  const chatMessages = history.map((m) => ({ role: m.role, content: m.content }));

  const system = coachSystemPrompt(context);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        if (process.env.AI_MOCK === "true") {
          for (const part of textChunks(mockReply(ratings, level))) {
            reply += part;
            controller.enqueue(encoder.encode(part));
            await new Promise((r) => setTimeout(r, 40));
          }
        } else {
          const events = coach().messages.stream(
            {
              model: COACH_MODEL,
              max_tokens: 1024,
              system,
              messages: chatMessages,
            },
            // Exponential backoff on 429/5xx from the coaching service (CS-7);
            // the SDK honors Retry-After and jitters between attempts.
            { maxRetries: 4 },
          );
          for await (const event of events) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              reply += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        }
      } catch {
      } finally {
        if (reply.length > 0) {
          await supabase
            .from("chat_messages")
            .insert({ user_id: user.id, role: "assistant", content: reply });
        }
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
