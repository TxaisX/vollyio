import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// lib/ai/vision.ts is server-only and its request function is not exported, so
// this asserts against the source, the same shape lib/billing.test.ts and
// lib/security-contract.test.ts use for the same reason. Every assertion below
// is a property that was WRONG at some point and cost something real.

const SRC = await readFile(new URL("./vision.ts", import.meta.url), "utf8");

// THE BUG THIS EXISTS FOR, measured at roughly 1 live read in 19.
//
// The body was read with `res.json().catch(() => null)`. `AbortSignal.timeout`
// aborts the response BODY STREAM, not only the connection, so a 200 whose body
// stalls past the deadline rejects after the status line has already arrived.
// That catch turned a timeout into `parsed: null`, which meant the retry never
// fired (a timeout was not on the throw path at all) and `/api/analyze` read it
// as "the model returned something unparseable": it spent a SECOND paid read on
// the re-try and then answered 502, when the truth was a timeout that
// classifyCoachingError would have called `busy` and refunded. The player lost
// an analysis slot to a network stall.
test("a body that never finishes arriving is a transport failure, not a bad reply", () => {
  // Anchored on the ASSIGNMENT, not on the mention: the comment above the fix
  // quotes the old call verbatim, and a test that forbade the words would
  // forbid explaining what went wrong.
  assert.doesNotMatch(
    SRC,
    /=\s*await\s+res\s*\.\s*json\s*\(\s*\)\s*\.\s*catch/,
    "reading the body with .json().catch() swallows an aborted body stream",
  );
  // Read as text inside a guarded block, so the abort is catchable and lands on
  // the same retry-or-throw path a dropped connection does.
  assert.match(SRC, /bodyText\s*=\s*await\s+res\.text\(\)/);
  assert.match(SRC, /throw new VisionError\(`vision request failed/);
});

// The other half of the same fix: a genuine JSON SYNTAX error is NOT a
// transport failure. That one really is a reply the model got wrong, and
// whether to spend another paid read on it is the caller's decision, not this
// layer's. Collapsing the two together would make every malformed reply retry
// silently at double cost.
test("a malformed reply still degrades instead of throwing", () => {
  assert.match(SRC, /payload\s*=\s*JSON\.parse\(bodyText\)/);
  assert.match(SRC, /catch\s*\{\s*\n\s*payload = null;/);
});

// The abort is what makes the above reachable. If this ever goes away the
// failure mode changes shape and the comment above stops being true.
test("every attempt is bounded by a deadline", () => {
  assert.match(SRC, /signal:\s*AbortSignal\.timeout\(timeoutMs\)/);
});

// D-097: the video upstream is pinned and the frame upstream deliberately is
// not. Gemini's AI Studio upstream takes YouTube links only while Vertex takes
// base64 data URLs, so an unpinned VIDEO request succeeds or fails by routing
// luck. Frames work on either, and leaving them unpinned keeps the capacity.
test("the video read pins its upstream and the frame read does not", () => {
  assert.match(SRC, /provider:\s*\{\s*only:\s*\["google-vertex"\]\s*\}/);
  // readFrames passes pinProvider false, readVideo passes true. Assert both
  // call sites rather than the flag's existence, because a default flip would
  // satisfy a weaker test and silently pin every image request.
  assert.match(SRC, /chatBody\(opts,\s*content,\s*false\)/);
  assert.match(SRC, /chatBody\(opts,\s*content,\s*true\)/);
});

// D-096: one model id resolves across several upstreams that behave
// differently, and reasoning bills against max_tokens BEFORE any content.
// Without these two fields on the telemetry row an empty read cannot be told
// apart from a refusal, and there is no evidence from which to pick a ceiling.
test("the resolved upstream and its reasoning tokens are recorded", () => {
  assert.match(SRC, /provider:\s*typeof provider === "string"/);
  assert.match(SRC, /reasoning_tokens:\s*num\(completion\.reasoning_tokens\)/);
  assert.match(SRC, /completion_tokens_details/);
});

// A 402 from this gateway means the prepaid balance is dry. classifyCoachingError
// reads it as a capacity outage, which is what refunds the player's slot and
// tells them their clip was not counted, so it must NOT be retried into a
// timeout: the message has to reach the caller fast.
test("an account or request problem is never retried", () => {
  assert.match(SRC, /function isRetryable\(status: number\): boolean \{/);
  assert.match(SRC, /status === 408 \|\| status === 429 \|\| \(status >= 500/);
  // 400/401/402/403 are absent from the retry set by construction above; assert
  // the intent is stated so a future edit has to argue with it.
  assert.match(SRC, /NOT retried: 400\/401\/402\/403/);
});

// No vendor or model name may reach a player. This module is the one place the
// vendor is named at all, so the boundary is that callers translate, never that
// this file is careful.
test("the module states that nothing it produces reaches a player", () => {
  assert.match(SRC, /callers translate a failure into the vendor-neutral/);
});
