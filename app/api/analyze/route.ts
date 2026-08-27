import { NextResponse, type NextRequest } from "next/server";
import { VISION_MODEL } from "@/lib/ai/client";
import { readVideo, VisionError } from "@/lib/ai/vision";
import { alertOwnerOnLowCredit } from "@/lib/credit-alert";
import { classifyCoachingError } from "@/lib/ai/errors";
import { shouldEnforceFreeTier } from "@/lib/billing";
import {
  focusInstruction,
  focusLabelInstruction,
  notRatableMessage,
  repGate,
  simpleRatingSchema,
  simpleRubric,
  type RubricCheckpoint,
} from "@/lib/ai/simple-rubric";
import { mockResult } from "@/lib/ai/mock";
import { METRICS } from "@/lib/ai/metrics";
import { drillSlugs } from "@/content/drills";
import { metricKnowledge } from "@/content/technique";
import { updateRating } from "@/lib/ratings";
import { awardXp } from "@/lib/progression";
import {
  releaseAnalysisEntitlement,
  reserveAnalysisEntitlement,
  type AllowanceDetail,
} from "@/lib/entitlements";
import {
  MONTHLY_ALLOWANCE,
  DAILY_ALLOWANCE,
  PLAN_LABEL,
  isPlan,
  type Plan,
  type AllowancePeriod,
} from "@/lib/plans";
import { SKILL_LABEL, type Discipline, type Skill } from "@/lib/skills";
import {
  MAX_BODY_BYTES,
  MAX_CLIP_BYTES,
  RESULT_VERSION_VIDEO,
  type AnalysisCheckpoint,
  type AnalysisResult,
} from "@/lib/analysis-types";
import { analyzeRequestSchema } from "@/lib/analyze-request";
import { readJsonRequest } from "@/lib/security/request";
import { authenticateMutation } from "@/lib/security/api-auth";
import { consumeApiQuota, refundApiQuota } from "@/lib/security/rate-limit";
import { blankClipByBytes } from "@/lib/frame-guard";
import { formatRefusal, recordAnalysisTelemetry } from "@/lib/analysis-telemetry";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 120;

// The container the provider dispatches on, from the extension the request
// declared. Both were validated by the request schema against the same closed
// set, so this is a translation and never a decision.
const JSON_ONLY =
  "Reply with ONLY the JSON object for the analysis schema: no prose before or after it, no headings, no markdown fences.";

const CLIP_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

// The named checkpoints of a skill, composed for the prompt (D-099). The key
// and the label come from the metric catalog and the plain-language "what this
// is" from the authored knowledge core, so the model is told what each
// checkpoint means in the same words the player will read next to its
// observation. It is passed as an argument because lib/ai/simple-rubric.ts
// imports nothing behind the `@/` alias, which is what keeps it loadable by the
// test runner.
function checkpointCatalog(skill: Skill, discipline: Discipline): RubricCheckpoint[] {
  return METRICS[skill].map((m) => ({
    key: m.key,
    label: m.label,
    what: metricKnowledge(skill, discipline, m.key)?.what ?? m.label,
  }));
}

// One or two sentences is what the prompt asks for; this is the ceiling that
// holds when it does not. Long enough that a real observation is never cut.
const MAX_OBSERVATION_CHARS = 400;

/**
 * The reply's checkpoints, projected onto the catalog.
 *
 * Projected rather than copied, which is what enforces all three rules at once:
 * a key the model invented is not in the catalog so it never appears, the order
 * is the catalog's rather than the reply's, and a checkpoint the model skipped
 * entirely comes back `visible: false` so the section always renders the whole
 * set of five for the skill. Same posture as the drill slugs above.
 *
 * `visible` is ANDed with having actually said something. "I saw it" with no
 * observation is not an observation, and rendering an empty visible checkpoint
 * would show the player a heading with nothing under it.
 */
