// The schema-bound half of the gateway chat module.
//
// Every failure pinned here is a silent one. A body that forgets
// `response_format` gets prose back and stores nothing. A reply the model
// wrapped in a code fence is valid JSON that a strict parse throws away. A
// reply that misses the schema has to be distinguishable from an outage,
// because one of those releases the player's weekly claim and the other must
// not be retried into forever. And a provider refusal has to keep carrying the
// status and message classifyCoachingError() reads, or a credit exhaustion
// stops being told apart from a generic failure.
//
// Everything below runs the REAL completeObject against a scripted fetch, so no
// key and no network are involved.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { z } from "zod";
import { classifyCoachingError } from "./errors.ts";

// lib/ai/chat.ts is `server-only`, and that marker package is supplied by the
// framework's bundler rather than installed into node_modules, so a plain node
// import of it cannot resolve. Stubbing the specifier lets these assertions run
// against the REAL function instead of against a copy that can drift from it.
// Cast because the installed @types/node predates `registerHooks`.
type ResolveResult = { url: string; shortCircuit?: boolean };
type ModuleHooks = {
  resolve(
    specifier: string,
    context: unknown,
    next: (specifier: string, context: unknown) => ResolveResult,
  ): ResolveResult;
};
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: ModuleHooks) => void;
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const { completeObject, ChatError } = await import("./chat.ts");

// Small enough to read, and shaped like the plan: a required scalar and a
// bounded array, so a short reply and a long one both fail for visible reasons.
const schema = z.object({
  headline: z.string(),
  days: z.array(z.object({ day: z.string(), minutes: z.number().int().max(90) })).length(2),
});

const REPLY = {
  headline: "Serve week",
  days: [
    { day: "Monday", minutes: 40 },
    { day: "Tuesday", minutes: 20 },
  ],
};

type SeenRequest = { url: string; body: string; authorization: string | null };

function completion(content: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }], ...extra }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

// The global fetch and the key are restored in a finally on every path, because
// a test that leaks either stops testing itself and starts deciding whichever
// test runs next.
async function withGateway(
  respond: (request: SeenRequest, attempt: number) => Response | Promise<Response>,
  run: (requests: SeenRequest[]) => Promise<void>,
  key: string | null = "test-key-not-a-real-one",
): Promise<void> {
  const realFetch = globalThis.fetch;
  const realKey = process.env.OPENROUTER_API_KEY;
  const requests: SeenRequest[] = [];

  if (key === null) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = key;

  globalThis.fetch = async (input, init) => {
    const request = {
      url: String(input),
      body: String(init?.body ?? ""),
      authorization: new Headers(init?.headers).get("authorization"),
    };
    requests.push(request);
    return respond(request, requests.length - 1);
  };

  try {
    await run(requests);
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = realKey;
  }
}

function call(overrides: Record<string, unknown> = {}) {
  return completeObject({
    model: "test/model",
    system: "You are a coach.",
    messages: [{ role: "user", content: "Write my week." }],
    schema,
    schemaName: "weekly_plan",
    maxTokens: 8192,
    maxRetries: 0,
    ...overrides,
  });
}

test("the request binds the schema and does not ask for a stream", async () => {
  await withGateway(
    () => completion(JSON.stringify(REPLY)),
    async (requests) => {
      const read = await call();
      assert.deepEqual(read.parsed, REPLY);

      const body = JSON.parse(requests[0].body);
      // Without this the model answers in prose and nothing can be stored.
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.name, "weekly_plan");
      // The zod schema has to reach the wire, not just the local parse: the
      // json_schema is what makes the reply parseable in the first place.
      assert.deepEqual(
        Object.keys(body.response_format.json_schema.schema.properties).sort(),
        ["days", "headline"],
      );
      // A streamed reply has no `choices[0].message.content` to parse, so
      // asking for one here would return null on every call.
      assert.equal(body.stream, undefined);
      assert.equal(body.max_tokens, 8192);
      assert.equal(body.messages[0].role, "system");
      assert.equal(body.messages[1].content, "Write my week.");
    },
  );
});

test("a reply wrapped in a code fence is still the reply", async () => {
  // Models wrap JSON in a fence even under a json_schema response format.
  // Throwing that away loses a plan the model actually got right.
  await withGateway(
    () => completion("```json\n" + JSON.stringify(REPLY) + "\n```"),
    async () => {
      const read = await call();
      assert.deepEqual(read.parsed, REPLY);
    },
  );
});

test("a reply the schema refuses comes back as null, not as a throw", async () => {
  // The caller releases its claim on both, but only one of them is worth
  // classifying as a provider failure, and a throw here would lose the usage
  // row that says which upstream produced the bad reply.
  const cases: string[] = [
    JSON.stringify({ headline: "Serve week", days: [{ day: "Monday", minutes: 40 }] }),
    JSON.stringify({ ...REPLY, days: [{ day: "Monday", minutes: 400 }, { day: "T", minutes: 5 }] }),
    "I'd rather write this as prose, honestly.",
    "",
    "   ",
  ];
  for (const content of cases) {
    await withGateway(
      () => completion(content),
      async () => {
        const read = await call();
        assert.equal(read.parsed, null, content.slice(0, 40));
      },
    );
  }
});

