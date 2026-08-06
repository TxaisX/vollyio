import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { VISION_MODEL } from "@/lib/ai/client";
import { readFrames, VisionError, hasVisionKey } from "@/lib/ai/vision";
import { hasTrustedMutationOrigin, readJsonRequest } from "@/lib/security/request";
import { isJpegPayload } from "@/lib/security/request";
import { consumeApiQuota } from "@/lib/security/rate-limit";

// Player spotting for the framing card (D-036): the coach looks at ONE frame
// and names the people clearly playing in it, each with a torso-center point,
// so the user can pick their athlete from a list instead of tapping blind.
// The pick still becomes a plain coordinate; this endpoint only proposes
// candidates and can propose none.

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SPOT_FRAME_BYTES = 1_500_000;

const requestSchema = z.object({
  frame: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_SPOT_FRAME_BYTES / 3) * 4 + 4)
    .refine((data) => isJpegPayload(data, MAX_SPOT_FRAME_BYTES)),
});

const spotSchema = z.object({
  players: z
    .array(
      z.object({
        // Short physical description: kit color, position on court. No names.
        label: z.string().max(80),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      }),
    )
    .max(6),
});

// Per attempt, and the route as a whole is bounded by `maxDuration = 30`. One
// attempt plus the single retry plus a backoff has to finish inside that, or the
// platform kills the function mid-call and the player pays the quota unit this
// route already consumed for nothing. Measured against the live gateway at the
// ceiling below, fourteen of fifteen spot reads on a real frame returned in 3.4
// to 6.5 seconds, so 12s is tail headroom rather than a target and two attempts
// still land inside 30 with the response to write.
const SPOT_TIMEOUT_MS = 12_000;

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

  const json = await readJsonRequest(req, MAX_SPOT_FRAME_BYTES * 2);
  if (!json.ok) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(json.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // A deployment missing the provider credential can never spot, so say so here
  // rather than spending the player's hourly unit on a call that cannot leave
  // the building. Same shape as the failure below, an empty candidate list at
  // 200, because the framing card must keep working: an error status here would
  // be the one way a missing secret could break tap-to-pick. Mirrors the check
  // /api/coach makes for its own provider key.
  if (process.env.AI_MOCK !== "true" && !hasVisionKey()) {
    return NextResponse.json({ players: [] });
  }

  // Shares the coach-chat bucket: spotting is a cheap coach-adjacent call and
  // scrub-and-refresh usage fits chat-scale limits.
  const quota = await consumeApiQuota(supabase, "coach");
  if (!quota.ok || !quota.allowed) {
    return NextResponse.json({ players: [] }, { status: quota.ok ? 429 : 503 });
  }

  // Same mock switch analyze and coach honor; this route lacked it, so
  // mock-mode development still spent a real frame read on every framing-card
  // open whenever a key was present. One canned candidate keeps the picker list
  // exercisable.
  if (process.env.AI_MOCK === "true") {
    return NextResponse.json({
      players: [{ label: "Athlete mid-court in a dark kit", x: 0.5, y: 0.55 }],
    });
  }

  try {
    // Spotting reads pixels, so it goes to the vision provider with the frame
    // read (D-093) rather than to the coaching service.
    const read = await readFrames({
      model: VISION_MODEL,
      system: [],
      frames: [{ index: 0, time_s: null, data: parsed.data.frame }],
      instructions: [
        "List the people in this frame who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
          "For each: a short physical description a user could match at a glance (kit or shirt color, distinguishing detail, where they are on the court; never a name or a guess about identity), " +
          "and the position of their torso center in normalized image coordinates (x 0 at the left edge to 1 at the right, y 0 at the top to 1 at the bottom). " +
          "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.",
      ],
      schema: spotSchema,
      // Far above what a six-entry list needs, and deliberately so. On this
      // gateway the ceiling is not an output budget: one model id resolves
      // across several upstreams and the ones that reason bill that reasoning
      // against max_tokens BEFORE any content (D-096). A ceiling sized to the
      // reply returns an empty string on exactly the upstreams that think
      // hardest, and an empty string here is an empty picker the player reads
      // as "it found nobody", silently, with the quota already spent.
      //
      // Not hypothetical on this prompt. Fifteen live reads of one frame drew
      // two upstreams and spent 401 to 813 tokens reasoning before writing a
      // two-entry list, the largest reply totalling 920 output tokens of which
      // 813 was reasoning. The 1024 this route asked for while it was on the
      // coaching service was therefore about one bad draw from returning
      // nothing. Matched to /api/analyze so both frame paths fail the same way
      // or not at all; unused headroom is not billed.
      maxTokens: 8192,
      timeoutMs: SPOT_TIMEOUT_MS,
      maxRetries: 1,
    });
    return NextResponse.json({ players: read.parsed?.players ?? [] });
  } catch (err) {
    // Status and request id are what make a provider outage separable from a
    // bad frame after the fact, and they stay server-side: the reply below
    // carries no message at all, so there is nothing here for a vendor name to
    // leak into.
    const visionErr = err instanceof VisionError ? err : null;
    console.error("[players] spotting call failed", {
      status: visionErr?.status,
      requestId: visionErr?.requestId,
      message: visionErr?.message ?? (err instanceof Error ? err.message : String(err)),
    });
    // Spotting is an assist, never a gate: the tap-anywhere path still works.
    // No classifyCoachingError branch, unlike /api/analyze, because there is
    // nothing to refund and nothing to tell the player: every failure class
    // ends at the same empty list and the same silent fallback.
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}
