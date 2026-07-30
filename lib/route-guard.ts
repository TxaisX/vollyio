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
export const PROTECTED = [
  "/dashboard",
  "/analyze",
  "/analysis",
  "/history",
  "/progress",
  "/plan",
  "/coach",
  "/scoreboard",
  "/goals",
  "/settings",
];

// Paths a signed-in player should never sit on, because each one's job is to get
// them signed in and they already are.
const ENTRY_PATHS = ["/", "/login", "/signup"];

export type GuardDecision = "pass" | "to-login" | "to-dashboard";

export function guardDecision(path: string, userId: string | null): GuardDecision {
  if (!userId) {
    return PROTECTED.some((p) => path.startsWith(p)) ? "to-login" : "pass";
  }
  return ENTRY_PATHS.includes(path) ? "to-dashboard" : "pass";
}
