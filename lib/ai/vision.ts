import "server-only";
import { z } from "zod";
import { withPrivateRouting } from "./routing.ts";

/**
 * The vision provider: the one call path that READS pixels.
 *
 * Split from the coaching service on 2026-08-04 (D-093). The frame read and the
 * written coaching are different jobs with different winners: the 2026-08-04
 * bakeoff put Gemini 3.6 Flash ahead of every Claude tier on vision at ~1/3 the
 * input rate, while the written report stays where it already is. Everything in
 * lib/ai that produces PROSE for a player still goes through client.ts and the
 * coaching service; only frame reads come here.
 *
 * Plain fetch on purpose. The gateway is OpenAI-shaped REST and a second SDK
 * would not earn its place in the dependency budget; the eval harness has
 * exercised this exact request shape since 2026-08-04.
 *
 * Vendor names are confined to this file, to lib/ai/client.ts's model
 * constants, and to the two API-key env vars. Nothing here reaches a player:
 * callers translate a failure into the vendor-neutral "coaching service"
 * language the rest of the app uses.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Sent as the gateway's attribution headers. Not required, and deliberately not
// a secret: it is how the account's dashboard separates this app's spend from
// the eval harness's.
const APP_TITLE = "Vollyio";

export type VisionUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  // Which upstream the gateway actually resolved this request to, and how much
  // of the output budget went to reasoning before any content.
  //
  // Recorded because one model id is NOT one behaviour (D-096). The same id
  // resolves across several upstreams that differ: one returns zero reasoning
  // tokens, another returns thousands, and reasoning bills against max_tokens
  // BEFORE a single character of content. That is how one probe returned an
  // empty reply six attempts of six while an independent probe at the identical
  // setting returned content five of five. Both were true; they drew different
  // upstreams. Without these two fields on the telemetry row, an empty read is
  // indistinguishable from a model that simply refused, and the ceiling that
  // would fix it cannot be chosen from evidence.
  provider: string | null;
  reasoning_tokens: number;
};

export type VisionFrame = {
  /** Position in the sent sequence; what the reply's frame_index refers to. */
  index: number;
  time_s: number | null;
  /** base64 JPEG, no data: prefix. */
  data: string;
};

export type VisionVideo = {
  /** base64 MP4/WebM, no data: prefix. */
  data: string;
  /** MIME type as sent; the upstream dispatches on it. */
  mime: string;
  /** Clip length, for the prompt's time bounds. Null when unknown. */
  duration_s: number | null;
};

/**
 * What the upstream actually samples out of a video, measured 2026-08-05 and
 * NOT a configurable number.
 *
 * The gateway speaks an OpenAI-shaped API that has no field for Gemini's
 * `videoMetadata.fps`. Sending it nested in the content part changes nothing:
 * a 2.2s clip and a 9.96s clip both price at a flat rate per second of footage,
 * which is the low-resolution 1 fps path. A 10s clip therefore reaches the
 * model as about TEN low-resolution stills, against the 64 frames at 1024px
 * that readFrames sends for the same clip.
 *
 * CORRECTED 2026-08-09 from 89 to 60 (D-106). 89 was the 2026-08-05 reading;
 * production telemetry and an independent probe now agree on 60. A 10s read
 * bills 3,250 input tokens of which ~2,650 is the instruction block, leaving
 * 600 for the footage. Anything sized off the old number was sized ~48% high.
 *
 * The consequence is temporal, and it is the reason nothing that needs a
 * precise instant may be asked of this path: on a clip whose contact is
 * hand-verified at 3.42s, six video runs answered between 0.27s and 0.60s
 * while self-reporting 30fps. A contact lasts about 50ms and simply is not in
 * the sample. Ask this path what a rep looks like OVERALL; ask readFrames when
 * the answer depends on which instant something happened.
 */
export const VIDEO_TOKENS_PER_SECOND = 60;

/**
 * A failure from the vision provider, shaped so classifyCoachingError() can read
 * it exactly as it reads an SDK error: a status and a message. The gateway
 * answers 402 with "insufficient credits" when the account runs dry, which that
 * classifier already treats as a capacity outage: the player is told their clip
 * was not counted, and it is not.
 */
export class VisionError extends Error {
  readonly status: number | null;
  readonly requestId: string | null;
  constructor(message: string, status: number | null, requestId: string | null) {
    super(message);
    this.name = "VisionError";
    this.status = status;
    this.requestId = requestId;
  }
}

export type VisionRead<T> = {
  /** null when the reply arrived but did not match the schema. */
  parsed: T | null;
  usage: VisionUsage;
  ms: number;
};

type ReadOptions<T extends z.ZodType> = {
  model: string;
  /** System blocks, in order. Joined by the caller's intent, not concatenated text. */
  system: string[];
  frames: VisionFrame[];
  /** Text blocks appended after the frames, in order. */
  instructions: string[];
  schema: T;
  /** Reshape a reply that means the schema into its shape before parsing (D-132). */
  normalize?: (json: unknown) => unknown;
  maxTokens: number;
  /** Per-attempt ceiling. Bounded by the route's maxDuration, never by hope. */
  timeoutMs?: number;
  /** Retries AFTER the first attempt. */
  maxRetries?: number;
};

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_RETRIES = 1;

