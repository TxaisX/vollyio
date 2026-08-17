/**
 * The Android test programme, in one place because the numbers and the URLs
 * move together and are easy to get subtly wrong.
 *
 * WHICH TRACK, AND WHY IT MATTERS. Google gates production access behind a
 * CLOSED test: 12 testers opted in, running for 14 CONSECUTIVE days. The
 * console states it plainly on the app dashboard, and it counts **closed**
 * testers only.
 *
 * This link is the CLOSED track's opt-in (live and approved since 2026-08-12;
 * the tester list became the self-join Google Group on 2026-08-17), so a
 * player who follows the two steps in order genuinely advances the 12. The
 * ORDER is load-bearing: the opt-in link answers "not available" to any
 * account that is not on the tester list yet, so the group join must come
 * first, and the opt-in link must be opened BEFORE the store listing link,
 * which 404s for anyone not opted in and reads as a broken app.
 */

export const TEST_OPT_IN_URL = "https://play.google.com/apps/testing/com.vollyio.app";

/** The list a tester's Google account must be on BEFORE the link works. */
export const TESTER_GROUP_URL = "https://groups.google.com/g/vollyio-testers";
export const TESTER_GROUP_EMAIL = "vollyio-testers@googlegroups.com";

/** Whether joining currently advances Google's 12-tester requirement. */
export const TEST_COUNTS_TOWARD_PRODUCTION = true;

/** What Google requires before production access opens. */
export const TESTERS_REQUIRED = 12;
export const TEST_DAYS_REQUIRED = 14;
