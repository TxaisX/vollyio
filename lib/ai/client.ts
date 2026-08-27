import "server-only";

/**
 * Every model this product calls, which since D-132 is ONE free id on every
 * surface.
 *
 * There is no SDK here and no client to construct (D-098). The id resolves on
 * one OpenAI-shaped gateway reached by plain fetch from `lib/ai/vision.ts`
 * (pixels) and `lib/ai/chat.ts` (text). One credential, `OPENROUTER_API_KEY`,
 * covers all four surfaces and is charged nothing for this id.
 *
 * These are checked-in constants and deliberately NOT environment variables
 * (D-004): a typo in a model string would otherwise surface as a runtime 404 on
 * a call path instead of in review.
 *
 * WHY THIS ID (D-132, 2026-08-27). Vollyio is closed as a product (D-131) and
 * the owner's standing direction is no paid model at all, with the privacy
 * floor in `lib/ai/routing.ts` kept (no provider that retains or trains on
 * footage; the audience starts at 13). Of the free video-capable ids on the
 * gateway, this is the only one that answers under that floor: Gemma 4 is
 * rate-limited to nothing and the Nvidia omni id has no endpoint that refuses
 * training.
 *
 * WHAT IT COSTS IN BEHAVIOUR, measured on production clips the same day. It
 * ignores `response_format` unless also told in words (`JSON_ONLY` in
 * app/api/analyze/route.ts), and it spells the schema its own way: `rating`
 * for the score, `not_ratable` for the verdict, `drills` for the slugs,
 * numbers where strings were asked for, and keyed objects where lists were.
 * `normalizeSimpleRating` in lib/ai/simple-rubric.ts maps every spelling it
 * has been seen to use onto the fields the product reads, and invents nothing.
 * Reads take 40 to 100 s against the paid id's 10 to 16, which is why the
 * analyze route's budget is 100 s a read inside a 300 s function. The free
 * endpoint also answers 429 under load and 502 when its upstream is down;
 * both are retried with backoff, and a read that never lands is refunded.
 *
 * Nothing about the score distribution has been measured on this id
 * (evals/CALIBRATION.md describes the paid reader) and nothing needs to be:
 * no number this product prints is sold. The paid ids it replaced were
 * `google/gemini-3.7-flash` (vision) and `deepseek/deepseek-v4-flash` (text);
 * both rate rows stay in lib/ai/pricing.ts so history still prices.
 *
 * ONE ID IS NOT ONE BEHAVIOUR (D-096) still applies: never conclude anything
 * from a single passing run.
 */

/** The one call path that READS PIXELS: the whole clip for `/api/analyze` (D-097) and one frame for `/api/players` (D-093). */
export const VISION_MODEL = "minimax/minimax-m3:free";

/** The one call path that WRITES TEXT: coach chat (D-096) and the weekly plan (D-098). */
export const CHAT_MODEL = "minimax/minimax-m3:free";
