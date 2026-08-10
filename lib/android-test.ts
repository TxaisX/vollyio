/**
 * The Android test programme, in one place because the numbers and the URLs
 * move together and are easy to get subtly wrong.
 *
 * WHICH TRACK, AND WHY IT MATTERS. Google gates production access behind a
 * CLOSED test: 12 testers opted in, running for 14 CONSECUTIVE days. The
 * console states it plainly on the app dashboard, and it counts **closed**
 * testers only. **Internal testing does NOT count toward the 12**, however
 * many people join it.
 *
 * So this link is currently the INTERNAL track, which is the only one that
 * exists: closed testing is itself locked until the store listing, content
 * rating, data safety and the rest of app setup are finished. It gets real
 * people onto the real app today, which is worth doing on its own, but nobody
 * who joins through it advances the 12. When the closed track exists, change
 * `TEST_OPT_IN_URL` to its opt-in link and `TEST_COUNTS_TOWARD_PRODUCTION` to
 * true, and everything that reads them tells the truth again.
 */

export const TEST_OPT_IN_URL = "https://play.google.com/apps/internaltest/4701444735986107849";

/** The list a tester's Google account must be on BEFORE the link works. */
export const TESTER_GROUP_URL = "https://groups.google.com/g/vollyio-testers";
export const TESTER_GROUP_EMAIL = "vollyio-testers@googlegroups.com";

/** Whether joining currently advances Google's 12-tester requirement. */
export const TEST_COUNTS_TOWARD_PRODUCTION = false;

/** What Google requires before production access opens. */
export const TESTERS_REQUIRED = 12;
export const TEST_DAYS_REQUIRED = 14;