function checkpointsFrom(
  catalog: readonly RubricCheckpoint[],
  reply: readonly { key: string; visible: boolean; observation: string }[] | undefined,
): AnalysisCheckpoint[] {
  const byKey = new Map<string, string>();
  for (const entry of reply ?? []) {
    // First one wins: a repeated key is a wording miss, not a second reading.
    if (byKey.has(entry.key)) continue;
    const flat = entry.observation.replace(/\s+/g, " ").trim();
    let observation = flat.slice(0, MAX_OBSERVATION_CHARS);
    if (observation.length < flat.length) {
      const lastSpace = observation.lastIndexOf(" ");
      if (lastSpace > MAX_OBSERVATION_CHARS / 2) observation = observation.slice(0, lastSpace);
    }
    byKey.set(entry.key, entry.visible === true ? observation.trim() : "");
  }
  return catalog.map((c) => {
    const observation = byKey.get(c.key) ?? "";
    return { key: c.key, visible: observation.length > 0, observation };
  });
}

// Per attempt, and the whole route is bounded by `maxDuration = 120`. The video
// read is a much smaller request than the frame read it replaces (about ten
// low-resolution samples against 64 frames at 1024px), so it does not need the
// 90s the frame path did, and leaving it at 90 would put a single retry outside
// the platform budget. A function the platform kills skips the refund below and
// the entitlement release in the outer finally, silently costing the player an
// hourly slot: that is what these two numbers exist to prevent.
const READ_TIMEOUT_MS = 45_000;
// Only re-read when there is room for the attempt to finish inside the budget.
const RETRY_DEADLINE_MS = 55_000;
// ONE attempt inside the re-read, and this is the number the deadline above was
// always assuming. `readVideo`'s `maxRetries` counts RETRIES, not attempts, so
// `maxRetries: 1` runs the request twice: the first read can therefore take
// 50 + backoff + 50 = ~100s, not the ~50s "there is room for one more attempt"
// was reasoning about. A first read that failed fast, then aborted on its
// internal retry, lands at ~54s, passes the deadline check by a second, and
// starts a second two-attempt read that cannot finish before 154s. The platform
// kills at 120, and a killed function skips BOTH the refund below and the
// entitlement release in the outer finally, which is exactly the cost these
// constants exist to prevent.
//
// AND THE BACKOFF COUNTS TOO, which the first repair here missed. `backoffMs`
// in lib/ai/vision.ts honours an upstream `Retry-After` up to 20 seconds, so
// the FIRST read, which keeps its one internal retry, is not 2 x 50 = 100s but
// 50 + 20 + 50 = 120s: exactly the whole function budget, before the clip
// download, the base64 encode, the two quota RPCs and every write after the
// read. That is the same platform kill this block exists to prevent, still open
// on the more common lane.
//
// 45 rather than 50 is what closes it. First read worst case 45 + 20 + 45 =
// 110s; re-read path 55 (the deadline) + 45 = 100s. Both inside 120 with room
// for the writes. The video read is a much smaller request than the frame read
// that used 90s, so this is a trim rather than a squeeze.
//
// lib/ai-budget-contract.test.ts pins all of it, backoff included, so the next
// person to tune a timeout finds out here rather than in production.
const RETRY_AFTER_CEILING_MS = 20_000;
const REREAD_MAX_RETRIES = 0;

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
// D-110: the wall that was hit decides the noun, and nothing else about this
// message changes. "today" and "this month" are the only two words that differ,
// so they are derived here rather than duplicated into a second builder that
// would be free to drift from this one.
function exhaustedMessage(
  plan: Plan,
  detail: AllowanceDetail | null,
  period: AllowancePeriod,
): string {
  const reset = resetDateLabel(detail?.resetsAt);
  const noun = period === "day" ? "today" : "this month";
  const pluralTail = period === "day" ? "for today" : "this month";
  const rate = period === "day" ? "a day" : "a month";
  const used = detail
    ? detail.allowance === 1
      ? `You've used your ${PLAN_LABEL[plan]} analysis for ${noun}.`
      : `You've used all ${detail.allowance} of your ${PLAN_LABEL[plan]} analyses ${pluralTail}.`
    : `You've used your analyses for ${noun}.`;
  const next =
    period === "day" ? DAILY_ALLOWANCE[plan] : MONTHLY_ALLOWANCE[plan];
  if (plan === "pro") {
    if (!reset) return used;
    return `${used} Your next ${next} unlock on ${reset}.`;
  }
  const proRate =
    period === "day" ? DAILY_ALLOWANCE.pro : MONTHLY_ALLOWANCE.pro;
  const upgrade = `Upgrade to ${PLAN_LABEL.pro} for ${proRate} analyses ${rate}`;
  const later = next === 1 ? "or your next one unlocks" : "or they reset";
  return reset
    ? `${used} ${upgrade}, ${later} on ${reset}.`
    : `${used} ${upgrade}.`;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateMutation(req);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  // The self-imposed monthly spend cap that used to sit here is GONE (D-104).
  // It answered the wrong question: once tripped it degraded the product to a
  // 503 for every player at once, including the paying ones, while doing
  // nothing whatsoever to the thing actually spending the money. Cost is
  // controlled at the source rather than by refusing analyses. Do not
  // reintroduce a global cap here without reading D-104 first: a per-user
  // allowance already exists, and a platform-wide ceiling turns one abuser into
  // everybody's outage.
  //
  // "The source" used to mean refusing automated ACCOUNTS, and D-118 changed
  // what that sentence covers: an analysis can now happen without an account at
  // all. The captcha therefore rides on the anonymous sign-in itself, which is
  // an auth endpoint and so is verified by Supabase against the secret it
  // already holds (`lib/captcha.ts`), and the one-run cap for that session is
  // enforced in SQL by `reserve_analysis_entitlement` (migration 061) where no
  // caller can route around it.

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
  const { skill, discipline, source, duration_s, focus_point, focus_label } =
    parsedBody.data;

  // The clip the read is performed on. It is already in storage under the
  // caller's own pending prefix, because the platform's 4.5 MB request cap
  // cannot carry it (D-097, migration 054). The path is composed here from the
  // VERIFIED user id and a request value the schema proved is a UUID, so
  // nothing the caller sends can name a segment outside their own folder.
  //
  // Read with the player's own client, not the service role. The pending select
  // policy is owner-scoped, which means the tenant boundary is still the
  // database's rather than this route remembering to compare two ids. That is
  // also why /api/analyze does not become a third service-role importer here
  // (docs/security.md rule 10).
  const pendingPath = `${user.id}/pending/${parsedBody.data.pending_clip_id}/clip.${parsedBody.data.clip_ext}`;
  const clipPathFinalExt = parsedBody.data.clip_ext;
  const { data: clipBlob, error: clipError } = await supabase.storage
    .from("clips")
    .download(pendingPath);
  if (clipError || !clipBlob) {
    console.error("[analyze] pending clip unreadable", { message: clipError?.message });
    return NextResponse.json(
      {
        error:
          "Your clip didn't finish uploading, so there was nothing to analyze and nothing was counted. Try again.",
      },
      { status: 422 },
    );
  }

  // Both bounds run before the hourly slot and the entitlement, so a clip that
  // cannot be read costs the player nothing. The upper bound repeats the
  // storage policy's ceiling because this is where the bytes become a base64
  // string in function memory; the lower one is the blank-media floor.
  const clipBytes = Buffer.from(await clipBlob.arrayBuffer());
  if (clipBytes.byteLength > MAX_CLIP_BYTES) {
    return NextResponse.json(
      {
        error: "That clip is too large to analyze. Trim it to a shorter window and try again.",
      },
      { status: 413 },
    );
  }
  if (blankClipByBytes(clipBytes.byteLength)) {
    return NextResponse.json(
      {
        error:
          "That clip arrived empty, so there was nothing to analyze and nothing was counted. Reload the page and try again, or re-export the clip as MP4.",
      },
      { status: 422 },
    );
  }

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
    // D-118. The anonymous player has spent their one read, and this is the
    // only refusal in the product that is not about a limit lifting later:
    // nothing resets, because nothing is on a clock. It names the account, and
    // it says the breakdown is kept rather than implying a fresh start, which
    // is true and is the entire reason the conversion is worth taking: signing
    // up attaches an email to the row that already owns the analysis.
    //
    // Deliberately NOT routed through `exhaustedMessage`. Every string that
    // builder produces is a sentence about a window, and bending it to describe
    // an account would leave both harder to read (D-110 made the wall decide the
    // noun; here there is no wall, there is a door).
    if (entitlement.reason === "anonymous_used") {
      return NextResponse.json(
        {
          error:
            "That was your free read, and it's saved. Create an account to keep it and get three analyses a day.",
          reason: "anonymous_used",
          resets_at: null,
        },
        { status: 402 },
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
    const period: AllowancePeriod =
      entitlement.reason === "day_exhausted" ? "day" : "month";
    const reason =
      period === "day"
        ? plan === "pro"
          ? "plan_day_exhausted"
          : "free_day_exhausted"
        : plan === "pro"
          ? "plan_month_exhausted"
          : "free_month_exhausted";
    return NextResponse.json(
      {
        error: exhaustedMessage(plan, detail, period),
        reason,
        resets_at: detail?.resetsAt ?? null,
      },
      { status: 402 },
    );
  }

  const reservationId = entitlement.reservationId;

  const performAnalysis = async () => {
    // No frame carries a time on this path, so nothing has an instant to
    // report. Kept as the one place that says so, rather than each caller
    // deciding what a missing timestamp means.
    const timeAt = () => null;

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
      // Who to analyze, by whichever route the player had available. The tap
      // wins when both arrive: it is the player pointing at a picture they were
      // looking at, where a label is the player agreeing with a description
      // somebody else wrote. Only one of the two is ever sent in practice,
      // because a device that can render the poster to tap never reaches the
      // list, but stating the precedence here means a client that sends both
      // cannot make the subject ambiguous.
      const marker = focus_point
        ? focusInstruction(focus_point.x, focus_point.y, focus_point.t_s)
        : focus_label
          ? focusLabelInstruction(focus_label)
          : null;
      const instructions = [
        ...(marker ? [marker] : []),
        `Discipline: ${discipline}. Rate this ${SKILL_LABEL[skill].toLowerCase()} rep across the whole clip.`,
        // Stated in words as well as in response_format, because the free
        // reader (D-131) answers the full rubric as a markdown essay when only
        // the schema asks for JSON, and an essay is a refunded 502.
        JSON_ONLY,
      ];

      const catalog = checkpointCatalog(skill, discipline);
      const startedAt = Date.now();
      const readOnce = (retries: number) =>
        readVideo({
          model: VISION_MODEL,
          system: [simpleRubric(skill, discipline, drillSlugs(skill), catalog), repGate()],
          video: {
            data: clipBytes.toString("base64"),
            mime: CLIP_MIME[clipPathFinalExt],
            duration_s,
          },
          instructions,
          schema: simpleRatingSchema,
          // Well above what this rubric's reply needs, because on this gateway
          // the ceiling is not an output budget: one model id resolves across
          // several upstreams and the ones that reason bill that reasoning
          // against max_tokens BEFORE any content (D-096). A ceiling sized to
          // the answer therefore returns an empty string on exactly the
          // upstreams that think hardest, which is not a failure mode worth
          // saving tokens for.
          maxTokens: 8192,
          timeoutMs: READ_TIMEOUT_MS,
          maxRetries: retries,
        });

      let read = await readOnce(1);
      // One re-read on a reply that arrived and did not parse. This is not
      // belt-and-braces: two full passes over the same 38 clips produced one
      // abstention and two hard failures, then neither, with individual scores
      // moving up to 14 points. Failure on this path is STOCHASTIC, so a parse
      // miss is more often a bad draw than a bad clip, and the alternative is
      // a player who filmed a rep and got nothing back. Guarded by the elapsed
      // clock so the retry can never be what the platform kills the function
      // in the middle of.
      if (!read.parsed && Date.now() - startedAt < RETRY_DEADLINE_MS) {
        console.warn("[analyze] unparseable read, retrying once", {
          provider: read.usage.provider,
          reasoning_tokens: read.usage.reasoning_tokens,
        });
        const retry = await readOnce(REREAD_MAX_RETRIES);
        read = {
          parsed: retry.parsed,
          // Both attempts were billed, so both are recorded. A telemetry row
          // that showed only the successful attempt would price this route
          // below what it actually costs.
          usage: {
            input_tokens: read.usage.input_tokens + retry.usage.input_tokens,
            output_tokens: read.usage.output_tokens + retry.usage.output_tokens,
            cache_read_input_tokens:
              read.usage.cache_read_input_tokens + retry.usage.cache_read_input_tokens,
            cache_creation_input_tokens:
              read.usage.cache_creation_input_tokens +
              retry.usage.cache_creation_input_tokens,
            provider: retry.usage.provider,
            reasoning_tokens: read.usage.reasoning_tokens + retry.usage.reasoning_tokens,
          },
          ms: retry.ms,
        };
      }

      telemetry = {
        input_tokens: read.usage.input_tokens,
        output_tokens: read.usage.output_tokens,
        cache_read_input_tokens: read.usage.cache_read_input_tokens,
        cache_creation_input_tokens: read.usage.cache_creation_input_tokens,
        duration_ms: Date.now() - startedAt,
        model: VISION_MODEL,
        // Which upstream answered, and what it spent thinking. Recorded because
        // one id is not one behaviour on this gateway (D-096): without these
        // two numbers an empty read cannot be told apart from a refusal, and
        // there is no evidence from which to choose a ceiling.
        provider: read.usage.provider,
        reasoning_tokens: read.usage.reasoning_tokens,
        result_version: RESULT_VERSION_VIDEO,
      };

      const raw = read.parsed;
      if (!raw) {
        // Refunded, for the same reason the abstain lane below refunds: this
        // route's own comment on the re-read says failure here is STOCHASTIC,
        // "a parse miss is more often a bad draw than a bad clip". Charging a
        // player an hourly slot for the model's bad draw, after two paid reads
        // they never see, is billing them for our variance. The monthly
        // allowance counts stored ROWS and no row is written, so the hourly
        // slot is the only thing to give back.
        await refundApiQuota(createServiceClient(), user.id, "analyze");
        return NextResponse.json(
          { error: "The coaching service couldn't read that clip. Try again." },
          { status: 502 },
        );
      }

      // The abstain lane, and the reason it is a refusal rather than a low
      // score. A clip that does not show the declared skill has no honest
      // number attached to it, and the alternative to saying so is expressing
      // "I cannot see it" as something in the fifties, which the player then
      // reads as coaching and acts on. Nothing is stored and the hourly slot is
      // given back, because no analysis happened.
      if (raw.ratable === false) {
        // Refusals leave no row, so without this line the live abstain rate is
        // unknowable: nothing is stored, the slot is refunded, and the only
        // trace is a 422 the player sees. The offline corpus review found the
        // lane never fires on footage that contains no rep at all
        // (evals/CALIBRATION.md), and that failure would stay invisible here.
        // No player identity: the question is how often and on what kind of
        // clip, never who filmed it.
        console.info(
          formatRefusal({
            skill,
            discipline,
            duration_s,
            clip_bytes: clipBytes.byteLength,
            model: VISION_MODEL,
            provider: read.usage.provider,
            reason: raw.not_ratable_reason ?? null,
            marked: Boolean(focus_point || focus_label),
          }),
        );
        await refundApiQuota(createServiceClient(), user.id, "analyze");
        return NextResponse.json(
          {
            error: notRatableMessage(raw.not_ratable_reason),
            reason: "not_ratable",
          },
          { status: 422 },
        );
      }

      const top = raw.improvements?.[0];
      if (
        !raw.improvements ||
        !top ||
        raw.overall_score == null ||
        !raw.strengths ||
        !raw.summary
      ) {
        // A reply that parsed but carried no improvement is the same class of
        // bad draw as one that did not parse at all, and gets the same refund.
        await refundApiQuota(createServiceClient(), user.id, "analyze");
        return NextResponse.json(
          { error: "The coaching service couldn't read that clip. Try again." },
          { status: 502 },
        );
      }
      result = {
        skill,
        // Clamped, not trusted. The scale is prompt-stated rather than schema
        // bound (lib/ai/simple-rubric.ts), so a reply outside 0..100 is a
        // wording miss and must degrade into a valid score rather than into a
        // rating curve and a history chart that can never be read again.
        overall_score: Math.max(0, Math.min(100, Math.round(raw.overall_score))),
        result_version: RESULT_VERSION_VIDEO,
        confidence: raw.confidence ?? "unstated",
        strengths: raw.strengths,
        // Shaped as `Change` so the numbered-changes section, the priority-fix
        // card and the drills list render unchanged. target_metric and
        // expected_gain are OMITTED rather than filled: both are per-checkpoint
        // quantities and this rubric has no checkpoints, so a value there would
        // be a number the player would act on that nothing measured.
        changes: raw.improvements,
        priority_fix: { title: top.title, detail: top.detail },
        // The model is guided to the valid slugs but not hard-bound to them;
        // drop any it invents so drill lookups can't 404.
        drill_slugs: (raw.drill_slugs ?? []).filter((s) => drillSlugs(skill).includes(s)),
        summary: raw.summary,
        // Observations, never scores (D-099). Nothing here reaches
        // overall_score above, and nothing here is a verdict: the label, the
        // weight and the teaching prose all render from the catalog, so the
        // only thing stored from the reply is what was seen of each checkpoint
        // in this rep, or nothing at all when the footage did not show it.
        checkpoints: checkpointsFrom(catalog, raw.checkpoints),
      };
    } catch (err) {
      // Log the real cause server-side only. The client message stays generic
      // and vendor-neutral (no-vendor-names rule); an opaque 502 with a bare
      // `catch` hid whatever the read actually threw.
      const apiErr = err instanceof VisionError ? err : null;
      const message = apiErr?.message ?? (err instanceof Error ? err.message : String(err));
      console.error("[analyze] vision call failed", {
        status: apiErr?.status,
        requestId: apiErr?.requestId,
        message,
      });
      const kind = classifyCoachingError({ status: apiErr?.status ?? null, message });
      if (kind === "capacity" || kind === "busy") {
        // The coaching service refused before doing any billable work: a
        // credit or spend-cap outage (capacity), or a 429/529 that survived
        // the retry (busy). The player was not charged either way, so give
        // the hourly slot back (the free entitlement is released by the outer
        // finally) and say so plainly, distinctly from "your clip failed".
        // Vendor stays unnamed. Service-role client, never the player's
        // (migration 033). A refund a player can trigger is a rate limit that
        // resets on demand. Both return 503, which the client renders as the
        // calm chalk state (D-054): the player did nothing wrong here, and
        // the coral error state used to blame them for a busy signal.
        await refundApiQuota(createServiceClient(), user.id, "analyze");
        const capacity = kind === "capacity";
        return NextResponse.json(
          {
            error: capacity
              ? "The coaching service is temporarily out of capacity, so your clip wasn't counted against your limit. Please try again later."
              : "The coaching service is busy right now, so your clip wasn't counted against your limit. Try again in a moment.",
          },
          { status: 503, headers: { "Retry-After": capacity ? "1800" : "60" } },
        );
      }
      return NextResponse.json(
        { error: "The coaching service is unavailable. Try again." },
        { status: 502 },
      );
    }
  }

  result.discipline = discipline;

  const analysisId = crypto.randomUUID();
  const clipPath = `${user.id}/${analysisId}/clip.${clipPathFinalExt}`;

  // A video row carries NO frames, which is what migration 054 relaxed the
  // insert trigger's 2-to-64 floor to allow. The read is performed on the clip
  // itself, so shipping stills alongside would be paying to upload and store
  // pixels no model looks at. `thumb_path` must be null to match an empty
  // frame_paths, which the trigger checks; nothing in the product reads it.
  const { error: insertError } = await supabase.from("analyses").insert({
    id: analysisId,
    user_id: user.id,
    skill,
    discipline,
    source,
    duration_s,
    frame_count: 0,
    frame_paths: [],
    thumb_path: null,
    clip_path: clipPath,
    keypoints_path: null,
    stored_frame_paths: [],
    overall_score: result.overall_score,
    result,
    model: process.env.AI_MOCK === "true" ? "mock" : VISION_MODEL,
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

  // Now that the row exists and declares the path, the analysis-anchored clip
  // policy from migration 012 admits the write, so the pending object can move
  // to where every reader already looks for it. Copy then remove rather than a
  // single move: the destination is governed by one policy and the source by
  // another, and a copy that lands followed by a remove that does not is a
  // stray file, where a move that half-applies is a row pointing at nothing.
  //
  // NOT fatal. The clip is the only media a video row has, so losing it costs
  // the player their film; it does not cost them the analysis, which is already
  // saved and is the thing they waited for. Discarding a scored row over a
  // storage hiccup would spend their allowance and give them nothing, so this
  // logs and continues, exactly as the frame path's clip upload always did.
  const { error: copyError } = await supabase.storage
    .from("clips")
    .copy(pendingPath, clipPath);
  if (copyError) {
    console.error("[analyze] clip copy to the analysis path failed", {
      analysisId,
      message: copyError.message,
    });
  }
  const { error: pendingRemoveError } = await supabase.storage
    .from("clips")
    .remove([pendingPath]);
  if (pendingRemoveError) {
    // The orphan sweep collects it on age. Worth a line either way: a prefix
    // that only ever grows is a storage bill nobody is watching.
    console.error("[analyze] pending clip cleanup failed", {
      analysisId,
      message: pendingRemoveError.message,
    });
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
  // SUPABASE_SERVICE_ROLE_KEY is set in production (docs/deploy.md), so this
  // records on every live analysis. In an environment without the key,
  // createServiceClient() returns null and telemetry stays null on the row: a
  // measurement gap, not a failure, and the analysis returns exactly the same.
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

  // The prepaid balance is the only wall that takes the product down for
  // EVERYONE at once, paying subscribers included, and no per-account quota can
  // see it coming. Checked here because a completed analysis is the moment the
  // balance moved, and this route is the thing that spends it.
  //
  // NOT awaited. The player's breakdown is done and must not wait on a billing
  // endpoint. The alert claims one slot per condition per six hours in process
  // memory, so a healthy balance costs one 3s-bounded request and no mail.
  void alertOwnerOnLowCredit();

  // The client no longer has media to upload after the response: the clip went
  // up before the request and this route has already put it where it belongs.
  // clipPath is returned so the caller can tell whether its own pending object
  // was consumed, and clean up if it was not.
  return NextResponse.json({
    analysisId,
    clipPath,
    xpAwarded,
  });
  };

  try {
    return await performAnalysis();
  } finally {
    await releaseAnalysisEntitlement(supabase, reservationId);
  }
}
