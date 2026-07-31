import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { coach, ANALYZE_MODEL, ANALYZE_EFFORT } from "@/lib/ai/client";
import { classifyCoachingError } from "@/lib/ai/errors";
import { shouldEnforceFreeTier } from "@/lib/billing";
import { analysisSchema } from "@/lib/ai/schema";
import { getRubric } from "@/lib/ai/rubrics";
import { outputSpec } from "@/lib/ai/output-spec";
import { mockResult } from "@/lib/ai/mock";
import { drillSlugs } from "@/content/drills";
import { updateRating } from "@/lib/ratings";
import { deriveResult } from "@/lib/ai/derive";
import { awardXp } from "@/lib/progression";
import {
  releaseAnalysisEntitlement,
  reserveAnalysisEntitlement,
  type AllowanceDetail,
} from "@/lib/entitlements";
import { MONTHLY_ALLOWANCE, PLAN_LABEL, isPlan, type Plan } from "@/lib/plans";
import { SKILL_LABEL } from "@/lib/skills";
import { MAX_BODY_BYTES, type AnalysisResult } from "@/lib/analysis-types";
import { analyzeRequestSchema } from "@/lib/analyze-request";
import {
  hasTrustedMutationOrigin,
  readJsonRequest,
  safeClipExtension,
} from "@/lib/security/request";
import { consumeApiQuota, refundApiQuota } from "@/lib/security/rate-limit";
import { checkAnalyzeBudget } from "@/lib/ai/budget";
import { recordAnalysisTelemetry } from "@/lib/analysis-telemetry";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 120;

// Which plan the reservation just enforced against. An unrecognized plan
// string resolves to free exactly as `monthlyAllowance()` does: fail toward
// the smaller entitlement, and toward still offering the player a way out.
function planOf(detail: AllowanceDetail | null): Plan {
  return detail && isPlan(detail.plan) ? detail.plan : "free";
}