// Retried: the gateway's own overload signals and an upstream that is briefly
// unavailable. NOT retried: 400/401/402/403 (a request or an account problem
// that a second identical attempt cannot fix, and 402 must reach the caller
// fast so the player gets the "not counted" message rather than a timeout).
function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 20_000);
    }
  }
  // 1s, 2s, capped. Jittered so two requests that fail together do not retry
  // together.
  return Math.min(1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2);
}

/**
 * Some models wrap JSON in a fenced block even under a json_schema response
 * format. Unwrapping here is cheaper than losing an analysis the model actually
 * got right; a reply that is not JSON at all still fails the parse below.
 */
function unfence(text: string): string {
  const fenced = text.match(/^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  return fenced ? fenced[1] : text;
}

function usageFrom(raw: unknown, provider: unknown): VisionUsage {
  const u = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  const completion = (u.completion_tokens_details ?? {}) as Record<string, unknown>;
  return {
    input_tokens: num(u.prompt_tokens),
    output_tokens: num(u.completion_tokens),
    // Re-labelled into the coaching service's usage shape so ONE cost
    // calculator (lib/ai/pricing.ts) prices both providers.
    cache_read_input_tokens: num(details.cached_tokens),
    cache_creation_input_tokens: 0,
    provider: typeof provider === "string" && provider !== "" ? provider : null,
    reasoning_tokens: num(completion.reasoning_tokens),
  };
}

/** Whether the vision provider is configured at all. */
export function hasVisionKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

type ContentBlock = Record<string, unknown>;

// D-110 EVAL, 2026-08-09: the instructions were briefly moved AHEAD of the clip
// with a `cache_control` breakpoint, to open the prompt cache. Both halves were
// reverted after measuring, and the measurement is recorded here so nobody
// re-derives the idea from first principles and ships it again.
//
// It bought no caching. `messages` puts the system block FIRST already, so the
// rubric is a cacheable prefix whatever order the user content is in: the eval
// saw 1,878 tokens cached on the OLD order with no breakpoint at all. The
// earlier probe that appeared to prove otherwise had no system message and put
// everything in the user turn, which is not the shape this file sends.
//
// It cost read consistency. Over 5 draws per arm on a 15.9s clip, the reordered
// prompt widened the score spread from 78-83 to 76-88, dropped a checkpoint on
// 2 of 5 runs (4 visible of 5, against 5 of 5 every run on the old order), and
// returned 1 improvement instead of 2 on those same 2 runs. On a 4.1s clip the
// two arms were indistinguishable, so the cost lands on longer footage.
//
// Reproduce with scripts/eval-prompt-order.mjs.

/**
 * The request body both reads share. `pinProvider` exists for the video path:
 * Gemini's AI Studio upstream takes YouTube links only while Vertex takes
 * base64 data URLs, so an unpinned video request succeeds or fails by routing
 * luck. Frames work on either upstream and stay unpinned.
 */
function chatBody<T extends z.ZodType>(
  opts: Pick<ReadOptions<T>, "model" | "system" | "schema" | "maxTokens">,
  content: ContentBlock[],
  pinProvider: boolean,
): string {
  return JSON.stringify({
    model: opts.model,
    max_tokens: opts.maxTokens,
    // The privacy floor rides on every request, and the Vertex pin is merged
    // into it rather than replacing it (lib/ai/routing.ts).
    ...withPrivateRouting(pinProvider ? { only: ["google-vertex"] } : undefined),
    messages: [
      ...opts.system.map((text) => ({ role: "system", content: text })),
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "analysis",
        // strict would require additionalProperties:false on every nested
        // object; the zod parse below is the real guard either way.
        strict: false,
        schema: z.toJSONSchema(opts.schema, { io: "output" }),
      },
    },
  });
}

