import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * EVERY PAID CALL MUST FIT INSIDE ITS OWN ROUTE'S DEADLINE.
 *
 * A function the platform kills does not run its `catch`, its `finally`, or
 * anything else: on `/api/analyze` that means the quota refund and the
 * entitlement release are both skipped, so the player loses an hourly slot and
 * meets "an analysis is already running" for the next five minutes; on
 * `/api/coach` it means the question and the partial answer are never written
 * and both spent quota units buy a turn that left no trace, with no refund path
 * by design.
 *
 * The arithmetic that matters is per-attempt-timeout x (1 + maxRetries), and
 * the trap is that `maxRetries` counts RETRIES rather than attempts, so a `1`
 * doubles the call. `/api/players` has had this assertion since it shipped
 * (`lib/ai/players.test.ts`) and was the only route protected by it. Both
 * routes below were over budget when this file was written:
 *
 *   analyze: a re-read of 2 x 50s could start at 54s elapsed, inside a 120s
 *            function. Worst case 154s.
 *   coach:   4 attempts of 60s declared inside a 60s function, so the first
 *            attempt's own abort could never fire and the retries were dead
 *            code that only ever ended in a platform kill.
 *
 * Timeouts get tuned. This is what makes the next tuning safe.
 */

const ANALYZE = await readFile(
  new URL("../app/api/analyze/route.ts", import.meta.url),
  "utf8",
);
const COACH = await readFile(new URL("../app/api/coach/route.ts", import.meta.url), "utf8");
const CHAT = await readFile(new URL("./ai/chat.ts", import.meta.url), "utf8");

function num(source: string, pattern: RegExp, what: string): number {
  const hit = source.match(pattern);
  assert.ok(hit, `could not read ${what}; the budget assertion below is now blind`);
  return Number(hit[1].replaceAll("_", ""));
}

test("the analyze re-read cannot outlive the function that has to refund the slot", () => {
  const maxDurationS = num(ANALYZE, /maxDuration\s*=\s*(\d+)/, "analyze maxDuration");
  const perAttemptMs = num(ANALYZE, /READ_TIMEOUT_MS\s*=\s*([\d_]+)/, "READ_TIMEOUT_MS");
  const deadlineMs = num(ANALYZE, /RETRY_DEADLINE_MS\s*=\s*([\d_]+)/, "RETRY_DEADLINE_MS");
  const rereadRetries = num(
    ANALYZE,
    /REREAD_MAX_RETRIES\s*=\s*(\d+)/,
    "REREAD_MAX_RETRIES",
  );

  // The guard admits a re-read at any elapsed time strictly under the deadline,
  // so the worst start is the deadline itself.
  const worstMs = deadlineMs + (rereadRetries + 1) * perAttemptMs;
  assert.ok(
    worstMs < maxDurationS * 1000,
    `a re-read starting at the ${deadlineMs / 1000}s deadline can run to ` +
      `${worstMs / 1000}s, past maxDuration ${maxDurationS}s. The platform kill ` +
      "skips refundApiQuota and releaseAnalysisEntitlement.",
  );

  // And the first read, which is allowed its own internal retry, has to fit on
  // its own or the re-read never gets a chance to be the problem.
  const firstReadRetries = num(ANALYZE, /await readOnce\((\d+)\)/, "first-read retries");
  assert.ok(
    (firstReadRetries + 1) * perAttemptMs < maxDurationS * 1000,
    `the first read alone can run to ${((firstReadRetries + 1) * perAttemptMs) / 1000}s`,
  );
});

test("a coach turn aborts before the platform kills it, so the transcript is still written", () => {
  const maxDurationS = num(COACH, /maxDuration\s*=\s*(\d+)/, "coach maxDuration");
  // Anchored to the start of a CODE line. The first cut of this test matched
  // `maxRetries: 3` inside the comment above the call that explains the old
  // bug, and cheerfully reported the bug as still present. A regex over source
  // reads comments too.
  const perAttemptMs = num(COACH, /^\s*timeoutMs:\s*([\d_]+),/m, "coach timeoutMs");
  const retries = num(COACH, /^\s*maxRetries:\s*(\d+),/m, "coach maxRetries");

  const worstMs = (retries + 1) * perAttemptMs;
  assert.ok(
    worstMs < maxDurationS * 1000,
    `${retries + 1} attempts of ${perAttemptMs}ms run to ${worstMs / 1000}s, past ` +
      `maxDuration ${maxDurationS}s. Both quota units are spent by then and coach ` +
      "has no refund path.",
  );
});

test("the coach call states its own timeout instead of inheriting the client default", () => {
  // The original bug was an OMISSION, not a wrong number: no `timeoutMs` meant
  // lib/ai/chat.ts's 60s default, which happened to equal the whole route
  // budget, so the abort could never beat the platform kill. An explicit value
  // next to the retry count is what makes the assertion above possible at all.
  assert.match(
    COACH,
    /timeoutMs:\s*[\d_]+,\s+maxRetries:/,
    "the coach chat call must state timeoutMs next to maxRetries; inheriting " +
      "the client default is how the budget went unchecked in the first place",
  );

  const clientDefaultMs = num(CHAT, /DEFAULT_TIMEOUT_MS = ([\d_]+)/, "chat default timeout");
  const coachMaxDurationS = num(COACH, /maxDuration\s*=\s*(\d+)/, "coach maxDuration");
  assert.ok(
    clientDefaultMs >= coachMaxDurationS * 1000,
    "lib/ai/chat.ts's default is now shorter than coach's maxDuration, so an " +
      "omitted timeoutMs would no longer be a bug. Relax this test deliberately " +
      "rather than by accident.",
  );
});
