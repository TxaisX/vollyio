import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CHAT_MODEL } from "@/lib/ai/client";
import { streamChat, hasChatKey } from "@/lib/ai/chat";
import { coachSystemPrompt, type CoachContext } from "@/lib/ai/coach-prompt";
import { DRILLS, drillsForSkill } from "@/content/drills";
import { techniqueFor } from "@/content/technique";
import { REHAB } from "@/content/rehab";
import { REGION_LABEL, TRIAGE_LABEL, TRIAGE_NOTE } from "@/content/rehab-types";
import { METRICS, metricLabel } from "@/lib/ai/metrics";
import { SKILL_LABEL, type Level, type Skill } from "@/lib/skills";
import { consumeApiQuota } from "@/lib/security/rate-limit";
import { readJsonRequest } from "@/lib/security/request";
import { authenticateMutation } from "@/lib/security/api-auth";
import { COACH_ENABLED } from "@/lib/flags";
import { hasJourney, journeySummary, type JourneyRow } from "@/lib/journey";

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

// Only the two key arrays, projected server side. The whole `result` blob is
// large and thirty of them would be real bandwidth to compute a handful of
// strings from; the journey needs the checkpoint keys and nothing else.
type JourneyKeyRow = {
  id: string;
  skill: Skill;
  created_at: string;
  strengths: { key?: string }[] | null;
  changes: { key?: string }[] | null;
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
  const auth = await authenticateMutation(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  // Read and validate BEFORE spending the player's allowance. The two quotas
  // below are a player's own hourly and daily budget, so a typo in a client
  // build, or a retry that sent the wrong shape, used to cost them coaching
  // they never received. Nothing below this point is free and nothing above it
  // may charge them.
  //
  // The 16 KB cap still lands before any parse: readJsonRequest counts the
  // bytes off the stream as they arrive and cancels the read the moment they
  // exceed it, so moving this ahead of the quota does not widen what an
  // authenticated caller can make the server buffer.
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

  // Fail closed on a missing provider credential BEFORE any quota is spent.
  // Without this the deployment charges the player an hourly AND a daily unit,
  // then returns 200 with an empty body, because streamChat throws inside the
  // stream after the response head has gone out and the catch there is silent.
  // The player sees "the coach didn't answer" and paid for it, and this route
  // deliberately has no refund path. Same 503 the quota-storage failure uses,
  // so the client's existing calm state covers it.
  if (process.env.AI_MOCK !== "true" && !hasChatKey()) {
    return NextResponse.json(
      { error: "The coaching service is unavailable. Try again." },
      { status: 503 },
    );
  }

  // Quota first among the things that cost something: the session insert below
  // writes a row and everything after it can reach the coaching service, and an
  // atomic consume is the only thing that bounds either.
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
  // account burn a day of spend.
  //
  // The hourly unit is NOT refunded here any more. Migration 030 narrowed
  // `refund_api_quota` to the analyze scope and made it require an entitlement
  // reservation id, because granted to `authenticated` and callable through
  // PostgREST the old shape let a player reset their own window and walk
  // through the hourly cap. Coach has no reservation to present, so there is
  // nothing to prove the call came from this route. The cost of dropping it is
  // that a player who trips the daily ceiling also spends one hourly unit they
  // did not get an answer for; the cost of keeping it was a quota escape.
  const daily = await consumeApiQuota(supabase, "coach_daily");
  if (!daily.ok || !daily.allowed) {
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

  // Resolve the conversation: verify ownership of an existing session, or
  // start a new one titled from this first message.
  //
  // A new session row is written before the answer exists because its id ships
  // in a response header, and the header goes out ahead of the stream. A turn
  // that never gets an answer therefore leaves an EMPTY session rather than a
  // half-written one, and the client has already adopted the id, so the
  // player's retry lands in the same thread and fills it.
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

  // When the question was asked. The turn is not written yet: see the insert in
  // the stream's finally block for why both halves land together or not at all.
  const askedAt = new Date();

  const [
    { data: profile },
    { data: ratingsData },
    { data: analysesData },
    { data: goalsData },
    { data: journeyData },
    { data: disputedData },
    { data: historyData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, level, position, play_frequency, discipline")
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
    // The journey (D-101). Deliberately a WIDER, THINNER read than
    // recent_analyses above: thirty rows so a streak is visible, but only the
    // checkpoint keys, because that is all the derivation consumes.
    supabase
      .from("analyses")
      .select("id, skill, created_at, strengths:result->strengths, changes:result->changes")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    // Reads the player told us were wrong. Nothing has ever read this table
    // (D-101): it has been collected since migration 022 and ignored. A read
    // that looked at the wrong person is not evidence about this player, and a
    // trend built on a row they already disputed is worse than no trend.
    supabase
      .from("analysis_feedback")
      .select("analysis_id, was_right")
      .eq("user_id", user.id)
      .eq("was_right", false),
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

  // The player's OWN surface. This read "indoor" for everyone, so a player who
  // set themselves to grass and sand in the quiz was coached off indoor
  // technique, on a product whose outdoor half is the half being marketed.
  const surface = profile?.discipline === "grass" ? "grass" : "indoor";

  const techniqueNotes = weakestSkills.map((skill) => {
    const v = techniqueFor(skill, surface);
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

  /**
   * THE WHOLE CATALOG, REVERSING D-047's FILTER, because the premise it was
   * decided on no longer holds.
   *
   * D-047 cut the catalog to the player's weakest one or two skills as token
   * spend "the answer never used", and that was true of a coach whose job was
   * to talk about this player's own reps. It is not true of the coach this is
   * now: the corpus is what it answers FROM, and the filter keyed off
   * skill_ratings, which only exist for skills the player has already filmed.
   *
   * So a player with one attacking analysis asked for the best drill to work
   * on passing alone and was told there was no passing drill in the catalog.
   * There are seven. The model was reporting what it had been sent, which was
   * attacking drills and nothing else, and no prompt rule can talk a model out
   * of a gap in its own context. Observed on a device, 2026-08-20.
   *
   * All 37 entries are name, slug, skill and level: about 3.8KB, under a
   * thousand tokens, on a request that already carries the injury library and
   * the player's history. That is the correct price for a coach that can
   * answer about the five skills a player has not filmed yet.
   */
  const drillPool = DRILLS;

  // THE JOURNEY (D-101), derived here rather than asked of the model.
  //
  // The scoring read stays blind on purpose: told to confirm a checklist this
  // model confirmed 90 to 100% of it (D-094), so priming a read with "they
  // struggle with Release" produces a finding that looks exactly like evidence.
  // Continuity is therefore computed from what the reads INDEPENDENTLY said,
  // which is deterministic and cannot be talked into anything.
  const disputedIds = new Set(
    ((disputedData as { analysis_id: string }[] | null) ?? []).map((d) => d.analysis_id),
  );
  const journeyRows: JourneyRow[] = ((journeyData as JourneyKeyRow[] | null) ?? []).map((r) => ({
    skill: r.skill,
    created_at: r.created_at,
    // A key the catalog does not know is dropped by the analyze route before
    // storage, so anything here is real; the filter is for rows written before
    // keys existed, which carry none.
    strengthKeys: (r.strengths ?? []).map((x) => x?.key).filter((k): k is string => !!k),
    changeKeys: (r.changes ?? []).map((x) => x?.key).filter((k): k is string => !!k),
    disputed: disputedIds.has(r.id),
  }));

  // Only for the skills the prompt already carries technique and drills for.
  // A journey for a skill the answer will never mention is tokens spent on
  // nothing, and D-047 is the record of that mistake made with drills.
  // `skill` is re-attached from the narrow type rather than taken from the
  // summary: lib/journey.ts deliberately imports nothing, so it types skills as
  // plain strings, and that independence is what lets it be unit tested against
  // fixtures instead of a database. The narrowing belongs here, at the boundary.
  const journeys = weakestSkills
    .map((skill) => ({ ...journeySummary(journeyRows, skill), skill }))
    .filter(hasJourney);

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
    // Every entry, every request. See CoachContext.injury_library for why this
    // is not filtered the way the drills are.
    injury_library: REHAB.map((r) => ({
      name: r.name,
      slug: r.slug,
      also_called: r.also_called,
      region: REGION_LABEL[r.region],
      triage: TRIAGE_LABEL[r.triage],
      triage_note: TRIAGE_NOTE[r.triage],
      red_flags: r.red_flags,
    })),
    ...(techniqueNotes.length > 0 ? { technique_notes: techniqueNotes } : {}),
    ...(journeys.length > 0 ? { journey: journeys } : {}),
  };

  const history = (((historyData as HistoryRow[] | null) ?? [])).slice().reverse();
  // The Messages API requires the first turn to be from the user, and this
  // model rejects a trailing assistant turn, so trim and re-anchor here. The
  // question being asked is never in the stored history any more (it is written
  // with its answer, after the call), so the append below is the only thing
  // that puts it in front of the model; the guard stays because a repeat of the
  // stored last turn must not be sent twice.
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
          // Chat runs on the gateway (D-096), as everything does now (D-098).
          // It shares CHAT_MODEL with the weekly plan but not this call shape:
          // the plan asks for one schema-bound object through completeObject(),
          // where this streams prose and binds to no schema at all. `effort` is
          // gone entirely; it was a parameter only the old coaching service had.
          for await (const text of streamChat({
            model: CHAT_MODEL,
            system,
            messages: chatMessages,
            // NOT the answer length. D-047 set this to 512 because coaching
            // answers land in 2-4 paragraphs and anything longer was cost
            // rather than coaching, and on a non-reasoning model that was the
            // same thing as a length cap. It is not the same thing here.
            //
            // The gateway routes one model id across several upstreams and they
            // do not behave alike (measured 2026-08-05): DeepInfra returns 0
            // reasoning tokens, GMICloud returns up to ~4,000, and reasoning
            // bills against this ceiling BEFORE a single character of content.
            // A heavy-reasoning draw at 512 therefore spends the whole budget
            // thinking and streams nothing, which the client renders as "the
            // coach didn't answer" while both quota units are already spent.
            // Same failure shape vision.ts pinned its provider to avoid: the
            // request succeeds or fails by routing luck.
            //
            // So this is sized for the worst observed reasoning draw, not for
            // the answer. Length stays the prompt's job, and it does the job:
            // replies measured 900-1,900 characters at 512, 3,000 and 6,000
            // alike, all finishing on `stop` rather than the ceiling.
            maxTokens: 6000,
            // THE RETRY BUDGET IS A WINDOW, NOT A COUNT.
            //
            // This first passed `maxRetries: 3` and no `timeoutMs`, so
            // lib/ai/chat.ts applied its 60s default against this route's
            // `maxDuration = 60`: the abort could never beat the platform kill,
            // and the kill lands inside the ReadableStream and skips the
            // `finally` below, so the transcript was never written and the
            // player was charged both quota units for a turn that left no
            // trace. Coach has no refund path by design (docs/security.md).
            //
            // The first repair here set `maxRetries: 0`, on the reasoning that
            // the retries were dead code. That was HALF right and the wrong
            // half: retries are unreachable on the TIMEOUT path, but
            // lib/ai/chat.ts also retries 408, 429 and 5xx, and a gateway 429
            // comes back in milliseconds. Deleting the count deleted live
            // recovery from transient upstream failures on the one route that
            // cannot refund what it spent.
            //
            // So the count comes back and a WINDOW bounds it instead: a retry
            // may be launched only while under 5s has elapsed. A 429 at 200ms
            // retries; a 50s abort does not, because by then the window is long
            // closed. Worst case is 5 + 50 = 55s, inside 60, and the abort
            // still fires before the kill so the `finally` runs either way.
            timeoutMs: 50_000,
            retryWindowMs: 5_000,
            maxRetries: 3,
          })) {
            reply += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch {
      } finally {
        // The question and the answer are written together, after the answer
        // exists, as ONE insert. Writing the question up front left the
        // conversation holding a question with no answer every time the
        // coaching service failed, and nothing in the transcript told the
        // player the difference between that and a coach who ignored them. A
        // turn that produced no text now leaves the thread exactly as it was,
        // which is what the client already shows: it raises "The coach didn't
        // answer" on an empty stream and offers the same message again.
        //
        // The timestamps are set here rather than defaulted. Two rows written
        // by one statement share the same transaction now(), which would leave
        // the turn's order undefined for every read that sorts on created_at,
        // including the history this route feeds back to the model, where an
        // assistant turn arriving first is rejected outright.
        if (reply.length > 0) {
          const answeredAt = new Date(
            Math.max(Date.now(), askedAt.getTime() + 1),
          ).toISOString();
          await supabase.from("chat_messages").insert([
            {
              user_id: user.id,
              session_id: sessionId,
              role: "user",
              content: message,
              created_at: askedAt.toISOString(),
            },
            {
              user_id: user.id,
              session_id: sessionId,
              role: "assistant",
              content: reply,
              created_at: answeredAt,
            },
          ]);
          // Only a turn that stored something reorders the session list.
          await supabase
            .from("coach_sessions")
            .update({ updated_at: answeredAt })
            .eq("id", sessionId);
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
      // Lets a first message in a fresh chat adopt its new session id
      // before the stream finishes.
      "x-coach-session": sessionId,
    },
  });
}
