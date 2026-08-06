import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { VISION_MODEL } from "@/lib/ai/client";
import { readVideo, VisionError } from "@/lib/ai/vision";
import { simpleRubric, simpleRatingSchema } from "@/lib/ai/simple-rubric";
import { hasLocalEvalAccess, readJsonRequest } from "@/lib/security/request";
import { SKILLS, DISCIPLINES } from "@/lib/skills";
import { estimateCostUsd } from "@/lib/ai/pricing";

/**
 * Dev-only bench for the video path (2026-08-05).
 *
 * Exists because nothing else exercises the whole mechanic end to end: the
 * calibration scripts read pre-cut clips off disk with ffmpeg-made files, and
 * `lib/video-clip.ts` cuts clips in a BROWSER, which no Node script can drive.
 * The two halves had never met. This route is the server half of that meeting.
 *
 * It is not a production route and must never become one. Same gate as
 * /api/eval: 404 in production, loopback only, bearer token. It deliberately
 * has no quota, no entitlement and no persistence, because it spends the
 * owner's own gateway credit on the owner's own machine and writes nothing a
 * player could ever read.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

// Generous next to production's 4 MB: this is a local bench with no quota
// behind it, and the point is to find out what real trimmer output weighs
// rather than to reject it before measuring.
const MAX_BODY_BYTES = 16_000_000;

const bodySchema = z.object({
  skill: z.enum(SKILLS),
  discipline: z.enum(DISCIPLINES),
  clip_b64: z.string().min(64),
  mime: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
  duration_s: z.number().positive().max(60).nullable(),
});

export async function POST(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    !hasLocalEvalAccess(req, process.env.EVAL_TOKEN)
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const json = await readJsonRequest(req, MAX_BODY_BYTES);
  if (!json.ok) {
    return NextResponse.json({ error: `Body rejected: ${json.error}` }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bad request.", detail: parsed.error.issues.slice(0, 4) },
      { status: 400 },
    );
  }
  const { skill, discipline, clip_b64, mime, duration_s } = parsed.data;

  const started = Date.now();
  try {
    const read = await readVideo({
      model: VISION_MODEL,
      system: [simpleRubric(skill, discipline)],
      video: { data: clip_b64, mime, duration_s },
      // No player level. Injecting it is what invalidated the earlier
      // production measurement, and the lab must measure the shipped prompt.
      instructions: ["Rate this rep."],
      schema: simpleRatingSchema,
      maxTokens: 2048,
      timeoutMs: 90_000,
      maxRetries: 1,
    });

    let cost: number | null = null;
    try {
      cost = estimateCostUsd(read.usage, VISION_MODEL);
    } catch {
      // The pricer throws on an unpriced model. A missing dollar figure must
      // not lose the rating that was already paid for.
    }

    return NextResponse.json({
      rating: read.parsed,
      // Unparseable replies are the interesting failure here, so the bench
      // reports the shape rather than flattening it to "couldn't read that".
      parsed_ok: read.parsed !== null,
      usage: read.usage,
      cost_usd: cost,
      ms: read.ms,
      model: VISION_MODEL,
      clip_bytes: Math.floor((clip_b64.length * 3) / 4),
    });
  } catch (err) {
    const e = err instanceof VisionError ? err : null;
    // Dev bench: the real provider message is the whole point, so unlike
    // production this does NOT translate it into vendor-neutral language.
    return NextResponse.json(
      {
        error: e?.message ?? (err instanceof Error ? err.message : String(err)),
        status: e?.status ?? null,
        requestId: e?.requestId ?? null,
        ms: Date.now() - started,
      },
      { status: 502 },
    );
  }
}
