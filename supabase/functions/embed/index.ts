// The one embedding call, because the model gateway does not have one.
//
// Every other model call in this app goes to a single OpenAI-shaped gateway on
// one credential (D-098). That gateway serves ZERO embedding models -- checked
// against its own listing on 2026-08-27 -- so the alternatives were a second
// vendor with a second key, or the model Supabase already runs inside this
// runtime. gte-small is the latter: 384 dimensions, no network call, no
// credential, and it costs a function invocation the project already pays for.
//
// Known limits, both of which shape what may be sent here: English only, and
// input truncates at 512 tokens. The caller builds a compact source text rather
// than posting a whole analysis, which is `analysisSourceText` in
// lib/ai/retrieval.ts.
//
// Authorization is the gateway's verify_jwt, same posture as send-welcome and
// purge-user-media. This function reads no table and writes no row: it turns
// text into a vector and returns it. The WRITE goes through the caller under
// its own credential so the row lands behind the RLS policy in migration 067
// rather than around it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MAX_INPUT_CHARS = 4000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Constructed once, outside the handler. A Session per request would reload the
// weights on every call and turn a millisecond into a cold start.
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let input: unknown;
  try {
    ({ input } = await req.json());
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  if (typeof input !== "string" || input.trim().length === 0) {
    return json({ error: "input must be a non-empty string." }, 400);
  }
  // Truncation happens upstream at 512 tokens whatever we do; capping the chars
  // here means an accidental 2 MB post is refused rather than silently reduced
  // to its first paragraph and embedded as if it were the whole thing.
  if (input.length > MAX_INPUT_CHARS) {
    return json({ error: `input must be <= ${MAX_INPUT_CHARS} characters.` }, 413);
  }

  // normalize is not optional. Migration 067 indexes with vector_ip_ops, which
  // ranks by inner product; against unnormalized vectors that ranks by MAGNITUDE
  // and returns confident nonsense, with no error anywhere to notice it by.
  const embedding = await model.run(input, { mean_pool: true, normalize: true });

  if (!Array.isArray(embedding) || embedding.length !== 384) {
    return json({ error: "Embedding failed." }, 502);
  }

  return json({ embedding, model: "gte-small", dimensions: 384 });
});
