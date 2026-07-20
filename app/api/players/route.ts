import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { coach, ANALYZE_MODEL, ANALYZE_EFFORT } from "@/lib/ai/client";
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

  try {
    const response = await coach().messages.parse(
      {
        model: ANALYZE_MODEL,
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: parsed.data.frame,
                },
              },
              {
                type: "text",
                text:
                  "List the people in this frame who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
                  "For each: a short physical description a user could match at a glance (kit or shirt color, distinguishing detail, where they are on the court; never a name or a guess about identity), " +
                  "and the position of their torso center in normalized image coordinates (x 0 at the left edge to 1 at the right, y 0 at the top to 1 at the bottom). " +
                  "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.",
              },
            ],
          },
        ],
        output_config: {
          effort: ANALYZE_EFFORT,
          format: zodOutputFormat(spotSchema),
        },
      },
      { maxRetries: 2 },
    );
    const raw = response.parsed_output;
    return NextResponse.json({ players: raw?.players ?? [] });
  } catch (err) {
    console.error("[players] spotting call failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    // Spotting is an assist, never a gate: the tap-anywhere path still works.
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}
