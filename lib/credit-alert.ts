// The owner alert, rebuilt on a signal that exists.
//
// `archive/owner-alert-d102/` holds the previous one. It emailed when the
// platform spend backstop tripped, D-104 deleted the backstop on 2026-08-06,
// and the module sat orphaned until it was archived on 2026-08-11. Its README
// entry says it was kept in case a credits-exhausted alert was ever built. This
// is that, and the claim machinery below is lifted from it deliberately rather
// than reinvented: the interval claim, the backdate on a failed send, and the
// reason the timer is not unref'd were all worked out there and were correct.
//
// What is different is the signal. The old one fired on an estimate the app
// computed about itself; this one fires on the gateway's own answer to
// "how much money is left", which is the number that actually takes the product
// down. See lib/ai/credits.ts for why that answer was believed unavailable.

import {
  creditsVerdict,
  formatCreditsAlert,
  readCredits,
  type CreditsReading,
  type CreditsVerdict,
} from "./ai/credits.ts";
import type { EmailMessage, SendResult } from "./email.ts";

export type AlertClaims = Map<string, number>;

// Six hours, the interval the archived module settled on: long enough that a
// balance sitting low costs four mails a day, short enough that a Tuesday
// morning trip is not first reported on Wednesday.
export const ALERT_INTERVAL_MS = 6 * 60 * 60_000;
// A failed send gives its slot back sooner, so a misconfigured mailbox does not
// silently disable the alert for six hours at a time while the code looks fine.
export const ALERT_RETRY_MS = 5 * 60_000;
export const SEND_TIMEOUT_MS = 4000;

// The claim key is the VERDICT, not a calendar window. A credit balance is not
// monthly, and the two states worth separating are "getting low" and "nearly
// gone": crossing from one to the other must earn its own mail rather than
// being suppressed as a duplicate of the first.
export function alertKey(verdict: CreditsVerdict): string {
  return `credits:${verdict}`;
}

export function isAlertDue(
  lastSentAt: number | null,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
): boolean {
  if (lastSentAt === null) return true;
  // A lastSentAt in the future (a clock that stepped back, or two instances
  // disagreeing) yields a negative age and therefore suppresses. That is the
  // right way to be wrong: a missed alert costs one delayed look, a spamming
  // alert is the failure this module exists to avoid.
  return atMs - lastSentAt >= intervalMs;
}

export function claimAlert(
  claims: AlertClaims,
  verdict: CreditsVerdict,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
): boolean {
  const key = alertKey(verdict);
  if (!isAlertDue(claims.get(key) ?? null, atMs, intervalMs)) return false;
  claims.set(key, atMs);
  return true;
}

export function releaseAlertForRetry(
  claims: AlertClaims,
  verdict: CreditsVerdict,
  atMs: number,
  intervalMs: number = ALERT_INTERVAL_MS,
  retryMs: number = ALERT_RETRY_MS,
): void {
  // Backdate rather than delete: deleting retries on the very next request and
  // hands the mail latency straight back to a player.
  claims.set(alertKey(verdict), atMs - Math.max(0, intervalMs - retryMs));
}

// Process memory, so the real bound is roughly one mail per instance per
// interval rather than exactly one. That is the same honest limitation the
// archived module recorded, and it is still the difference between a handful of
// duplicates and hundreds an hour. Exactly-once needs a claimed row.
const claims: AlertClaims = new Map();

export function resetCreditAlertsForTests(): void {
  claims.clear();
}

type AlertDeps = {
  claims?: AlertClaims;
  send?: (message: EmailMessage) => Promise<SendResult>;
  reading?: CreditsReading | null;
  atMs?: number;
  intervalMs?: number;
  retryMs?: number;
  timeoutMs?: number;
};

async function loadMailer(): Promise<(message: EmailMessage) => Promise<SendResult>> {
  const { sendEmail } = await import("./email.ts");
  return sendEmail;
}

/**
 * Never throws and never blocks anything that matters. The caller is finishing
 * a player's analysis; an unset address, a claimed slot, an unreadable balance
 * and a dead mailbox all end the same way here, quietly.
 *
 * Returns the verdict so a caller can log it, which is also what makes the
 * "unreadable" case visible instead of indistinguishable from "fine".
 */
export async function alertOwnerOnLowCredit(deps: AlertDeps = {}): Promise<CreditsVerdict> {
  try {
    const reading = deps.reading !== undefined ? deps.reading : await readCredits();
    const verdict = creditsVerdict(reading);
    if (verdict === "ok") return verdict;

    if (verdict === "unreadable") {
      // Deliberately not mailed. A billing endpoint that blips would otherwise
      // wake the owner every time, and the condition it would report is
      // "monitoring is down", not "money is gone".
      console.warn("[credit-alert] balance unreadable");
      return verdict;
    }

    const to = process.env.OWNER_ALERT_EMAIL?.trim();
    if (!to) return verdict;

    const atMs = deps.atMs ?? Date.now();
    if (!claimAlert(deps.claims ?? claims, verdict, atMs, deps.intervalMs)) return verdict;

    const { subject, text } = formatCreditsAlert(
      reading as CreditsReading,
      verdict as "low" | "critical",
    );
    const send = deps.send ?? (await loadMailer());

    // Bounded, and the timer is cleared in `finally` but never unref'd. An
    // unref'd timer does not keep the event loop alive, so when this race is
    // the only pending work the process can exit before it fires and the await
    // never settles. That turned up as a CANCELLED test in CI on the archived
    // module while passing locally.
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
      console.warn(`[credit-alert] ${verdict} alert not delivered: ${result.error}`);
      releaseAlertForRetry(
        deps.claims ?? claims,
        verdict,
        atMs,
        deps.intervalMs,
        deps.retryMs,
      );
    }
    return verdict;
  } catch (cause) {
    console.warn(
      `[credit-alert] alert path failed: ${cause instanceof Error ? cause.message : "unknown"}`,
    );
    return "unreadable";
  }
}
