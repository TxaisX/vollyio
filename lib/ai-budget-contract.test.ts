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

  // BACKOFF IS PART OF THE BUDGET. lib/ai/vision.ts honours an upstream
  // Retry-After up to this ceiling between attempts, and the first cut of this
  // test left it out, which is how the first read stayed over budget through a
  // commit that claimed to have fixed it.
  const backoffCeilingMs = num(
    ANALYZE,
    /RETRY_AFTER_CEILING_MS\s*=\s*([\d_]+)/,
    "RETRY_AFTER_CEILING_MS",
  );

  // The guard admits a re-read at any elapsed time strictly under the deadline,
  // so the worst start is the deadline itself.
  const worstMs =
    deadlineMs + (rereadRetries + 1) * perAttemptMs + rereadRetries * backoffCeilingMs;
  assert.ok(
    worstMs < maxDurationS * 1000,
    `a re-read starting at the ${deadlineMs / 1000}s deadline can run to ` +
      `${worstMs / 1000}s, past maxDuration ${maxDurationS}s. The platform kill ` +
      "skips refundApiQuota and releaseAnalysisEntitlement.",
  );

  // And the first read, which is allowed its own internal retry, has to fit on
  // its own or the re-read never gets a chance to be the problem.
  const firstReadRetries = num(ANALYZE, /await readOnce\((\d+)\)/, "first-read retries");
  const firstReadWorstMs =
    (firstReadRetries + 1) * perAttemptMs + firstReadRetries * backoffCeilingMs;
  assert.ok(
    firstReadWorstMs < maxDurationS * 1000,
    `the first read alone can run to ${firstReadWorstMs / 1000}s (${firstReadRetries + 1} ` +
      `attempts of ${perAttemptMs}ms plus ${firstReadRetries} backoff of up to ` +
      `${backoffCeilingMs}ms), past maxDuration ${maxDurationS}s`,
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

  // Coach bounds its retries by a WINDOW rather than a count, so the worst case
  // is "the last retry launched just inside the window, then a full attempt".
  const windowMs = num(COACH, /^\s*retryWindowMs:\s*([\d_]+),/m, "coach retry window");
  const worstMs = retries > 0 ? windowMs + perAttemptMs : perAttemptMs;
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
    /timeoutMs:\s*[\d_]+,\s+retryWindowMs:\s*[\d_]+,\s+maxRetries:/,
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

/**
 * A SERVER ACTION INHERITS ITS ROUTE SEGMENT'S CONFIG, NOT THE SEGMENT IT WAS
 * WRITTEN FOR.
 *
 * `generateWeeklyPlan` lives under /plan, whose page declares maxDuration 180
 * because the action's worst case is three 50s attempts plus backoff. Onboarding
 * then imported the same action and ran it from /welcome, which declared no
 * maxDuration at all, so it executed against the platform default of a few
 * seconds.
 *
 * The cost is not a slow page. `reserve_weekly_plan` claims the row BEFORE the
 * action spends, and a killed function never reaches `release_weekly_plan`, so
 * a brand new account claimed its own first week and then lost it for the full
 * ten minute expiry (D-072) on the least patient path in the product.
 *
 * `after()` work is bounded by the same segment ceiling, so scheduling it there
 * does not escape this.
 */
test("every segment that runs the weekly-plan action declares enough time for it", async () => {
  const planActions = await readFile(
    new URL("../app/(app)/plan/actions.ts", import.meta.url),
    "utf8",
  );
  const perAttemptMs = num(planActions, /timeoutMs:\s*([\d_]+)/, "plan action timeout");
  const retries = num(planActions, /maxRetries:\s*(\d+)/, "plan action retries");
  const worstS = ((retries + 1) * perAttemptMs) / 1000;

  // THE (app) LAYOUT IS THE REAL CALLER and was missed the first time.
  // `components/funnel-handoff.tsx` calls `applyFunnel`, and the layout mounts
  // it on every page in the group, so the action can be invoked from
  // /dashboard, /analyze or anywhere else under it. A per-page list could
  // never be complete; the layout is what actually has to carry the budget.
  const segments = [
    "layout.tsx",
    "plan/page.tsx",
    "welcome/page.tsx",
  ];
  for (const segment of segments) {
    const page = await readFile(
      new URL(`../app/(app)/${segment}`, import.meta.url),
      "utf8",
    );
    const declared = page.match(/maxDuration\s*=\s*(\d+)/);
    assert.ok(
      declared,
      `app/(app)/${segment} runs the weekly-plan action but declares no ` +
        `maxDuration, so it inherits the platform default against a ${worstS}s worst case`,
    );
    assert.ok(
      Number(declared[1]) > worstS,
      `app/(app)/${segment} allows ${declared[1]}s for an action whose ` +
        `worst case is ${worstS}s; the kill skips release_weekly_plan and locks the week`,
    );
  }
});
