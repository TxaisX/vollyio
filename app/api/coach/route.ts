import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { coach, COACH_MODEL, COACH_EFFORT } from "@/lib/ai/client";
import { coachSystemPrompt, type CoachContext } from "@/lib/ai/coach-prompt";
import { DRILLS, drillsForSkill } from "@/content/drills";
import { techniqueFor } from "@/content/technique";
import { METRICS, metricLabel } from "@/lib/ai/metrics";
import { SKILL_LABEL, type Level, type Skill } from "@/lib/skills";
import { consumeApiQuota, refundApiQuota } from "@/lib/security/rate-limit";
import { hasTrustedMutationOrigin, readJsonRequest } from "@/lib/security/request";
import { COACH_ENABLED } from "@/lib/flags";

export const runtime = "nodejs";
export const maxDuration = 60;

// 600 characters is a generous coaching question; the old 2000 mostly bought
// prompt-stuffing room on a metered endpoint (D-047).
const bodySchema = z.object({
  message: z.string().trim().min(1).max(600),
  session_id: z.string().uuid().optional(),
});

// Session titles come from the opening message, trimmed at a word boundary.
function titleFrom(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean;
  const cut = clean.slice(0, 48);
  const space = cut.lastIndexOf(" ");
  return (space > 24 ? cut.slice(0, space) : cut) + "…";
}

type RatingRow = { skill: Skill; discipline: string; rating: number; analyses_count: number };
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
  if (!COACH_ENABLED) {
    return NextResponse.json({ error: "Coach is unavailable right now." }, { status: 404 });
  }
  if (!hasTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const quota = await consumeApiQuota(supabase, "coach");
  if (!quota.ok) {
    return NextResponse.json(
      { error: "The coaching service is unavailable. Try again." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "You've hit the hourly message limit. Try again soon." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Second gate, rolling 24 hours (D-047): the hourly window alone lets one
  // account burn a day of spend. The hourly unit above is refunded so a
  // day-capped player's next-hour slot is not also consumed.
  const daily = await consumeApiQuota(supabase, "coach_daily");
  if (!daily.ok || !daily.allowed) {
    await refundApiQuota(supabase, "coach");
    if (!daily.ok) {
      return NextResponse.json(
        { error: "The coaching service is unavailable. Try again." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "You've hit the daily coaching limit. Come back tomorrow." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  const json = await readJsonRequest(req, 16_384);
  if (!json.ok) {
    const status =
      json.error === "payload_too_large"
        ? 413
        : json.error === "unsupported_media_type"
          ? 415
          : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }
  const parsed = bodySchema.safeParse(json.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { message, session_id } = parsed.data;

  // Resolve the conversation: verify ownership of an existing session, or
  // start a new one titled from this first message.
  let sessionId: string;
  if (session_id) {
    const { data: owned } = await supabase
      .from("coach_sessions")
      .select("id")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "That session doesn't exist." }, { status: 404 });
    }
    sessionId = owned.id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("coach_sessions")
      .insert({ user_id: user.id, title: titleFrom(message) })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: "Couldn't start a session." }, { status: 500 });
    }
    sessionId = created.id;
  }

  const { error: sendError } = await supabase
    .from("chat_messages")
    .insert({ user_id: user.id, session_id: sessionId, role: "user", content: message });
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
    supabase
      .from("profiles")
      .select("display_name, level, position, play_frequency")
      .eq("id", user.id)
      .single(),
    supabase
      .from("skill_ratings")
      .select("skill, discipline, rating, analyses_count")
      .eq("user_id", user.id),
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
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      // 10 turns of history: enough thread memory for a coaching exchange
      // without re-billing the whole conversation every message (D-047).
      .limit(10),
  ]);

  const level = (profile?.level as Level) ?? "beginner";
  const ratings = (ratingsData as RatingRow[] | null) ?? [];

  // The player's weakest 1-2 skills drive both the technique notes and the
  // drill catalog the prompt carries (D-047: 30 drills across all skills was
  // token spend the answer never used).
  const weakestSkills = [...ratings]
    .sort((a, b) => a.rating - b.rating)
    .filter((r, i, arr) => arr.findIndex((x) => x.skill === r.skill) === i)
    .slice(0, 2)
    .map((r) => r.skill);

  const techniqueNotes = weakestSkills.map((skill) => {
    const v = techniqueFor(skill, "indoor");
    return {
      skill,
      overview: v.overview,
      highest_leverage: `${metricLabel(skill, v.highest_leverage_metric)}: ${v.highest_leverage_note}`,
      elite_markers: METRICS[skill].map((m) => ({
        metric: m.label,
        marker: v.metrics[m.key].elite_marker,
      })),
    };
  });

  // A player with no rated skills yet keeps the full catalog so the coach can
  // still point somewhere concrete.
  const drillPool =
    weakestSkills.length > 0
      ? DRILLS.filter((d) => weakestSkills.includes(d.skill))
      : DRILLS;

  const context: CoachContext = {
    player: {
      display_name: profile?.display_name ?? null,
      position: profile?.position ?? null,
      play_frequency: profile?.play_frequency ?? null,
    },
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
    drill_catalog: drillPool.map((d) => ({
      name: d.name,
      slug: d.slug,
      skill: d.skill,
      level: d.level,
    })),
    ...(techniqueNotes.length > 0 ? { technique_notes: techniqueNotes } : {}),
  };

  const history = (((historyData as HistoryRow[] | null) ?? [])).slice().reverse();
  // The Messages API requires the first turn to be from the user, and this
  // model rejects a trailing assistant turn, so trim and re-anchor here.
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
              // Half the old budget: coaching answers land in 2-4 paragraphs;
              // anything longer was cost, not coaching (D-047).
              max_tokens: 512,
              // Sonnet 5 defaults to high effort, where it fabricated detail the
              // frames contradict. Medium was the last correct setting (D-027).
              output_config: { effort: COACH_EFFORT },
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
            .insert({
              user_id: user.id,
              session_id: sessionId,
              role: "assistant",
              content: reply,
            });
        }
        await supabase
          .from("coach_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
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
      // Lets a first message in a fresh chat adopt its new session id
      // before the stream finishes.
      "x-coach-session": sessionId,
    },
  });
}
