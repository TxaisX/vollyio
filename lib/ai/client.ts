import "server-only";

/**
 * Every model this product calls, which is two of them.
 *
 * There is no SDK here and no client to construct (D-098). Both ids resolve on
 * one OpenAI-shaped gateway reached by plain fetch from `lib/ai/vision.ts`
 * (pixels) and `lib/ai/chat.ts` (text). One credential, `OPENROUTER_API_KEY`,
 * pays for all four surfaces, and the prepaid balance behind it is the hard
 * ceiling on what this product can ever spend.
 *
 * These are checked-in constants and deliberately NOT environment variables
 * (D-004): a typo in a model string would otherwise surface as a runtime 404 on
 * a paid call path instead of in review.
 *
 * WIND-DOWN, 2026-08-27 (D-131). Vollyio is no longer sold. The owner's
 * direction was to take every paid model off and run on a free one while
 * keeping the privacy floor in `lib/ai/routing.ts` (no provider that retains
 * or trains on footage; the audience starts at 13). That was tried and
 * MEASURED, and it does not work: of the free video-capable ids on the
 * gateway, exactly one answers under that floor (`minimax/minimax-m3:free`),
 * and on the shipped rubric it produced no usable read in 5 of 5 production
 * clips offline (score omitted, schema broken, gateway 502, timeout, empty
 * lists) and 3 of 3 attempts on the live route. So the two ids below are the
 * ones that were shipping before the attempt. Together they cost about a
 * dollar a month at the product's current use, and the balance caps them.
 *
 * `JSON_ONLY` in app/api/analyze/route.ts and the optional fields in
 * lib/ai/simple-rubric.ts date from the same attempt and stay: both are
 * harmless on these ids and both would be needed again by any reader that
 * ignores response_format.
 *
 * ONE ID IS NOT ONE BEHAVIOUR (D-096) still applies. Size every max_tokens
 * for the worst observed reasoning draw, and never conclude anything from a
 * single passing run.
 */

/**
 * The one call path that READS PIXELS: the whole clip for `/api/analyze`
 * (D-097) and one frame for `/api/players` (D-093). The holistic rubric in
 * `lib/ai/simple-rubric.ts` is what this id is allowed to be asked, because the
 * gateway samples video at roughly one low-resolution frame per second and
 * per-checkpoint verdicts cannot be produced honestly from that (D-097).
 * Moved 3.6-flash -> 3.7-flash on 2026-08-27 on price (D-128); it compresses
 * the scale harder than the id it replaced, and no number it prints is sold.
 */
export const VISION_MODEL = "google/gemini-3.7-flash";

/**
 * The one call path that WRITES TEXT: coach chat (D-096) and the weekly plan
 * (D-098). Chosen on measurement (docs/model-findings-2026-08-05.md): refused
 * to invent a rating, cited real scores, named no vendor, resisted an injected
 * instruction twelve of twelve times, and finishes inside an 800-token ceiling.
 */
export const CHAT_MODEL = "deepseek/deepseek-v4-flash";
