import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { VISION_MODEL } from "@/lib/ai/client";
import { readFrames } from "@/lib/ai/vision";
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

  // Shares the coach-chat bucket: spotting is a cheap coach-adjacent call and
  // scrub-and-refresh usage fits chat-scale limits.
  const quota = await consumeApiQuota(supabase, "coach");
  if (!quota.ok || !quota.allowed) {
    return NextResponse.json({ players: [] }, { status: quota.ok ? 429 : 503 });
  }

  // Same mock switch analyze and coach honor; this route lacked it, so
  // mock-mode development still spent a real coaching-service read on every
  // framing-card open whenever a key was present. One canned candidate keeps
  // the picker list exercisable.
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
      maxTokens: 1024,
      // Inside this route's own maxDuration of 30, with room for the retry.
      timeoutMs: 12_000,
      maxRetries: 1,
    });
    return NextResponse.json({ players: read.parsed?.players ?? [] });
  } catch (err) {
    console.error("[players] spotting call failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    // Spotting is an assist, never a gate: the tap-anywhere path still works.
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}