async function postChat<T extends z.ZodType>(
  body: string,
  schema: T,
  timeoutMs: number,
  maxRetries: number,
  normalize?: (json: unknown) => unknown,
): Promise<VisionRead<z.infer<T>>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    // Not a thrown Error with a stack the caller has to unpick: this is a
    // deployment that is missing a secret, and it reads as a provider outage
    // so the route's existing 502/503 paths cover it without a new branch.
    throw new VisionError("vision provider is not configured", null, null);
  }

  const started = Date.now();

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          "x-title": APP_TITLE,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // A timeout or a dropped connection. Retryable on the same budget as a
      // 5xx, and the last one becomes the error the caller classifies.
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxRetries) {
        throw new VisionError(`vision request failed: ${message}`, null, null);
      }
      await new Promise((r) => setTimeout(r, backoffMs(attempt, null)));
      continue;
    }

    const requestId = res.headers.get("x-request-id");
    if (!res.ok) {
      // The body carries the reason (credit balance, upstream refusal). Read it
      // even on the failure path: classifyCoachingError() reads the message,
      // and an empty message would flatten a billing outage into a generic 502.
      const detail = await res.text().catch(() => "");
      if (isRetryable(res.status) && attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, backoffMs(attempt, res.headers.get("retry-after"))),
        );
        continue;
      }
      throw new VisionError(
        `vision provider ${res.status}: ${detail.slice(0, 500)}`,
        res.status,
        requestId,
      );
    }

    // Read the body as TEXT first, and treat a failure here as a transport
    // failure rather than as a model that answered badly.
    //
    // This was `res.json().catch(() => null)`, and that swallowed a real and
    // measurable failure. `AbortSignal.timeout` aborts the response BODY STREAM,
    // not just the connection, so a 200 whose body stalls past the deadline
    // rejects HERE, after the status line has already arrived. The catch turned
    // that rejection into `parsed: null`, which means:
    //   - the retry above never fired, because a timeout was not on the throw
    //     path at all;
    //   - `/api/analyze` read it as "the model returned something unparseable",
    //     spent a second paid read on the re-try, and then answered 502, when
    //     the truth was a timeout that `classifyCoachingError` would have called
    //     `busy` and REFUNDED. The player lost an analysis slot to a network
    //     stall.
    // Measured at roughly 1 in 19 live reads, so it is a routine event and not
    // a corner case.
    //
    // A genuine JSON SYNTAX error still resolves to `parsed: null`, because that
    // one really is a reply the model got wrong and a second attempt at it is
    // the caller's decision, not this layer's.
    let bodyText: string;
    try {
      bodyText = await res.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxRetries) {
        throw new VisionError(`vision request failed: ${message}`, null, requestId);
      }
      await new Promise((r) => setTimeout(r, backoffMs(attempt, null)));
      continue;
    }

    let payload: {
      usage?: unknown;
      provider?: unknown;
      error?: { message?: unknown; code?: unknown };
      choices?: { message?: { content?: unknown } }[];
    } | null = null;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = null;
    }
    const ms = Date.now() - started;
    const usage = usageFrom(payload?.usage, payload?.provider);

    // A 200 can still carry a provider-side error object instead of a choice.
    const errorMessage = payload?.error?.message;
    if (typeof errorMessage === "string") {
      throw new VisionError(
        `vision provider: ${errorMessage}`,
        typeof payload?.error?.code === "number" ? payload.error.code : null,
        requestId,
      );
    }

    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim() === "") {
      return { parsed: null, usage, ms };
    }

    let json: unknown;
    try {
      json = JSON.parse(unfence(text));
    } catch {
      return { parsed: null, usage, ms };
    }
    const validated = schema.safeParse(normalize ? normalize(json) : json);
    return { parsed: validated.success ? validated.data : null, usage, ms };
  }
}

/**
 * Read a frame sequence and return it validated against `schema`.
 *
 * Throws VisionError on a transport or provider failure (the caller classifies
 * it); resolves with `parsed: null` when a reply arrived that the schema
 * refuses, which is the same "couldn't read that clip" outcome the coaching
 * service produces on an unparseable reply.
 */
export async function readFrames<T extends z.ZodType>(
  opts: ReadOptions<T>,
): Promise<VisionRead<z.infer<T>>> {
  const content: ContentBlock[] = [
    ...opts.frames.flatMap((f) => [
      {
        type: "text",
        text: f.time_s != null ? `Frame ${f.index}, t=${f.time_s}s` : `Frame ${f.index}`,
      },
      {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${f.data}` },
      },
    ]),
    ...opts.instructions.map((text) => ({ type: "text", text })),
  ];
  return postChat(
    chatBody(opts, content, false),
    opts.schema,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.maxRetries ?? DEFAULT_MAX_RETRIES,
  );
}

/**
 * Read a whole clip instead of a frame sequence.
 *
 * Read VIDEO_TOKENS_PER_SECOND above before calling this. The upstream samples
 * about one low-resolution image per second and there is no knob here that
 * changes it, so this path answers "how does this rep look" and must never be
 * asked "at what instant did X happen". Callers wanting an instant send frames.
 */
export async function readVideo<T extends z.ZodType>(
  opts: Omit<ReadOptions<T>, "frames"> & { video: VisionVideo },
): Promise<VisionRead<z.infer<T>>> {
  const content: ContentBlock[] = [
    {
      type: "video_url",
      video_url: { url: `data:${opts.video.mime};base64,${opts.video.data}` },
    },
    ...(opts.video.duration_s != null
      ? [
          {
            type: "text",
            text: `This clip is ${opts.video.duration_s.toFixed(1)} seconds long.`,
          },
        ]
      : []),
    ...opts.instructions.map((text) => ({ type: "text", text })),
  ];
  return postChat(
    // The Vertex pin is a Google-only fact: a non-Google id has no Vertex
    // endpoint at all, and pinning it there returns "no endpoints" (D-131).
    chatBody(opts, content, opts.model.startsWith("google/")),
    opts.schema,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.maxRetries ?? DEFAULT_MAX_RETRIES,
    opts.normalize,
  );
}
