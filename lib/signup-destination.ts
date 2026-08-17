// D-121. Where an anonymous player lands after claiming their account.
//
// The wall on /analysis/[id] sends them to /signup carrying the breakdown they
// were refused, and the whole point of converting on that page is that the
// thing they wanted is waiting on the other side. So the claim branch of the
// signup action returns them to that exact page instead of /welcome.
//
// The value rides the form as a hidden field, which makes it caller-controlled,
// so it is allowlisted to the one shape the wall ever writes: an absolute
// app-local path to a single analysis. Anything else, including a full URL, a
// protocol-relative //host, or a path with a query string, falls back to
// /welcome. The failure direction is deliberate: a mangled value costs the
// player one navigation, an open redirect costs them wherever it points.
const CLAIM_NEXT = /^\/analysis\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function claimDestination(next: unknown): string {
  if (typeof next !== "string") return "/welcome";
  return CLAIM_NEXT.test(next) ? next : "/welcome";
}
