export type CoachingErrorKind = "capacity" | "busy" | "unknown";

// Billing/credit/spend-cap refusals. These happen BEFORE the coaching service
// does any billable work, so the analysis was not charged and can be retried
// later for free once the account's limit is raised. Keyed to the two shapes
// seen in production (a 400 "credit balance is too low" and a usage/spend cap);
// confirm against the live error body when the cap next lifts.
const CAPACITY_SIGNAL =
  /credit balance|spend limit|spend cap|usage limit|monthly limit|monthly cap|out of capacity|insufficient (credit|balance|funds)|billing/i;

// Classify a failure from the coaching service so the route can respond
// honestly: a capacity outage tells the player their clip was not counted and
// refunds their hourly slot; a transient busy signal asks them to retry soon;
// anything else stays a generic failure. Kept pure and status+message-only so
// the classification can be unit-tested without the SDK error object.
export function classifyCoachingError(input: {
  status?: number | null;
  message?: string | null;
}): CoachingErrorKind {
  const status = input.status ?? null;
  const message = input.message ?? "";
  // The class requires BOTH a billing signal and a plausible refusal status, so
  // a stray "credit balance" substring in an unrelated 500 cannot trigger a
  // refund or the wrong message.
  if (
    CAPACITY_SIGNAL.test(message) &&
    (status === 400 || status === 402 || status === 429)
  ) {
    return "capacity";
  }
  if (status === 429 || status === 529) return "busy";
  return "unknown";
}
