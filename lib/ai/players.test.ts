import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Player spotting reads pixels, so it belongs to the vision provider (D-093)
// and not to the coaching service. Asserted against the route source because
// a Next route file may export nothing but its handlers, so there is no
// function to call and no constant to import: the source IS the contract.

const routeSource = await readFile(
  new URL("../../app/api/players/route.ts", import.meta.url),
  "utf8",
);

test("spotting goes to the vision provider, with nothing left of the old path", async () => {
  assert.match(routeSource, /from "@\/lib\/ai\/vision"/);
  assert.match(routeSource, /await readFrames\(/);
  assert.match(routeSource, /model: VISION_MODEL/);
  // The three names that would put this route back on the coaching service.
  // VISION_MODEL carries a slash the coaching SDK would 404 on (lib/ai/client.ts),
  // so a half-migration here is a runtime failure rather than a type error.
  assert.doesNotMatch(routeSource, /@anthropic-ai\/sdk/);
  assert.doesNotMatch(routeSource, /\bcoach\(\)/);
  assert.doesNotMatch(routeSource, /ANALYZE_MODEL|ANALYZE_EFFORT/);
});

test("the output ceiling leaves room for reasoning billed before any content", () => {
  // D-096: one model id resolves across several upstreams, and the ones that
  // reason spend max_tokens on that reasoning BEFORE the first character of
  // content. Measured on this exact prompt, a two-entry reply cost up to 920
  // output tokens with 813 of them reasoning, so a ceiling anywhere near the
  // size of the answer returns an empty string on the upstreams that think
  // hardest. That failure is silent here: the route degrades to an empty
  // candidate list, so nothing but this test would notice the picker going
  // permanently blank.
  const ceiling = routeSource.match(/maxTokens:\s*(\d+)/);
  assert.ok(ceiling, "the read must state a max_tokens ceiling");
  assert.ok(
    Number(ceiling[1]) >= 8192,
    `max_tokens is ${ceiling[1]}; reasoning alone has been measured above 800 on this prompt`,
  );
});

test("every attempt plus its retry fits inside the route's own deadline", () => {
  // A function the platform kills mid-call cannot return the empty list the
  // framing card falls back to, and the quota unit is already spent by then.
  const duration = routeSource.match(/maxDuration\s*=\s*(\d+)/);
  const timeout = routeSource.match(/SPOT_TIMEOUT_MS\s*=\s*([\d_]+)/);
  const retries = routeSource.match(/maxRetries:\s*(\d+)/);
  assert.ok(duration && timeout && retries);
  const attempts = Number(retries[1]) + 1;
  const perAttemptMs = Number(timeout[1].replaceAll("_", ""));
  assert.ok(
    (attempts * perAttemptMs) / 1000 < Number(duration[1]),
    `${attempts} attempts of ${perAttemptMs}ms exceed maxDuration ${duration[1]}s`,
  );
});

test("spotting degrades to an empty list and never blocks the tap-anywhere path", () => {
  // Every exit that is not a rejected request answers with a players array, so
  // the client's `Array.isArray(players)` branch always has something to read
  // and the manual tap stays available. The 4xx guards are the exception on
  // purpose: those are requests the client never makes.
  for (const guard of [
    /hasTrustedMutationOrigin\(req\)/,
    /supabase\.auth\.getUser\(\)/,
    /consumeApiQuota\(supabase, "coach"\)/,
    /isJpegPayload\(data, MAX_SPOT_FRAME_BYTES\)/,
  ]) {
    assert.match(routeSource, guard);
  }
  assert.match(routeSource, /MAX_SPOT_FRAME_BYTES = 1_500_000/);
  // The base64 bound sits on the string itself, so an oversized frame is
  // rejected before it is ever decoded.
  assert.match(routeSource, /\.max\(Math\.ceil\(MAX_SPOT_FRAME_BYTES \/ 3\) \* 4 \+ 4\)/);
  // A quota refusal and a provider failure both return candidates, not an error
  // body the framing card would have to special-case.
  assert.match(routeSource, /\{ players: \[\] \}, \{ status: quota\.ok \? 429 : 503 \}/);
  assert.match(routeSource, /\{ players: \[\] \}, \{ status: 200 \}/);
  // A deployment without the credential must not spend quota or 500 the card.
  assert.match(routeSource, /!hasVisionKey\(\)/);
});

test("the failure log stays server-side and the player-visible reply stays neutral", () => {
  // classifyCoachingError reads {status, message}; VisionError carries both
  // plus the gateway request id, which is the only way an outage is separable
  // from a bad frame after the fact.
  assert.match(routeSource, /err instanceof VisionError/);
  assert.match(routeSource, /console\.error\("\[players\] spotting call failed"/);
  for (const field of [/status: visionErr\?\.status/, /requestId: visionErr\?\.requestId/]) {
    assert.match(routeSource, field);
  }
  // Nothing the player receives from the failure path carries prose at all, so
  // there is no string for a vendor or model name to reach.
  const catchBlock = routeSource.slice(routeSource.indexOf("} catch (err) {"));
  assert.doesNotMatch(catchBlock, /error:/);
});

test("the candidate list is capped and its labels are descriptions, never names", () => {
  // D-036: the picker offers kit-and-position descriptions. A name would be an
  // identity claim the frame cannot support, about a person who did not consent
  // to being identified, so the prompt forbids it and the schema keeps labels
  // too short to be a sentence about who someone is.
  assert.match(routeSource, /\.max\(6\)/);
  assert.match(routeSource, /label: z\.string\(\)\.max\(80\)/);
  assert.match(routeSource, /never a name or a guess about identity/);
  assert.match(routeSource, /up to six/);
});
