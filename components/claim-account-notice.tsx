import Link from "next/link";
import { DAILY_ALLOWANCE } from "@/lib/plans";

// D-118. What an anonymous player meets when they come back for a second rep.
//
// It is deliberately NOT `LimitNotice`. That component's whole job is to sell
// Pro to somebody who has run out of a window, and every sentence in it is
// about a window rolling over or a price. This player has neither: they have no
// plan to upgrade, no reset to wait for, and one breakdown sitting on a row
// that has never had an email address attached to it.
//
// The promise the copy makes is the one the architecture actually keeps.
// Signing up calls `updateUser` on the SAME auth row, so the analysis they are
// looking at does not move, get copied, or need re-uploading. "It's saved" is a
// statement of fact about where the row already is, and it is the reason this
// ask converts better than "create an account to continue" would: there is
// something of theirs on the other side of it.
//
// No price appears here, and none should. The step being asked for is free, and
// naming a paid tier at the moment somebody is deciding whether to give up an
// email address answers a question they have not asked yet.
export function ClaimAccountNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`card border-gold/25 bg-navy/80 p-5 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
        Your free read is done
      </p>
      <p className="mt-2 text-sm leading-relaxed text-chalk">
        That one is yours and it is already saved. Create an account to keep it,
        watch the rating move, and run {DAILY_ALLOWANCE.free} a day.
      </p>
      <Link
        href="/signup"
        className="btn-primary mt-4 inline-flex min-h-11 items-center px-5 py-2 text-sm"
      >
        Keep my breakdown
      </Link>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
        No card. Your breakdown stays where it is.
      </p>
    </div>
  );
}