test("usage arrives in the shape the one cost calculator prices", async () => {
  await withGateway(
    () =>
      completion(JSON.stringify(REPLY), {
        provider: "GMICloud",
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 900,
          prompt_tokens_details: { cached_tokens: 400 },
          completion_tokens_details: { reasoning_tokens: 3800 },
        },
      }),
    async () => {
      const read = await call();
      assert.deepEqual(read.usage, {
        input_tokens: 1200,
        output_tokens: 900,
        cache_read_input_tokens: 400,
        cache_creation_input_tokens: 0,
        provider: "GMICloud",
        reasoning_tokens: 3800,
      });
    },
  );
});

test("a payload with no usage block prices as zero rather than as NaN", async () => {
  await withGateway(
    () => completion(JSON.stringify(REPLY)),
    async () => {
      const read = await call();
      assert.equal(read.usage.input_tokens, 0);
      assert.equal(read.usage.reasoning_tokens, 0);
      // Null, not the empty string: the telemetry reader has to be able to tell
      // "the gateway did not say" from "the gateway said nothing useful".
      assert.equal(read.usage.provider, null);
    },
  );
});

test("an empty reply still reports which upstream produced it", async () => {
  // The whole point of carrying these two fields (D-096): an empty reply from a
  // heavy-reasoning upstream is a ceiling problem, and an empty reply from one
  // that reports zero reasoning tokens is not. Without the pair they look alike.
  await withGateway(
    () =>
      completion("", {
        provider: "GMICloud",
        usage: {
          completion_tokens: 8192,
          completion_tokens_details: { reasoning_tokens: 8192 },
        },
      }),
    async () => {
      const read = await call();
      assert.equal(read.parsed, null);
      assert.equal(read.usage.provider, "GMICloud");
      assert.equal(read.usage.reasoning_tokens, 8192);
    },
  );
});

test("a retryable status is retried and the second answer is kept", async () => {
  // Safe here in a way it is not on the streaming path: nothing has been handed
  // to the caller yet, so attempt two replaces attempt one rather than being
  // spliced onto the end of it.
  await withGateway(
    (_request, attempt) =>
      attempt === 0
        ? new Response("upstream is busy", { status: 503, headers: { "retry-after": "0" } })
        : completion(JSON.stringify(REPLY)),
    async (requests) => {
      const read = await call({ maxRetries: 1 });
      assert.deepEqual(read.parsed, REPLY);
      assert.equal(requests.length, 2);
    },
  );
});

test("a body that never finishes arriving is a failure, not a refused schema", async () => {
  // Measured on the real path 2026-08-06: this gateway answers 200 within a
  // second on a non-streaming request and then pads the body with whitespace
  // until the upstream finishes, which on a stuck draw is never. The timeout
  // therefore fires during the BODY read, long after fetch() resolved, so a
  // res.json().catch(() => null) turned three draws in twenty-one into "the
  // model answered with something unparseable": no retry, no throw, zero usage,
  // and a caller told its schema was refused when nothing ever arrived.
  const stalled = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("  \n  "));
          controller.error(new Error("The operation was aborted due to timeout"));
        },
      }),
      { status: 200 },
    );

  await withGateway(
    (_request, attempt) => (attempt === 0 ? stalled() : completion(JSON.stringify(REPLY))),
    async (requests) => {
      const read = await call({ maxRetries: 1 });
      assert.deepEqual(read.parsed, REPLY, "the retry that clears a stall has to happen");
      assert.equal(requests.length, 2);
    },
  );

  await withGateway(stalled, async () => {
    const err = await call().then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof ChatError, "an exhausted stall throws rather than returning null");
    assert.match(err.message, /reading the reply/);
  });
});

test("a credit refusal is not retried and still classifies as a capacity outage", async () => {
  // 402 with a billing message is what the gateway answers when the prepaid
  // balance runs dry. Retrying it burns the claim window for nothing, and the
  // status plus message pair is the only thing classifyCoachingError reads.
  await withGateway(
    () =>
      new Response(JSON.stringify({ error: { message: "insufficient credits" } }), {
        status: 402,
      }),
    async (requests) => {
      const err = await call({ maxRetries: 2 }).then(
        () => null,
        (e: unknown) => e,
      );
      assert.ok(err instanceof ChatError, String(err));
      assert.equal(err.status, 402);
      assert.equal(requests.length, 1, "a 402 is an account problem a retry cannot fix");
      assert.equal(
        classifyCoachingError({ status: err.status, message: err.message }),
        "capacity",
      );
    },
  );
});

test("a 200 carrying a provider error object is a failure, not an empty plan", async () => {
  await withGateway(
    () =>
      new Response(JSON.stringify({ error: { message: "upstream refused", code: 429 } }), {
        status: 200,
      }),
    async () => {
      const err = await call().then(
        () => null,
        (e: unknown) => e,
      );
      assert.ok(err instanceof ChatError, String(err));
      assert.equal(classifyCoachingError({ status: err.status, message: err.message }), "busy");
    },
  );
});

test("a missing credential throws before anything is sent", async () => {
  // The caller checks hasChatKey() before it claims the player's week, and this
  // is the backstop for the case where it does not: no request goes out, so a
  // misconfigured deployment cannot spend.
  await withGateway(
    () => completion(JSON.stringify(REPLY)),
    async (requests) => {
      const err = await call().then(
        () => null,
        (e: unknown) => e,
      );
      assert.ok(err instanceof ChatError, String(err));
      assert.equal(requests.length, 0);
      assert.equal(/anthropic|claude|openrouter|deepseek/i.test(err.message), false, err.message);
    },
    null,
  );
});
