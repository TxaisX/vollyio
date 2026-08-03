// What an auth failure actually means, in words the player can act on.
//
// This module exists because the login action used to collapse every failure
// that was not a rate limit into "Email or password is incorrect." That string
// is a lie in the single most common new-player case: an account that exists,
// with the right password typed correctly, whose email was never confirmed.
//
// A real signup on 2026-08-03 hit exactly that. Six sign-ins in five minutes,
// every one of them `email_not_confirmed`, every one of them answered with
// "your password is wrong". He created the account twice more chasing a
// password that was never the problem, clicked two confirmation links that a
// later resend had already invalidated, and left. The auth service reports
// `email_not_confirmed` and `invalid_credentials` as distinct codes and always
// did; only this app threw the distinction away. See D-092.
//
// Every message here has to survive being read by someone who is already
// frustrated, so each one names the next action rather than the failure.

// The escape hatch, quoted verbatim from the link on the login page. A reset
// link confirms an unconfirmed email as a side effect of being used, so this
// one path recovers BOTH "I forgot my password" and "I never confirmed", which
// is why it is safe to point everything at it.
const RESET_HINT = 'use "Forgot your password?" below';

const RATE_LIMITED = "Too many attempts. Wait a minute and try again.";

function isRateLimited(status?: number, code?: string): boolean {
  return (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  );
}

export function loginErrorMessage(status?: number, code?: string): string {
  if (isRateLimited(status, code)) {
    return "Too many login attempts. Wait a bit and try again.";
  }
  // The whole point of this module. Do not fold this back into the default.
  if (code === "email_not_confirmed") {
    return `Your email is not confirmed yet, so we cannot sign you in. Open the newest Vollyio email and click its link. Older links stop working once a newer one is sent, so if you signed up more than once, only the last email counts. Cannot find it? ${RESET_HINT}, which confirms you as well.`;
  }
  return `Email or password is incorrect. If you signed up more than once, only the first password you chose was kept, so ${RESET_HINT}.`;
}

export function signupErrorMessage(status?: number, code?: string): string {
  if (isRateLimited(status, code)) {
    return "Too many signups this hour. Your answers are saved on this device. Wait a bit and try again.";
  }
  if (code === "weak_password") return "Use a stronger password and try again.";
  if (code === "user_already_exists" || code === "email_exists") {
    return `That email already has an account. Log in instead, or ${RESET_HINT} if you cannot get in.`;
  }
  return "Couldn't create your account. Try again.";
}

export function resetRequestErrorMessage(status?: number, code?: string): string {
  if (isRateLimited(status, code)) return RATE_LIMITED;
  return "Couldn't send the reset link. Try again in a moment.";
}

export function updatePasswordErrorMessage(status?: number, code?: string): string {
  if (isRateLimited(status, code)) return RATE_LIMITED;
  if (code === "weak_password") return "Use a stronger password and try again.";
  if (code === "same_password") {
    return "That is already your password. Choose a different one.";
  }
  // 401/403 here means the recovery session is gone: the link was used already,
  // expired, or was opened in a different browser than the form was submitted
  // from. Sending them back for a fresh link is the only thing that works.
  if (status === 401 || status === 403 || code === "session_not_found") {
    return "Your reset link has expired. Request a new one.";
  }
  return "Couldn't update your password. Try again.";
}

// Shown after a reset is requested, whether or not the address has an account.
// Never branch this on whether the user exists: the auth service deliberately
// answers /recover identically either way, and leaking the difference here
// would turn this form into an account-existence oracle.
export const RESET_SENT_MESSAGE =
  "If that email has a Vollyio account, a reset link is on its way. It expires in an hour, and only the newest one works.";

// The confirmation link is dead. It is nearly always a stale link rather than a
// truly expired one, because every resend invalidates the previous email, so
// the copy leads with the fix that works most often.
export const DEAD_LINK_MESSAGE =
  "That link is no longer valid. Each new email replaces the last one, so open the newest Vollyio email and try its link. If none of them work, request a fresh one below.";

// Shown on /login after a signup that still needs confirming.
export const CONFIRM_SENT_MESSAGE =
  "Check your email and click the link to confirm your account. If you signed up more than once, only the newest email works.";
