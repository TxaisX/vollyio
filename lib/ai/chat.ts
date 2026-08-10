import "server-only";
import { withPrivateRouting } from "./routing.ts";
import { z } from "zod";

/**
 * Text over the gateway: prose streamed to a player, and one schema-bound
 * object for a caller that wants a structure rather than a stream.
 *
 * Separate from `lib/ai/vision.ts` on purpose. That module reads PIXELS; this
 * one sends TEXT. The split is by what goes in, not by what comes back, which
 * is why `completeObject` below binds a JSON schema the same way vision.ts does
 * and still belongs here rather than there.
 *
 * Plain fetch and a hand-rolled SSE reader, for the same reason vision.ts uses
 * plain fetch: the gateway speaks OpenAI-shaped REST, and a second SDK would
 * not earn its place in the dependency budget for one endpoint.
 *
 * Vendor names stay confined to the model constants in lib/ai/client.ts and the
 * endpoint below. Callers translate a failure into the vendor-neutral "coaching
 * service" language the rest of the app uses.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const APP_TITLE = "Vollyio";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;

export type ChatMessage = { role: string; content: string };

export class ChatError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ChatError";
    this.status = status;
  }
}

/**
 * Whether the chat provider is configured at all.
 *
 * Checked by the route BEFORE it consumes quota. Without it a deployment that
 * is missing the key still charges the player both an hourly and a daily unit,
 * then returns 200 with an empty body, because the throw below happens inside
 * the stream after the response head has already gone out. The player sees "the
 * coach didn't answer" and is billed for it, and there is no refund on this
 * route. Mirrors `hasVisionKey()` in lib/ai/vision.ts.
 */
export function hasChatKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
  }
  return Math.min(1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2);
}

/**
 * Yield the reply as it arrives.
 *
 * RETRIES STOP AT THE FIRST BYTE, and that is a correctness rule rather than a
 * simplification. The caller streams every chunk straight to the player and
 * concatenates the same chunks into what it stores, so a retry after any text
 * has been emitted would replay a second answer onto the end of a partial one
 * and then save the result. Better a short answer than a spliced one, so once
 * the reply has started this fails by ending the stream, and the caller's
 * existing "the coach didn't answer" path covers a stream that produced nothing.
 */
export async function* streamChat(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  timeoutMs?: number;
  maxRetries?: number;
}): AsyncGenerator<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ChatError("coaching service is not configured", null);

  const body = JSON.stringify({
    model: opts.model,
    max_tokens: opts.maxTokens,
    stream: true,
    ...withPrivateRouting(),
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  });
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

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
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxRetries) throw new ChatError(`chat request failed: ${message}`, null);
      await new Promise((r) => setTimeout(r, backoffMs(attempt, null)));
      continue;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (isRetryable(res.status) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt, res.headers.get("retry-after"))));
        continue;
      }
      throw new ChatError(`chat provider ${res.status}: ${detail.slice(0, 300)}`, res.status);
    }
    if (!res.body) throw new ChatError("chat provider returned no body", res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    // SSE frames split across network chunks, so a line is only complete once a
    // newline has arrived. Parsing per-chunk instead of per-line drops the tail
    // of every frame that straddles a boundary.
    let buffered = "";
    let started = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });

        const lines = buffered.split("\n");
        // The last element is whatever arrived after the final newline: an
        // incomplete line, kept for the next read.
        buffered = lines.pop() ?? "";

        for (const raw of lines) {
          const line = raw.trim();
          // The gateway sends `: OPENROUTER PROCESSING` keepalives while an
          // upstream is slow to start. They are comments, not data.
          if (line === "" || line.startsWith(":")) continue;
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;

          let parsed: {
            choices?: { delta?: { content?: string } }[];
            error?: { message?: string };
          };
          try {
            parsed = JSON.parse(payload);
          } catch {
            // A malformed frame is not worth killing a live answer over.
            continue;
          }
          // A 200 can still carry an error object mid-stream.
          if (parsed.error?.message) {
            if (started) return;
            throw new ChatError(`chat provider: ${parsed.error.message}`, null);
          }
          const text = parsed.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text.length > 0) {
            started = true;
            yield text;
          }
        }
      }
    } finally {
      // Whatever happened, do not leave the connection open behind us.
      await reader.cancel().catch(() => {});
    }
    return;
  }
}

/**
 * What the gateway billed, relabelled into the coaching service's usage shape
 * so ONE cost calculator (lib/ai/pricing.ts) prices every path.
 *
 * `provider` and `reasoning_tokens` are here for the reason D-096 records: one
 * model id is NOT one behaviour. The same id resolves across several upstreams,
 * one of which returns zero reasoning tokens and another thousands, and
 * reasoning bills against max_tokens BEFORE a single character of content. That
 * is how one probe returned an empty reply six attempts of six while an
 * independent probe at the identical setting returned content five of five.
 * Without these two fields an empty reply is indistinguishable from a model
 * that simply refused, and the ceiling that would fix it cannot be chosen from
 * evidence.
 */
export type ChatUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  provider: string | null;
  reasoning_tokens: number;
};

export type ChatObject<T> = {
  /** null when a reply arrived that the schema refuses, or arrived empty. */
  parsed: T | null;
  usage: ChatUsage;
  ms: number;
};

