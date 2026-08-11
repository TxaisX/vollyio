// The owner alert for the platform spend backstop (docs/billing.md section 5).
//
// This module deliberately does not `import "server-only"` and does not pull in
// the mail client at module load. The part that has to be right is the claim
// logic below, it is pure, and it is exercised directly by `node --test`; a
// static server-only chain would make that impossible and would drag the mail
// provider's SDK into every request that merely asks the budget guard a
// question. The mail client keeps its own server-only guard and stays the only
// thing that touches the sending credential, so the secret boundary is
// unchanged. Nothing here belongs in a client bundle regardless.

import type { EmailMessage, SendResult } from "./email.ts";

export type BudgetAlertVerdict = "tripped" | "unavailable";

export type BudgetAlert = {
  verdict: BudgetAlertVerdict;
  // The ceiling the guard was enforcing, in USD.
  capUsd: number;
  // Month-to-date estimate, or null when the aggregate could not be read or
  // priced, which is exactly the case the "unavailable" verdict describes.
  estimatedUsd: number | null;
  // Injected by the caller so the month key, the claim, and the mail all agree
  // on one instant and none of them reads the clock on its own.
  atMs: number;
};

export type AlertClaims = Map<string, number>;

// Six hours. Long enough that a month spent tripped costs the owner four mails
// a day, short enough that a trip at 9am is not first reported tomorrow.
export const ALERT_INTERVAL_MS = 6 * 60 * 60_000;

// The UTC calendar month, the same window the backstop and the per-user
// allowance both use, so July's trip and August's trip are separate conditions
// and the month rollover always earns a fresh mail.
export function utcMonthKey(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 7);
}

export function alertKey(verdict: BudgetAlertVerdict, atMs: number): string {
  return `${utcMonthKey(atMs)}:${verdict}`;
}

// Pure. Given when this exact condition was last mailed about, is another mail
// due? Takes the instant as an argument and never reads the clock, so the
// interval is testable without waiting six hours for it.
//
// A `lastSentAt` in the future (a clock that stepped backwards, or two
// instances disagreeing) produces a negative age and therefore suppresses. That
// is the right way to be wrong here: the cost of a missed alert is one delayed
// look at a dashboard, the cost of a spamming alert is the failure this whole
// module exists to prevent.
export function isAlertDue(
  lastSentAt: number | null,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
): boolean {
  if (lastSentAt === null) return true;
  return atMs - lastSentAt >= intervalMs;
}

// Takes the slot for (month, verdict) and records the send instant when it
// wins. Mutates the map it is handed rather than a module singleton so a test
// owns its own state and the interval behaviour can be driven by a fake clock.
export function claimAlert(
  claims: AlertClaims,
  verdict: BudgetAlertVerdict,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
): boolean {
  const key = alertKey(verdict, atMs);
  if (!isAlertDue(claims.get(key) ?? null, atMs, intervalMs)) return false;
  claims.set(key, atMs);
  return true;
}

// How long a FAILED send waits before it may be retried. The claim is taken
// before the send so a slow mailbox cannot add its latency to every request,
// but leaving a failed claim in place for the full interval means a
// misconfigured mail key silently disables the alert for six hours at a time
// while the code looks healthy. Rolling the claim back to this shorter window
// keeps a dead mailbox from retrying on every single request without pretending
// the owner was told.
export const ALERT_RETRY_MS = 5 * 60_000;

export function releaseAlertForRetry(
  claims: AlertClaims,
  verdict: BudgetAlertVerdict,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
  retryMs: number = ALERT_RETRY_MS,
): void {
  const key = alertKey(verdict, atMs);
  // Backdate the claim so it comes due again after retryMs rather than
  // intervalMs. Never delete it outright: that would retry on the very next
  // request and hand the latency back to the player.
  claims.set(key, atMs - Math.max(0, intervalMs - retryMs));
}

