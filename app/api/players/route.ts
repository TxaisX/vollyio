import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { VISION_MODEL } from "@/lib/ai/client";
import { readFrames, readVideo, VisionError, hasVisionKey } from "@/lib/ai/vision";
import { hasTrustedMutationOrigin, readJsonRequest } from "@/lib/security/request";
import { isJpegPayload } from "@/lib/security/request";
import { consumeApiQuota } from "@/lib/security/rate-limit";
import { MAX_CLIP_BYTES } from "@/lib/analysis-types";
import { FOCUS_LABEL_MAX_CHARS } from "@/lib/analyze-request";

// Player spotting for the framing card (D-036): the coach looks at ONE frame
// and names the people clearly playing in it, each with a torso-center point,
// so the user can pick their athlete from a list instead of tapping blind.
// The pick still becomes a plain coordinate; this endpoint only proposes
// candidates and can propose none.
//
// SECOND MODE, from the CLIP (D-100). Everything above assumes a browser that
// can render a frame, and the players this route matters most to are the ones
// whose browser cannot: no decode means no poster, no tap, and under D-062 no
// analysis at all. The clip itself decodes perfectly well on this side, so the
// spotting moves here in full. The candidates then have to stand alone as
// TEXT, because the player choosing between them cannot see the clip, which is
// the one real difference between the two modes and the only reason they do not
// share an instruction. No coordinates come back either: there is nothing to
// place them on.
//
// Both modes share every guard: same-origin, a verified user, the coach-scope
// quota, six candidates at most, never a name, and a failure that ends at an
// empty list rather than at an error the framing card has to handle.

export const runtime = "nodejs";
// Raised from 30 for the clip mode, which reads video rather than one JPEG and
// is correspondingly slower. One attempt plus a retry plus a backoff has to
// finish INSIDE this or the platform kills the function after the quota unit
// has already been spent, which is the arithmetic the two timeouts below are
// solving; 30 could not hold two clip attempts.
export const maxDuration = 60;

const MAX_SPOT_FRAME_BYTES = 1_500_000;

const frameRequestSchema = z.object({
  frame: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_SPOT_FRAME_BYTES / 3) * 4 + 4)
    .refine((data) => isJpegPayload(data, MAX_SPOT_FRAME_BYTES)),
});

// The clip is already in storage under the caller's own pending prefix, exactly
// as /api/analyze expects to find it. This route names nothing: the id is
// schema-proved to be a UUID and the extension is a closed enum, and the path is
// composed below from the VERIFIED user id, so no request can address a segment
// outside its own folder.
const clipRequestSchema = z.object({
  pending_clip_id: z.uuid(),
  clip_ext: z.enum(["mp4", "webm", "mov"]),
});

const requestSchema = z.union([frameRequestSchema, clipRequestSchema]);

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

// The clip mode's reply. Same cap, same never-a-name rule, and deliberately no
// coordinates: the player it is written for has no picture to place a point on,
// so asking for one would spend tokens on a number nothing could use and give
// the model a second thing to get wrong.
const clipSpotSchema = z.object({
  players: z
    .array(z.object({ label: z.string().max(FOCUS_LABEL_MAX_CHARS) }))
    .max(6),
});

const CLIP_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const FRAME_INSTRUCTION =
  "List the people in this frame who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
  "For each: a short physical description a user could match at a glance (kit or shirt color, distinguishing detail, where they are on the court; never a name or a guess about identity), " +
  "and the position of their torso center in normalized image coordinates (x 0 at the left edge to 1 at the right, y 0 at the top to 1 at the bottom). " +
  "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.";

// The clip instruction, and the sentence that carries the whole difference:
// THE READER CANNOT SEE THE CLIP. On the frame path a vague label is survivable
// because the numbered pin is on the picture beside it; here the words are all
// the player gets, so two candidates that read alike are the same failure as
// naming nobody. Everything else is the frame instruction's rules verbatim,
// including the never-a-name rule (D-036) and the empty list being a real
// answer rather than a failure.
const CLIP_INSTRUCTION =
  "Watch this clip and list the people in it who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
  "For each, give one short description, under 80 characters, of what makes that person recognisable: kit or shirt colour, a distinguishing detail, where they are on the court, and what they do in the clip. " +
  "Never a name, and never a guess about who somebody is. " +
  "THE PERSON READING YOUR LIST CANNOT SEE THIS CLIP. Your descriptions are all they have, so each one must tell that player apart from every other entry on its own: if two people would read the same, say what separates them. " +
  "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.";

