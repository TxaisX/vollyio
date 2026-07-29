import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { billingOpen, shouldEnforceFreeTier } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";
import { allowanceCopy, readAllowance, resetCopy } from "@/lib/allowance";
import {
  MONTHLY_ALLOWANCE,
  PLAN_LABEL,
  PRO_PRICE_LABEL,
  type Plan,
} from "@/lib/plans";
import { PlanAction } from "@/components/plan-actions";

// Which button, if any, the card is allowed to show (docs/billing.md 4.4, D-066).
//
// A button that 503s is worse than no button, so an offer needs the purchase
// path to be real: billing switched on AND the provider configured. It does NOT
// need the cap to be enforced. Those are separate decisions, and the launch
// posture is an open product with Pro as a choice.
//
// Someone already paying always gets a way to stop paying, whatever the cap is
// doing, because the money keeps moving either way.
function planAction(pro: boolean, sellable: boolean, canPay: boolean) {
  if (pro) return canPay ? "manage" : "unavailable";
  return sellable && canPay ? "upgrade" : "none";
}

// The plan surface, and the only place either payment action starts. The `id`
// is load-bearing: both billing routes send the player back to /settings#plan,
// and that is where NEXT_PUBLIC_UPGRADE_URL points as well.
export async function PlanCard({ plan }: { plan: Plan }) {
  const metered = shouldEnforceFreeTier();
  const sellable = billingOpen();
  const canPay = stripeConfigured();
  const pro = plan === "pro";

  // Only read the counter when the cap is real. Showing "2 of 3 left" while
  // nothing is being enforced would be a lie, and not making the call at all is
  // what makes that impossible rather than merely unlikely.
  const allowance = metered ? await readAllowance(await createClient()) : null;
  const action = planAction(pro, sellable, canPay);

  return (
    // Both billing routes and NEXT_PUBLIC_UPGRADE_URL land on /settings#plan.
    // A bare div would be scrolled to and nothing more; the name plus the
    // focus target means arriving here announces where "here" is.
    <section
      id="plan"
      aria-labelledby="plan-heading"
      tabIndex={-1}
      className="card scroll-mt-20 p-5"
    >
      <h2 id="plan-heading" className="font-display font-bold">
        Plan
      </h2>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-bold">{PLAN_LABEL[plan]}</p>
        {allowance && (
          <p className="font-mono text-[11px] text-chalk-dim">
            {allowanceCopy(allowance)}
          </p>
        )}
      </div>

      {/* Three states, and the middle one is the launch posture: open, with Pro
          available. It must not imply the free plan is limited when it is not.
          A player who upgrades today is buying the plan early and keeping the
          product running, not buying analyses they could not already have, and
          saying otherwise would be selling something that does not exist. */}
      {metered ? (
        <p className="mt-1 text-xs text-chalk-dim">
          {MONTHLY_ALLOWANCE[plan]} analyses a month.
        </p>
      ) : sellable ? (
        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
          Analyses are unlimited for everyone while we are early, so nothing is
          counting against you today. {PLAN_LABEL.pro} sets your allowance at{" "}
          {MONTHLY_ALLOWANCE.pro} a month for when limits do start, against{" "}
          {MONTHLY_ALLOWANCE.free} on {PLAN_LABEL.free}.
        </p>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
          Monthly limits are not switched on yet, so nothing is counting against
          you. Paid plans open later.
        </p>
      )}

      {/* Pro is told when the window rolls because waiting is its only answer
          to an empty month. A free player is told the same thing once they are
          out, so "come back Aug 1" is never a fact they have to guess at. */}
      {allowance && (pro || allowance.remaining === 0) && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
          {resetCopy(allowance)}
        </p>
      )}

      {action === "upgrade" && (
        <>
          {/* Auto-renewal, price, and how to stop must all be here, in the
              metered state too. They used to sit inside `!metered`, so the
              PAYING state, the only one where a charge actually recurs, was
              the one state that disclosed neither renewal nor cancellation.
              California's ARL asks for that disclosure before the purchase,
              not after it. The "nothing is capped yet" sentence is the only
              part that is genuinely posture-dependent, so it is the only part
              still behind the flag. */}
          <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
            {PLAN_LABEL.pro} is {PRO_PRICE_LABEL} for {MONTHLY_ALLOWANCE.pro}{" "}
            analyses a month. It renews automatically at {PRO_PRICE_LABEL} on
            the day you subscribe, each month, until you cancel. Cancel any
            time from this page; you keep {PLAN_LABEL.pro} until the end of the
            period you already paid for, and unused time is not refunded.
            {!metered &&
              " Monthly limits are not switched on yet, so this is early support rather than more reps today."}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-chalk-dim">
            By subscribing you agree to the{" "}
            <Link
              href="/terms"
              className="text-chalk underline decoration-line underline-offset-4 transition-colors hover:text-gold"
            >
              Terms of Service
            </Link>
            .
          </p>
          <PlanAction
            endpoint="/api/stripe/checkout"
            label={`Upgrade to ${PLAN_LABEL.pro}`}
            busyLabel="Opening…"
            variant="primary"
            attestation="I am 18 or older, or a parent or guardian is starting this subscription and authorizing the payment."
          />
        </>
      )}

      {action === "manage" && (
        <>
          {/* The cancel terms are stated here rather than discovered later.
              D-067 moved the Pro window to the purchase anniversary, so the
              old "the window is the calendar month" reasoning that used to sit
              in this comment no longer describes Pro; Free is the plan still
              on the 1st, which is what a cancelling player lands on. */}
          <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
            Update your payment details or cancel. Cancelling stops the next
            charge and keeps {PLAN_LABEL.pro} to the end of the period you
            already paid for; unused time is not refunded. After that the
            allowance drops to {MONTHLY_ALLOWANCE.free} a month, counting
            anything you already ran, and resets on the 1st.
          </p>
          <PlanAction
            endpoint="/api/stripe/portal"
            label="Manage plan"
            busyLabel="Opening…"
            variant="ghost"
          />
        </>
      )}

      {action === "unavailable" && (
        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          {pro
            ? "Plan changes are not available right now. Nothing about your plan has changed."
            : "Upgrading is not open yet."}
        </p>
      )}
    </section>
  );
}