// One alert per condition per interval, claimed in process memory.
//
// A serverless deployment runs many instances and each one gets its own copy of
// this map, so the bound is roughly one mail per instance per interval, not
// exactly one. That is still the difference between a handful of duplicates and
// the hundreds an hour of tripped traffic would otherwise send, which is the
// failure worth preventing. Exactly-once needs the claim to live in the
// database instead, taken the way `profiles.welcome_email_sent_at` claims the
// welcome mail: a conditional update only one caller can win, with the send
// happening after the row is claimed, never before. That is a migration and it
// is the follow-up, not this.
const claims: AlertClaims = new Map();

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Written for the owner, not a player: blunt, technical, and it names the one
// change that clears the condition rather than describing it. No provider or
// vendor name appears here, same rule as every other string in the repo.
export function formatBudgetAlert(alert: BudgetAlert): { subject: string; text: string } {
  const month = utcMonthKey(alert.atMs);
  const facts = [
    `Verdict:       ${alert.verdict}`,
    `Month to date: ${
      alert.estimatedUsd === null ? "unknown" : `${usd(alert.estimatedUsd)} estimated`
    }`,
    `Monthly cap:   ${usd(alert.capUsd)}`,
    `Window:        ${month}, UTC calendar month`,
  ].join("\n");

  if (alert.verdict === "tripped") {
    return {
      subject: `Vollyio spend backstop tripped (${month})`,
      text: [
        "The platform spend backstop tripped. Every analyze request is now",
        "answered with the calm out-of-capacity 503, and no clip is counted",
        "against anyone's allowance while it holds.",
        "",
        facts,
        "",
        "Fix: raise ANALYZE_MONTHLY_BUDGET_USD in the deployment environment and",
        "redeploy. Left alone it clears itself when the UTC month rolls over.",
      ].join("\n"),
    };
  }

  return {
    subject: `Vollyio spend backstop cannot read spend (${month})`,
    text: [
      "The platform spend backstop could not read or price month-to-date spend,",
      "so it failed closed. Every analyze request is answered with the calm",
      "out-of-capacity 503 until the aggregate reads again. This is not proof of",
      "overspend, it is the guard refusing to guess.",
      "",
      facts,
      "",
      "Fix: get analyze_usage_month returning rows again, and confirm every model",
      "in those rows still has a rate in lib/ai/pricing.ts. A model with no rate",
      "reads as unavailable on purpose, because a silent zero would understate",
      "spend in the one direction an estimate must never err.",
    ].join("\n"),
  };
}

// The alert is awaited inside a player's request, so the mail send gets a hard
// ceiling. The mail client itself sets no request timeout.
export const SEND_TIMEOUT_MS = 4000;

type AlertDeps = {
  claims?: AlertClaims;
  send?: (message: EmailMessage) => Promise<SendResult>;
  intervalMs?: number;
  retryMs?: number;
  timeoutMs?: number;
};

// The mail client is server-only and carries the provider SDK with it. Loading
// it at the moment of a send rather than at module load keeps it out of the
// budget guard's hot path, out of its tests, and out of any bundle that only
// wants the claim logic.
async function loadMailer(): Promise<(message: EmailMessage) => Promise<SendResult>> {
  const { sendEmail } = await import("./email.ts");
  return sendEmail;
}

// Never throws. The caller is a request already on its way to a 503: the
// verdict is the product behaviour and this mail is a side effect, so an unset
// address, an already-claimed slot, a mail client that will not load, and a
// dead mailbox all end the same way here, quietly.
export async function alertOwnerBudget(alert: BudgetAlert, deps: AlertDeps = {}): Promise<void> {
  try {
    const to = process.env.OWNER_ALERT_EMAIL?.trim();
    if (!to) return;

    // Claimed before the send, on purpose. A mailbox that fails slowly would
    // otherwise add its timeout to every request for as long as the backstop
    // holds; burning one interval on a failed send is the cheaper mistake.
    if (!claimAlert(deps.claims ?? claims, alert.verdict, alert.atMs, deps.intervalMs)) return;

    const { subject, text } = formatBudgetAlert(alert);
    const send = deps.send ?? (await loadMailer());

    // Bound the send. The mail client has no request timeout of its own, so an
    // unreachable mailbox would hold this open on Node's default socket
    // behaviour, and this is awaited inside a player's analyze request. The
    // player is already getting a 503; they must not also wait on our mail.
    //
    // The timer is NOT unref'd, and is always cleared. An unref'd timer does not
    // keep the event loop alive, so when this race is the only pending work the
    // process can exit before it fires and the await never settles. That is not
    // theoretical: it turned up as a CANCELLED test in CI (pass 266, fail 0,
    // cancelled 1, exit 1) while passing locally, because local runs happened to
    // have other work keeping the loop busy. Clearing in `finally` is what stops
    // the un-unref'd timer dangling for the full timeout after a fast send.
    const timeoutMs = deps.timeoutMs ?? SEND_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: SendResult;
    try {
      result = await Promise.race([
        send({ to, subject, text }),
        new Promise<SendResult>((resolve) => {
          timer = setTimeout(() => resolve({ ok: false, error: "timed out" }), timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    if (!result.ok) {
      console.warn(`[owner-alert] ${alert.verdict} alert not delivered: ${result.error}`);
      // Give the slot back on a short retry window. A permanently broken
      // mailbox otherwise leaves the claim standing for the full interval and
      // the alert silently never fires again.
      releaseAlertForRetry(
        deps.claims ?? claims,
        alert.verdict,
        alert.atMs,
        deps.intervalMs,
        deps.retryMs,
      );
    }
  } catch (cause) {
    console.warn(
      `[owner-alert] alert path failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
    );
  }
}

export function resetOwnerAlertsForTests(): void {
  claims.clear();
}