// The instant the allowance rolls over, as a date a player can read. Rendered
// in UTC because the window is the UTC calendar month (migration 026), so this
// names the real boundary day wherever the server happens to run.
function resetDateLabel(resetsAt: string | null | undefined): string | null {
  if (!resetsAt) return null;
  const at = new Date(resetsAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

// Why the player is out, and the one thing they can do about it. What was SPENT
// comes from the reservation reply, which is the number the database just
// enforced, so this message can never claim more was used than was. What
// ARRIVES next is the plan's recurring rate: a refusal only happens once the
// signup grant is empty (migration 040), so at this moment the two are the same
// question and `detail.allowance` would overpromise by the size of the grant.
// A reply without detail says less rather than inventing a count.
function exhaustedMessage(plan: Plan, detail: AllowanceDetail | null): string {
  const reset = resetDateLabel(detail?.resetsAt);
  const used = detail
    ? detail.allowance === 1
      ? `You've used your ${PLAN_LABEL[plan]} analysis for this month.`
      : `You've used all ${detail.allowance} of your ${PLAN_LABEL[plan]} analyses this month.`
    : "You've used your analyses for this month.";
  const next = MONTHLY_ALLOWANCE[plan];
  if (plan === "pro") {
    if (!reset) return used;
    return `${used} Your next ${next} unlock on ${reset}.`;
  }
  const upgrade = `Upgrade to ${PLAN_LABEL.pro} for ${MONTHLY_ALLOWANCE.pro} analyses a month`;
  const later = next === 1 ? "or your next one unlocks" : "or they reset";
  return reset
    ? `${used} ${upgrade}, ${later} on ${reset}.`
    : `${used} ${upgrade}.`;
}

export async function POST(req: NextRequest) {
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

  // Self-imposed monthly budget (D-054), checked before anything is consumed:
  // no body parsed, no hourly slot taken, no entitlement reserved. Tripped or
  // unknown spend returns the same capacity response as the provider-side
  // outage below, so the client's calm 503 path covers both, and "wasn't
  // counted" stays literally true with nothing to refund.
  const budget = await checkAnalyzeBudget(supabase);
  if (budget !== "ok") {
    return NextResponse.json(
      {
        error:
          "The coaching service is temporarily out of capacity, so your clip wasn't counted against your limit. Please try again later.",
      },
      { status: 503, headers: { "Retry-After": "1800" } },
    );
  }

  const json = await readJsonRequest(req, MAX_BODY_BYTES);
  if (!json.ok) {
    const status =
      json.error === "payload_too_large"
        ? 413
        : json.error === "unsupported_media_type"
          ? 415
          : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }
  const parsedBody = analyzeRequestSchema.safeParse(json.value);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { skill, discipline, source, duration_s, frames } = parsedBody.data;

  const quota = await consumeApiQuota(supabase, "analyze");
  if (!quota.ok) {
    return NextResponse.json(
      { error: "The coaching service is unavailable. Try again." },
      { status: 503 },
    );
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "You've hit the hourly analysis limit. Try again soon." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Not `BILLING_ENABLED` directly: enforcing the free cap without a payment
  // path would lock every player out permanently. See lib/billing.ts (D-029).
  const entitlement = await reserveAnalysisEntitlement(supabase, shouldEnforceFreeTier());
  if (!entitlement.ok) {
    return NextResponse.json(
      { error: "The coaching service is unavailable. Try again." },
      { status: 503 },
    );
  }
  if (!entitlement.allowed) {
    if (entitlement.reason === "in_progress") {
      return NextResponse.json(
        { error: "An analysis is already running." },
        { status: 409 },
      );
    }
    // Running out is a state, not a fault, so the 402 carries enough for the
    // client to route on without guessing: which wall was hit, and when it
    // lifts. The reason is what separates "there is something to buy" from
    // "wait for the first of the month" (docs/billing.md 4.5); `resets_at`
    // stays the raw instant so the client can render it in the player's own
    // timezone.
    const detail = entitlement.detail;
    const plan = planOf(detail);
    return NextResponse.json(
      {
        error: exhaustedMessage(plan, detail),
        reason: plan === "pro" ? "plan_month_exhausted" : "free_month_exhausted",
        resets_at: detail?.resetsAt ?? null,
      },
      { status: 402 },
    );
  }

  const reservationId = entitlement.reservationId;

  const performAnalysis = async () => {
    const timeAt = (index: number) =>
    frames.find((f) => f.index === index)?.time_s ?? null;

  let result: AnalysisResult;
  // Server-recorded, server-only measurement of the coaching call (D-043): real
  // token counts, wall-clock, model, and effort. Recorded so D-027's two open
  // risks (cost per analysis, maxDuration vs real latency) become measured
  // numbers after a handful of live runs. Null on mock runs.
  //
  // It is deliberately NOT part of the insert below any more. The player's own
  // credentials write the analysis row; this is written afterwards with the
  // service role (D-065, migration 029), because a column the player can write
  // is a column that can 503 the product for everyone.
  let telemetry: Record<string, unknown> | null = null;

  if (process.env.AI_MOCK === "true") {
    result = mockResult(skill, timeAt);
  } else {
    try {
      const content = frames.flatMap((f) => [
        {
          type: "text" as const,
          text: f.time_s != null ? `Frame ${f.index}, t=${f.time_s}s` : `Frame ${f.index}`,
        },
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.data },
        },
      ]);

      const markerAt = parsedBody.data.marker_frame_index;
      const focusBlock = parsedBody.data.focus_marker
        ? [
            {
              type: "text" as const,
              text:
                `The player marked exactly who to analyze: a hollow gold ring is drawn around the focus athlete${markerAt != null ? ` in frame ${markerAt}` : " in one frame"}. ` +
                "That ringed person is the subject in EVERY frame: follow the same individual across the whole sequence by kit, build, and court position. Every score, metric note, insight, and change refers to them alone. Ignore every other person, and ignore the ring itself when judging form (it is a marker, not part of the athlete or the scene).",
            },
          ]
        : [];

      const startedAt = Date.now();
      const response = await coach().messages.parse({
        model: ANALYZE_MODEL,
        max_tokens: 4096,
        // Stated, not inherited. Opus 4.8 ran with no reasoning at all when
        // `thinking` was absent (D-027); Opus 5 thinks by default (D-070). Naming
        // it keeps this call's reasoning independent of whichever default the
        // pinned model happens to carry.
        thinking: { type: "adaptive" },
        system: [
          {
            type: "text",
            text: getRubric(skill, discipline),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: outputSpec(skill),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              ...content,
              ...focusBlock,
              {
                type: "text",
                text: `Discipline: ${discipline}. Analyze this ${SKILL_LABEL[skill].toLowerCase()} rep sequence across the whole clip.`,
              },
            ],
          },
        ],
        output_config: {
          effort: ANALYZE_EFFORT,
          format: zodOutputFormat(analysisSchema(skill)),
        },
      },
      // Exponential backoff on 429/5xx from the coaching service (CS-7);
      // the SDK honors Retry-After and jitters between attempts.
      { maxRetries: 4 },
    );

      const usage = response.usage;
      telemetry = {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        duration_ms: Date.now() - startedAt,
        model: ANALYZE_MODEL,
        effort: ANALYZE_EFFORT,
      };

      const raw = response.parsed_output;
      if (!raw) {
        return NextResponse.json(
          { error: "The coaching service couldn't read that clip. Try again." },
          { status: 502 },
        );
      }

      const metricsMap = raw.metrics as Record<
        string,
        { note: string; pointers: { key: string; status: string }[] }
      >;
      // Weighted derivation (D-045): each checkpoint scores from its pointer
      // verdicts (D-039, uncurved per D-040); the overall is the weighted mean
      // over OBSERVED checkpoints, and coverage_pct records how much of the
      // rubric the clip supported. Only when nothing was observable does the
      // model's whole-clip read stand in.
      const derived = deriveResult(skill, metricsMap);
      const top = raw.changes[0];
      const overallScore = derived.overall ?? raw.overall_score;
      result = {
        skill,
        overall_score: overallScore,
        coverage_pct: derived.coveragePct,
        low_confidence: derived.lowConfidence,
        // Who the model says it analyzed, and whether that matches the athlete
        // the player marked. Optional: an older stored row has no such field,
        // and a reply that omits it must not fail the analysis (D-030).
        subject_check: raw.subject_check,
        rep_scores: raw.rep_scores,
        metrics: derived.metrics.map((m) => ({
          key: m.key,
          score: m.score,
          weight: m.weight,
          note: metricsMap[m.key]?.note ?? "",
          observed: m.observed,
          pointers: m.statuses,
        })),
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
        // The model is guided to the valid slugs but not hard-bound to them
        // (see lib/ai/schema.ts); drop any it invents so drill lookups can't 404.
        drill_slugs: raw.drill_slugs.filter((s) => drillSlugs(skill).includes(s)),
        summary: raw.summary,
      };
    } catch (err) {
      // Log the real cause server-side only. The client message stays generic
      // and vendor-neutral (no-vendor-names rule); an opaque 502 with a bare
      // `catch` hid whatever the coaching call actually threw.
      const apiErr = err instanceof Anthropic.APIError ? err : null;
      const message = apiErr?.message ?? (err instanceof Error ? err.message : String(err));
      console.error("[analyze] coaching call failed", {
        status: apiErr?.status,
        requestId: apiErr?.requestID,
        message,
      });
      const kind = classifyCoachingError({ status: apiErr?.status ?? null, message });
      if (kind === "capacity") {
        // The coaching service refused before doing any billable work (credit or
        // spend-cap outage), so the player was not charged: give the hourly slot
        // back (the free entitlement is released by the outer finally) and say so
        // plainly, distinctly from "your clip failed". Vendor stays unnamed.
        // Service-role client, never the player's (migration 033). A refund a
        // player can trigger is a rate limit that resets on demand.
        await refundApiQuota(createServiceClient(), user.id, "analyze");
        return NextResponse.json(
          {
            error:
              "The coaching service is temporarily out of capacity, so your clip wasn't counted against your limit. Please try again later.",
          },
          { status: 503, headers: { "Retry-After": "1800" } },
        );
      }
      const clientMessage =
        kind === "busy"
          ? "The coaching service is busy right now. Try again in a moment."
          : "The coaching service is unavailable. Try again.";
      return NextResponse.json({ error: clientMessage }, { status: 502 });
    }
  }

  result.discipline = discipline;
  // Clip time per sent frame, keyed by frame index, so viewers can place
  // per-frame data on the clip timeline (client data, not model output; the
  // response schema stays frozen).
  const frameTimes: (number | null)[] = [];
  for (const f of frames) frameTimes[f.index] = f.time_s;
  result.frame_times = Array.from(frameTimes, (t) => t ?? null);

  const analysisId = crypto.randomUUID();

  const wantsClip = source === "video" && parsedBody.data.has_clip === true;
  const clipPath = wantsClip
    ? `${user.id}/${analysisId}/clip.${safeClipExtension(parsedBody.data.clip_ext)}`
    : null;

  // Predetermine storage paths for the client's post-response uploads (same
  // non-fatal pattern as the clip): the extra stored frames beyond the send
  // set.
  const extraFrameCount = parsedBody.data.extra_frame_count ?? 0;
  const storedFramePaths = Array.from(
    { length: extraFrameCount },
    (_, i) => `${user.id}/${analysisId}/x${String(frames.length + i).padStart(2, "0")}.jpg`,
  );

  const framePaths = frames.map(
    (frame) =>
      `${user.id}/${analysisId}/f${String(frame.index).padStart(2, "0")}.jpg`,
  );

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
    keypoints_path: null,
    stored_frame_paths: storedFramePaths,
    overall_score: result.overall_score,
    result,
    model: process.env.AI_MOCK === "true" ? "mock" : ANALYZE_MODEL,
  });
  if (insertError) {
    if (insertError.message.includes("analysis rate limit exceeded")) {
      return NextResponse.json(
        { error: "You've hit the hourly analysis limit. Try again soon." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    return NextResponse.json({ error: "Couldn't save your analysis." }, { status: 500 });
  }

  const uploadedFramePaths: string[] = [];
  let frameUploadFailed = false;
  for (let i = 0; i < frames.length; i++) {
    const bytes = Buffer.from(frames[i].data, "base64");
    const { error } = await supabase.storage
      .from("frames")
      .upload(framePaths[i], bytes, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("[analyze] required frame upload failed", {
        analysisId,
        frameIndex: i,
      });
      frameUploadFailed = true;
      break;
    }
    uploadedFramePaths.push(framePaths[i]);
  }
  if (frameUploadFailed) {
    if (uploadedFramePaths.length > 0) {
      await supabase.storage.from("frames").remove(uploadedFramePaths);
    }
    await supabase.rpc("discard_new_analysis", {
      p_analysis_id: analysisId,
      p_reservation_id: reservationId,
    });
    return NextResponse.json(
      { error: "Couldn't save your analysis. Try again." },
      { status: 500 },
    );
  }

  // The cost measurement, written with credentials the player does not hold
  // (D-065, migration 029). The row above went in as the player because RLS and
  // the insert trigger both require that; this one call is the only part of the
  // request that does not run as them.
  //
  // Placed after the media is committed rather than straight after the insert,
  // because the discard path above deletes the row this would write to, and a
  // write racing that delete is work with nowhere to land.
  //
  // It cannot fail the analysis. The player has a scored rep either way, so
  // every failure inside is logged and swallowed, the outcome is read by nothing
  // below, and no branch here can change what this route returns. The call
  // carries its own timeout, and it is awaited rather than left running because
  // a serverless instance can be frozen the instant the response is written,
  // which drops a fire-and-forget write (the same reason lib/ai/budget.ts awaits
  // the owner alert). One regional round trip, against a request that just spent
  // tens of seconds inside the coaching call.
  //
  // SUPABASE_SERVICE_ROLE_KEY is not set in the production deployment as this
  // ships, so createServiceClient() returns null and telemetry stays null on
  // every row until the key is configured. That is a measurement gap, not a
  // failure: the analysis returns exactly as it does today.
  await recordAnalysisTelemetry(createServiceClient(), analysisId, telemetry);

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
      rating: updateRating(prev?.rating ?? null, result.overall_score, result.coverage_pct ?? 100),
      analyses_count: (prev?.analyses_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,skill,discipline" },
  );

  // The row was inserted above, which is what award_xp re-checks before paying
  // (D-071). Returns the amount, or 0 when this analysis already paid.
  const xpAwarded = await awardXp(supabase, `analysis:${analysisId}`);

  return NextResponse.json({
    analysisId,
    clipPath,
    storedFramePaths,
    xpAwarded,
  });
  };

  try {
    return await performAnalysis();
  } finally {
    await releaseAnalysisEntitlement(supabase, reservationId);
  }
}
