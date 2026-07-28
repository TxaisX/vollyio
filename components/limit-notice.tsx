import type { ElementType } from "react";
import { limitOffer } from "@/lib/allowance";
import type { Plan } from "@/lib/plans";

// The one surface a player meets when their month is spent: at the 402 that
// just refused their clip, on the analyze page before they pick another one,
// and on the dashboard. Deliberately one component rather than three, because
// the offer must not sharpen as the player gets more stuck. Same price, same
// terms, same wording at every moment; only where it appears changes.
//
// It is only ever mounted where the cap is genuinely enforced. Every caller
// gates on `shouldEnforceFreeTier()` (or on a 402 the server already returned),
// so this can never claim a limit that is switched off.
//
// `upgradeHref` null means there is nothing to buy, and so does a `plan` of
// "pro": a player who already pays gets the reset date and no button, because
// money cannot get them another analysis this month.
export function LimitNotice({
  plan,
  allowance = null,
  resetsOn,
  upgradeHref,
  headingAs = "p",
  className = "",
}: {
  plan: Plan | null;
  allowance?: number | null;
  resetsOn: string | null;
  upgradeHref: string | null;
  // The analyze page renders this instead of the whole flow, so there it is the
  // page's only heading. Everywhere else it sits under one.
  headingAs?: "h1" | "h2" | "p";
  className?: string;
}) {
  const offer = limitOffer({
    plan,
    allowance,
    resetsOn,
    canBuy: upgradeHref !== null,
  });
  const Heading = headingAs as ElementType;

  return (
    <div className={`card p-5 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
        Out of analyses
      </p>
      <Heading className="mt-2 font-display text-xl font-bold leading-snug text-chalk">
        {offer.headline}
      </Heading>

      {offer.terms && (
        <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
          {offer.terms}
        </p>
      )}

      {/* One action. The retry button does not sit beside it, on the pages or
          at the refusal, because sending the same clip again is precisely the
          thing that will not work. */}
      {offer.action && upgradeHref && (
        <a
          href={upgradeHref}
          className="btn-primary mt-4 min-h-11 w-full text-sm"
        >
          {offer.action}
        </a>
      )}

      <p className="mt-3 text-xs leading-relaxed text-chalk-dim">{offer.wait}</p>
    </div>
  );
}
