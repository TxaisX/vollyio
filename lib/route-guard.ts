// The proxy's routing decision, extracted so it can be tested without a request
// object. The proxy itself (proxy.ts) owns only session lookup and cookies.
//
// The security property that matters here: an unverified session and a missing
// or broken auth configuration are the SAME input, `userId = null`. That fails
// closed, because a protected path with no verified user is always sent to
// /login. The proxy never needs a separate "unconfigured" branch that could
// accidentally wave requests through.
export const PROTECTED = [
  "/dashboard",
  "/analyze",
  "/analysis",
  "/history",
  "/drills",
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
