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
    <div id="plan" className="card scroll-mt-20 p-5">
      <p className="font-display font-bold">Plan</p>

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
          <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
            {PLAN_LABEL.pro} is {PRO_PRICE_LABEL} for {MONTHLY_ALLOWANCE.pro}{" "}
            analyses a month, on the same monthly reset.
            {!metered &&
              " Nothing is capped yet, so this is early support rather than more reps today. Cancel any time."}
          </p>
          <PlanAction
            endpoint="/api/stripe/checkout"
            label={`Upgrade to ${PLAN_LABEL.pro}`}
            busyLabel="Opening…"
            variant="primary"
          />
        </>
      )}

      {action === "manage" && (
        <>
          {/* The cancel terms are stated here rather than discovered later
              (docs/billing.md section 7): the window is the calendar month, so
              a cancelled month's Pro analyses are already spent against the
              smaller allowance the player lands on. */}
          <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
            Update your payment details or cancel. Cancelling keeps{" "}
            {PLAN_LABEL.pro} to the end of the period you already paid for, then
            the allowance drops to {MONTHLY_ALLOWANCE.free} a month, counting
            anything you already ran that month.
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
    </div>
  );
}