// Per attempt, and the route as a whole is bounded by `maxDuration` above. One
// attempt plus the single retry plus a backoff has to finish inside that, or the
// platform kills the function mid-call and the player pays the quota unit this
// route already consumed for nothing. Measured against the live gateway at the
// ceiling below, fourteen of fifteen spot reads on a real frame returned in 3.4
// to 6.5 seconds, so 12s is tail headroom rather than a target and two attempts
// still land inside 30 with the response to write.
const SPOT_TIMEOUT_MS = 12_000;
// The clip read is the same job on much more input. Measured 2026-08-06 across
// eleven live reads: eight of a 5.5 second clip at 5.6 to 8.6s (median 6.0s),
// and three of a 44 second clip at 8.3 to 11.0s. Length matters, because the
// read is priced and paced per SECOND of footage, and this path cannot know the
// duration in advance: a browser that could measure it could also decode the
// clip and would never be here. Eight times the footage cost under twice the
// wall clock, so 25s is tail headroom rather than a target, and two attempts
// plus a backoff still land inside the 60s budget with the response to write.
const SPOT_CLIP_TIMEOUT_MS = 25_000;

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
  const request = parsed.data;
  const fromClip = "pending_clip_id" in request ? request : null;

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
  // exercisable; the clip mode gets two, because its whole point is a CHOICE
  // and a one-entry list is the case the client skips past.
  if (process.env.AI_MOCK === "true") {
    return NextResponse.json({
      players: fromClip
        ? [
            { label: "Player in the dark kit who serves from the right" },
            { label: "Player in the light kit waiting at the net" },
          ]
        : [{ label: "Athlete mid-court in a dark kit", x: 0.5, y: 0.55 }],
    });
  }

  let clip: Buffer | null = null;
  if (fromClip) {
    // Read with the player's own client, never the service role. The pending
    // select policy is owner-scoped, so the tenant boundary stays the
    // database's rather than this route remembering to compare two ids, which
    // is the same posture /api/analyze takes on the same object.
    const pendingPath = `${user.id}/pending/${fromClip.pending_clip_id}/clip.${fromClip.clip_ext}`;
    const { data: blob, error } = await supabase.storage.from("clips").download(pendingPath);
    if (error || !blob) {
      console.error("[players] pending clip unreadable", { message: error?.message });
      return NextResponse.json({ players: [] });
    }
    clip = Buffer.from(await blob.arrayBuffer());
    // The storage policy caps this already. Repeating it is not belt and
    // braces: this is where the bytes become a base64 string in function
    // memory, and a policy that is ever relaxed without this line becomes an
    // out-of-memory crash rather than an empty list.
    if (clip.byteLength > MAX_CLIP_BYTES) {
      return NextResponse.json({ players: [] });
    }
  }

  try {
    // Spotting reads pixels, so it goes to the vision provider with the frame
    // read (D-093) rather than to the coaching service.
    const read =
      fromClip && clip
        ? await readVideo({
            model: VISION_MODEL,
            system: [],
            video: {
              data: clip.toString("base64"),
              mime: CLIP_MIME[fromClip.clip_ext],
              duration_s: null,
            },
            instructions: [CLIP_INSTRUCTION],
            schema: clipSpotSchema,
            maxTokens: 8192,
            timeoutMs: SPOT_CLIP_TIMEOUT_MS,
            maxRetries: 1,
          })
        : await readFrames({
            model: VISION_MODEL,
            system: [],
            frames: [{ index: 0, time_s: null, data: "frame" in request ? request.frame : "" }],
            instructions: [FRAME_INSTRUCTION],
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
    //
    // On the clip mode the same empty list means something slightly different
    // and still must not be a failure status. The analysis runs unmarked and
    // the client says so out loud, which is worse coaching than a marked read
    // and far better than the refusal this whole path exists to remove.
    return NextResponse.json({ players: [] }, { status: 200 });
  }
}
