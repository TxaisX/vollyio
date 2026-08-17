import {
  TEST_OPT_IN_URL,
  TESTER_GROUP_EMAIL,
  TESTER_GROUP_URL,
} from "@/lib/android-test";

/**
 * The ask for Android testers, put in front of someone who has just signed up.
 *
 * WHY HERE. This is the end of the funnel: they wanted the product enough to
 * make an account, which is the only moment anyone is plausibly willing to do
 * a favour. Asking on the landing page would be asking a stranger.
 *
 * THE TWO STEPS ARE BOTH REQUIRED, and the order matters. Google will not let
 * an account install a test build unless that account is on the tester list
 * first, so a player who taps the opt-in link before joining the group gets a
 * page telling them the test is not available and concludes the app is broken.
 * The group is named before the link for that reason, not for tidiness.
 *
 * It also has to be a GOOGLE account. A player who signed up here with an
 * Outlook address cannot test on Play with it, and finding that out three taps
 * in is worse than being told now.
 */
export function TesterInvite({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold">
        Help test the Android app
      </p>
      <p className="mt-2 text-body leading-relaxed text-chalk-dim">
        Vollyio runs in your browser already. There is also a real Android app,
        and it needs testers before Google will let it onto the store.{" "}
        <span className="text-chalk">
          Testers get a month of Pro free
        </span>{" "}
        while they stay in the test.
      </p>

      <ol className="mt-4 space-y-3">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-chalk-dim">
            1
          </span>
          <p className="min-w-0 text-sm leading-relaxed text-chalk-dim">
            <a
              href={TESTER_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline-offset-2 hover:underline"
            >
              Join the testers group
            </a>{" "}
            with the <span className="text-chalk">Google account</span> on your
            phone. Google only lets accounts on that list install the test
            build, so this has to come first.
          </p>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-chalk-dim">
            2
          </span>
          <p className="min-w-0 text-sm leading-relaxed text-chalk-dim">
            <a
              href={TEST_OPT_IN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline-offset-2 hover:underline"
            >
              Open the tester link
            </a>{" "}
            on that phone and accept, then install from Play.
          </p>
        </li>
      </ol>

      {/* The condition is stated where the offer is, not discovered at
          revocation (D-124). The comp is applied by the owner from the group's
          member list, so "within a day" is the honest cadence, not "instantly". */}
      <p className="mt-3 text-xs leading-relaxed text-chalk-dim">
        Pro is applied to the account with this email within a day of joining,
        runs for 30 days, and ends early if you leave the group before the test
        finishes.
      </p>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
        Group: {TESTER_GROUP_EMAIL}
      </p>
    </div>
  );
}
