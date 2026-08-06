import "server-only";

/**
 * Every model this product calls, which is two of them.
 *
 * There is no SDK here any more and no client to construct (D-098). Both ids
 * resolve on one OpenAI-shaped gateway reached by plain fetch from
 * `lib/ai/vision.ts` (pixels) and `lib/ai/chat.ts` (text), because a vendor SDK
 * would not earn its place in the dependency budget for what is two POST
 * bodies. One credential, `OPENROUTER_API_KEY`, pays for all four surfaces.
 *
 * These are checked-in constants and deliberately NOT environment variables
 * (D-004): a typo in a model string would otherwise surface as a runtime 404 on
 * a paid call path instead of in review.
 *
 * There is also no effort setting. `ANALYZE_EFFORT` and `COACH_EFFORT` (D-027)
 * were parameters only the previous coaching service exposed, and they left
 * with it; nothing on the gateway takes one.
 */

/**
 * The one call path that READS PIXELS: the whole clip for `/api/analyze`
 * (D-097) and one frame for `/api/players` (D-093).
 *
 * The 2026-08-04 bakeoff put this model ahead of every tier it was measured
 * against on vision. What D-097 then established is that the MODALITY, not the
 * model, is the thing that has to be right: the same model reading video
 * against the 120-pointer catalog returns a median of 97, which is every player
 * being told they are near-perfect, because the provider samples video at
 * roughly one low-resolution image per second and per-checkpoint verdicts
 * cannot be produced honestly from about ten stills. The holistic rubric in
 * `lib/ai/simple-rubric.ts` is what this id is allowed to be asked.
 */
export const VISION_MODEL = "google/gemini-3.6-flash";

/**
 * The one call path that WRITES TEXT: coach chat (D-096) and the weekly plan
 * (D-098).
 *
 * Chosen on measurement, not price alone. Against the real `coach-prompt.ts`
 * system prompt this model refused to invent a rating for a skill with no data,
 * cited the player's real scores, named no vendor, and resisted a command
 * smuggled into a player-typed goal title, twelve times out of twelve on the
 * injection probe that matters most, because goal titles and display names are
 * free text a player controls. What decided it over the alternative was fit:
 * against an 800-token ceiling the alternative was cut off on four coaching
 * answers of four, which is not thoroughness but an inability to finish inside
 * a budget a phone-sized chat has to impose. Price then lands near seventy fold
 * cheaper on the highest-frequency paid path in the app.
 */
export const CHAT_MODEL = "deepseek/deepseek-v4-flash";

/**
 * ONE ID IS NOT ONE BEHAVIOUR, and this is the single most expensive thing to
 * forget about either constant above.
 *
 * The gateway resolves each id across several upstreams that do not behave
 * alike, and reasoning bills against `max_tokens` BEFORE a single character of
 * content. One probe at 512 returned an empty reply six attempts of six; an
 * independent probe at the identical setting returned content five of five.
 * Both were true, and they drew different upstreams. Measured again on the
 * frame read: 19 runs of one image drew both `Google` and `Google AI Studio`,
 * pricing the identical frame at 1418 and 1236 input tokens.
 *
 * Two rules follow, and neither is optional. Size every `max_tokens` for the
 * worst observed REASONING draw rather than for the answer, and never conclude
 * anything from a single passing run. `telemetry.provider` and
 * `telemetry.reasoning_tokens` on the analyses row exist so that an empty read
 * can be told apart from a refusal after the fact.
 */
