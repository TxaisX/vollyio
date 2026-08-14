import { createClient } from "@/lib/supabase/server";
import { billingOpen, shouldEnforceFreeTier } from "@/lib/billing";
import { availableOffers, downsellConfigured, stripeConfigured } from "@/lib/stripe";
import { allowanceCopy, readAllowance, resetCopy } from "@/lib/allowance";
import {
  MONTHLY_ALLOWANCE,
  SIGNUP_GRANT,
  PLAN_LABEL,
  allowanceSentence,
  type Plan,
} from "@/lib/plans";
import { PlanAction } from "@/components/plan-actions";
import { PlanOfferPicker } from "@/components/plan-offer-picker";

// Which button, if any, the card is allowed to show (docs/billing.md 4.4, D-066).
//
// A button that 503s is worse than no button, so an offer needs the purchase
// path to be real: billing switched on AND the provider configured. It does NOT
// need the cap to be enforced. Those are separate decisions, and the launch
// posture is an open product with Pro as a choice.
//
// Someone already paying always gets a way to stop paying, whatever the cap is
// doing, because the money keeps moving either way.
//
// A pending checkout outranks the upgrade offer: the player just paid, the
// webhook has not landed, and a live Upgrade button in that window is an
// invitation to buy the same subscription twice.
function planAction(
  pro: boolean,
  sellable: boolean,
  canPay: boolean,
  pending = false,
) {
  if (pro) return canPay ? "manage" : "unavailable";
  if (pending) return "pending";
  return sellable && canPay ? "upgrade" : "none";
}

// The plan surface, and the only place either payment action starts. The `id`
// is load-bearing: both billing routes send the player back to /settings#plan,
// and that is where NEXT_PUBLIC_UPGRADE_URL points as well.
export async function PlanCard({
  plan,
  checkoutPending = false,
}: {
  plan: Plan;
  checkoutPending?: boolean;
}) {
  const metered = shouldEnforceFreeTier();
  const sellable = billingOpen();
  const canPay = stripeConfigured();
  const pro = plan === "pro";

  // Only read the counter when the cap is real. Showing "2 of 3 left" while
  // nothing is being enforced would be a lie, and not making the call at all is
  // what makes that impossible rather than merely unlikely.
  const allowance = metered ? await readAllowance(await createClient()) : null;
  const action = planAction(pro, sellable, canPay, checkoutPending);
  // Resolved on the server so no price id crosses to the client: the picker
  // receives keys, and lib/offers.ts turns those into labels it already prints.
  const offers = availableOffers();
  const downsellAvailable = downsellConfigured();

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
        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
          {allowanceSentence(plan)}.
          {/* While the starter analyses are unspent, say so and say what
              follows them. A player who is shown "3 left" and nothing else
              learns the rate is 1 by being refused, which is the one place
              this product must never spring a number on somebody. */}
          {plan === "free" &&
            allowance?.grantRemaining != null &&
            allowance.grantRemaining > 0 && (
              <>
                {" "}
                You have {allowance.grantRemaining} of your {SIGNUP_GRANT}{" "}
                starter analyses left.
              </>
            )}
        </p>
      ) : sellable ? (
        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
          Analyses are unlimited for everyone while we are early, so nothing is
          counting against you today. {PLAN_LABEL.pro} sets your allowance at{" "}
          {MONTHLY_ALLOWANCE.pro} a month for when limits do start, against{" "}
          {allowanceSentence("free")} on {PLAN_LABEL.free}.
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

      {action === "pending" && (
        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          Payment received. {PLAN_LABEL.pro} switches on the moment the charge
          is confirmed, usually under a minute. This page does not update
          itself, so refresh in a moment to see the new plan. If it has not
          landed after a few minutes, nothing is lost: the confirmation email
          is your receipt, and support can put the plan right.
        </p>
      )}

      {/* The renewal disclosure moved INTO the picker because it has to change
          with the selected cadence. Leaving it here would have
          left "each month" printed above a control that can select a weekly
          subscription, which is the wrong renewal terms on the surface that
          takes the card. The ARL point the old comment made still holds and is
          why the sentence is rendered before the button, not after it. */}
      {action === "upgrade" && offers.length > 0 && (
        <PlanOfferPicker
          offers={offers}
          downsellAvailable={downsellAvailable}
          metered={metered}
        />
      )}

      {/* Configured to sell, but no offer has a price id. Distinct from
          "upgrading is not open yet": the switches are on and the environment
          is half-set, which is an operator problem, not a product state. */}
      {action === "upgrade" && offers.length === 0 && (
        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          Upgrading is briefly unavailable. Nothing has been charged.
        </p>
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
            anything you already ran, and resets on the 1st. The{" "}
            {SIGNUP_GRANT} starter analyses are one time and do not come back.
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
