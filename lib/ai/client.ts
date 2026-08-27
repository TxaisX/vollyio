import "server-only";

/**
 * Every model this product calls, which since D-131 is ONE id on every surface.
 *
 * There is no SDK here and no client to construct (D-098). The id resolves on
 * one OpenAI-shaped gateway reached by plain fetch from `lib/ai/vision.ts`
 * (pixels) and `lib/ai/chat.ts` (text). One credential, `OPENROUTER_API_KEY`,
 * covers all four surfaces, and since D-131 it is charged nothing.
 *
 * These are checked-in constants and deliberately NOT environment variables
 * (D-004): a typo in a model string would otherwise surface as a runtime 404 on
 * a call path instead of in review.
 *
 * WIND-DOWN, 2026-08-27 (D-131). Vollyio is no longer sold. The owner's
 * direction was to take every paid model off and run on a free one, and to
 * keep the privacy floor in `lib/ai/routing.ts` (no provider that retains or
 * trains on footage; the audience starts at 13). Of the free ids on the
 * gateway that accept video, exactly one answered under that floor when probed
 * on 2026-08-27: this one. Gemma 4 was rate-limited to nothing and the Nvidia
 * omni id has no endpoint that refuses training.
 *
 * What was measured before shipping it, on one production clip through the
 * shipped rubric: one empty reply (covered by the route's re-read) and one
 * CORRECT refusal that named the marked player as the setter rather than the
 * attacker, which the schema then rejected for lacking a score. The schema in
 * `lib/ai/simple-rubric.ts` now allows a refusal to omit the score and the
 * lists, and the route refuses a ratable reply that lacks them. Nothing about
 * the score distribution has been measured on this id (evals/CALIBRATION.md
 * describes the id it replaces), and nothing needs to be: no number this
 * product prints is sold any more.
 *
 * ONE ID IS NOT ONE BEHAVIOUR (D-096) still applies. Free ids are also
 * rate-limited upstream and answer 429 under load; the vision layer retries
 * those with backoff, and a read that never lands is refunded as busy.
 */

/** The one call path that READS PIXELS: the whole clip for `/api/analyze` and one frame for `/api/players`. */
export const VISION_MODEL = "minimax/minimax-m3:free";

/** The one call path that WRITES TEXT: coach chat (D-096) and the weekly plan (D-098). */
export const CHAT_MODEL = "minimax/minimax-m3:free";
