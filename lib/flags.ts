// Coach chat, and the switch that can take it away again.
//
// It was dark from D-047 until 2026-08-06, while the spend behind it was
// uncapped and unmeasured. Both of those changed: the paid call now runs on the
// gateway at roughly a seventieth of the old cost per answer (D-096), it is
// bounded by an atomic 20 per hour and 30 per 24 hours, and the prompt's four
// guard behaviours were probed twelve times each on the shipping model. So the
// default flips: coach is ON unless someone deliberately turns it off.
//
// The switch survives the flip rather than being deleted, and the asymmetry is
// the point. One prepaid balance now pays for every model call in the app
// (D-098), and coach is the highest-frequency path on it, so the thing most
// likely to drain analysis is chat traffic. `NEXT_PUBLIC_COACH_ENABLED=false`
// is how that gets stopped without a code change, and it closes the nav entry,
// the page and the route together.
//
// NEXT_PUBLIC so the client nav and the server surfaces read one build-time
// value. Build-time is also the catch: flipping it in the host requires a
// redeploy to take effect, because the value is inlined into the bundle.
export const COACH_ENABLED = process.env.NEXT_PUBLIC_COACH_ENABLED !== "false";