/**
 * Some models wrap JSON in a fenced block even under a json_schema response
 * format. Unwrapping here is cheaper than losing a reply the model actually got
 * right; a reply that is not JSON at all still fails the parse below.
 */
function unfence(text: string): string {
  const fenced = text.match(/^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  return fenced ? fenced[1] : text;
}

function usageFrom(raw: unknown, provider: unknown): ChatUsage {
  const u = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  const completion = (u.completion_tokens_details ?? {}) as Record<string, unknown>;
  return {
    input_tokens: num(u.prompt_tokens),
    output_tokens: num(u.completion_tokens),
    cache_read_input_tokens: num(details.cached_tokens),
    cache_creation_input_tokens: 0,
    provider: typeof provider === "string" && provider !== "" ? provider : null,
    reasoning_tokens: num(completion.reasoning_tokens),
  };
}

/**
 * Ask for ONE object, validated against `schema`, with no stream.
 *
 * The caller this exists for is the weekly plan: text in, one structure out,
 * written once and stored. It is neither of the two shapes the app already had.
 * `streamChat` above cannot serve it, because a plan is not useful half-written
 * and there is no player watching it arrive. `lib/ai/vision.ts` already does
 * exactly this request, and reusing it was the tempting answer and the wrong
 * one: that module's whole contract, in its own words, is that it READS PIXELS,
 * and putting a call with no image in it behind that name would erase the
 * distinction the D-093/D-096 split exists to keep visible. Whether the reply
 * is schema-bound is not what the two files are split on.
 *
 * So the request shape is copied from vision.ts rather than shared: `unfence`
 * and `usageFrom` above are that module's, near enough verbatim. A third module
 * holding the common gateway plumbing is the tidier answer and is the right
 * move the next time either file is opened for its own reasons; taking it now
 * would mean editing the path that scores real players' film in the same change
 * that swaps a model on an unrelated one.
 *
 * Throws ChatError on a transport or provider failure, carrying the same
 * {status, message} pair classifyCoachingError() reads, so a credit exhaustion
 * still classifies as a capacity outage. Resolves with `parsed: null` when a
 * reply arrived that the schema refuses, which is a different thing from a
 * failure and the caller decides what to do about it.
 */
export async function completeObject<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  schema: T;
  /** Names the schema in the request. Reaches the gateway's logs, not a player. */
  schemaName: string;
  maxTokens: number;
  timeoutMs?: number;
  /** Retries AFTER the first attempt. */
  maxRetries?: number;
}): Promise<ChatObject<z.infer<T>>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ChatError("coaching service is not configured", null);

  const body = JSON.stringify({
    model: opts.model,
    max_tokens: opts.maxTokens,
    ...withPrivateRouting(),
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        // strict would require additionalProperties:false on every nested
        // object; the zod parse below is the real guard either way.
        strict: false,
        schema: z.toJSONSchema(opts.schema, { io: "output" }),
      },
    },
  });

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
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
      // Unlike the stream above, retrying here is safe at any point: nothing
      // has been handed to a caller until this function returns, so a second
      // attempt replaces the first rather than being spliced onto it.
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxRetries) throw new ChatError(`chat request failed: ${message}`, null);
      await new Promise((r) => setTimeout(r, backoffMs(attempt, null)));
      continue;
    }

    if (!res.ok) {
      // Read the body even on the failure path: classifyCoachingError() reads
      // the message, and an empty one would flatten a billing outage into a
      // generic failure the player is told to retry into.
      const detail = await res.text().catch(() => "");
      if (isRetryable(res.status) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt, res.headers.get("retry-after"))));
        continue;
      }
      throw new ChatError(`chat provider ${res.status}: ${detail.slice(0, 500)}`, res.status);
    }

    // Read the body as text and parse it here rather than with res.json(), so a
    // body that never finishes arriving is not mistaken for a bad reply.
    //
    // Measured 2026-08-06: on a non-streaming request this gateway sends its
    // 200 within a second and then PADS THE BODY WITH WHITESPACE for as long as
    // the upstream takes, completing between 10 and 38 seconds. The timeout
    // signal therefore fires during the body read, not during the fetch, so the
    // catch above never sees it. With res.json().catch(() => null) the abort
    // became `payload = null`, which reads downstream as "the model answered
    // with something unparseable": no retry, no throw, zero usage, and a caller
    // told its schema was refused when in fact nothing ever arrived.
    let raw: string;
    try {
      raw = await res.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= maxRetries) {
        throw new ChatError(`chat request failed while reading the reply: ${message}`, null);
      }
      await new Promise((r) => setTimeout(r, backoffMs(attempt, null)));
      continue;
    }

    let payload: {
      usage?: unknown;
      provider?: unknown;
      error?: { message?: string; code?: number };
      choices?: { message?: { content?: string } }[];
    } | null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    const ms = Date.now() - started;
    const usage = usageFrom(payload?.usage, payload?.provider);

    // A 200 can still carry a provider-side error object instead of a choice.
    const errorMessage = payload?.error?.message;
    if (typeof errorMessage === "string") {
      throw new ChatError(
        `chat provider: ${errorMessage}`,
        typeof payload?.error?.code === "number" ? payload.error.code : null,
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
    const validated = opts.schema.safeParse(json);
    return { parsed: validated.success ? validated.data : null, usage, ms };
  }
}
