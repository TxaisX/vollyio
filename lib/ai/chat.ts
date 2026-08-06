import "server-only";

/**
 * Streaming text chat over the gateway.
 *
 * Separate from `lib/ai/vision.ts` on purpose. That module reads PIXELS and
 * every request it makes is bound to a JSON schema; this one streams prose to a
 * player as it is generated and has no schema at all. Sharing a file would put
 * two different contracts behind one name.
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
