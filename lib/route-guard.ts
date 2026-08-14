// The proxy's routing decision, extracted so it can be tested without a request
// object. The proxy itself (proxy.ts) owns only session lookup and cookies.
//
// The security property that matters here: an unverified session and a missing
// or broken auth configuration are the SAME input, `userId = null`. That fails
// closed, because a protected path with no verified user is always sent to
// /login. The proxy never needs a separate "unconfigured" branch that could
// accidentally wave requests through.
// Everything here reads or writes a player's own data, so it fails closed to
// /login. Content that belongs to nobody does NOT belong on this list.
//
// `/drills` used to sit here and should not have. It renders `content/drills.ts`
// and touches no session, no profile and no analysis; it was gated because it
// lives in the (app) route group and inherited the group's posture rather than
// because anything on it was private. `/learn` is the same kind of page and was
// always public, which is what made the inconsistency visible. The drills page
// has declared `robots: { index: true, follow: true }` in its own metadata the
// whole time, so it was asking to be indexed while the guard sent crawlers to a
// login redirect.
// `/scoreboard` left this list when the feature was removed (D-088): the match
// tracker was a closed loop nothing else consumed, and the route no longer
// exists to guard.
export const PROTECTED = [
  "/dashboard",
  "/analyze",
  "/analysis",
  "/history",
  "/progress",
  "/plan",
  "/coach",
  "/goals",
  "/settings",
];

// D-118. The two protected paths an ANONYMOUS session may stand on, and the
// reason the list is these two and not more: the funnel gives a stranger one
// full read, so they need the flow that produces it and the page that renders
// it, and nothing else.
//
// This is a deny-by-default list on purpose. An anonymous user satisfies
// `auth.role() = 'authenticated'` in Postgres and looks signed in to every
// naive check in the app, so the distinction has to be made somewhere explicit
// or it is made nowhere. Adding a path here grants a session that cost nobody
// an email address the run of a page that assumes an account: `/settings` can
// change a plan, `/history` and `/progress` describe a body of work an
// anonymous user by definition does not have, and `/coach` spends model budget
// per message with no daily tier of its own.
export const ANONYMOUS_ALLOWED = ["/analyze", "/analysis"];

// Paths a signed-in player should never sit on, because each one's job is to get
// them signed in and they already are.
//
// `/reset-password` must NEVER join this list, however much it looks like it
// belongs. Verifying a recovery link creates a real session and THEN sends the
// player there to choose a password, so by the time they arrive they are signed
// in by this function's reckoning. Treating it as an entry path would bounce
// every reset to the dashboard and make the feature unreachable by the only
// route that reaches it. `/forgot` is left off for the same reason in reverse:
// a player with a stale session in one tab still has to be able to ask for a
// link. Pinned by route-guard.test.ts.
const ENTRY_PATHS = ["/", "/login", "/signup"];

export type GuardDecision = "pass" | "to-login" | "to-dashboard" | "to-signup";

export function guardDecision(
  path: string,
  userId: string | null,
  isAnonymous: boolean,
): GuardDecision {
  if (!userId) {
    return PROTECTED.some((p) => path.startsWith(p)) ? "to-login" : "pass";
  }

  // An anonymous session is a real session, so it can never be sent to /login:
  // the login page would bounce it straight back and the player would ping-pong
  // between two pages that both think the other one is responsible.
  //
  // /signup is where they go instead, and that is also why the entry-path
  // bounce below must not apply to them. Signing up IS the conversion for an
  // anonymous user: the same row gains an email and a password rather than a
  // second account being created beside it, so the read they just waited for
  // survives. Sending them to /dashboard instead would be sending them to a
  // page this same function refuses them.
  if (isAnonymous) {
    if (ANONYMOUS_ALLOWED.some((p) => path.startsWith(p))) return "pass";
    return PROTECTED.some((p) => path.startsWith(p)) ? "to-signup" : "pass";
  }

  return ENTRY_PATHS.includes(path) ? "to-dashboard" : "pass";
}
