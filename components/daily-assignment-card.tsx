"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { completeChallenge, type ChallengeState } from "@/app/(app)/dashboard/actions";
import { LinkPending } from "@/components/link-pending";
import { RewardToast } from "@/components/reward-toast";
import { BadgeToasts } from "@/components/xp-toast";
import { SKILL_LABEL } from "@/lib/skills";
import type { Assignment } from "@/lib/daily-assignment";

const INITIAL: ChallengeState = { ok: false, error: null, awarded: 0, badges: [] };

const FELT = [
  { value: "easy", label: "Easy" },
  { value: "right", label: "About right" },
  { value: "hard", label: "Hard" },
] as const;

export function DailyAssignmentCard({
  assignment,
  courtFree,
  done,
  xpAward,
}: {
  /** What today's work is when the player has a court, a ball and a wall. */
  assignment: Assignment;
  /** The same day's work for a player who cannot train today. Precomputed on
   *  the server because both are pure functions of state we already hold, so
   *  offering the alternative costs nothing and needs no round trip. */
  courtFree: Assignment;
  done: boolean;
  xpAward: number;
}) {
  const [noCourt, setNoCourt] = useState(false);
  const [state, formAction, pending] = useActionState(completeChallenge, INITIAL);
  // The card promises "+75 XP" in its corner, so the payment has to be shown
  // landing or the promise reads as decoration. Dismissed is tracked locally
  // because the card survives the revalidation that follows the action.
  const [xpToastDone, setXpToastDone] = useState(false);

  const active = noCourt ? courtFree : assignment;
  const logged = done || state.ok;
  const href =
    active.kind === "drill" && active.drill
      ? `/drills/${active.drill.slug}`
      : (active.studyHref ?? "/learn");

  return (
    <div className="challenge-card card card-lift spot p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-ink">
          Today
        </h2>
        <span className="font-mono text-[11px] text-chalk-dim">+{xpAward} XP</span>
      </div>

      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        className="relative mt-2 block font-display text-lg font-bold leading-snug transition-colors hover:text-gold-ink"
      >
        {active.title}
        <LinkPending />
      </Link>

      <p className="mt-1 font-mono text-[11px] uppercase text-chalk-dim">
        {SKILL_LABEL[active.skill]}
        {active.kind === "drill" && active.drill
          ? ` · ${active.drill.duration_min} min`
          : " · reading"}
      </p>

      {/* Why this and not something else. When nothing has been measured the
          line says so rather than implying a diagnosis the data cannot support. */}
      <p className="mt-2 text-body leading-relaxed text-chalk-dim">{active.why}</p>

      {logged ? (
        <p className="reward-earned mt-3 flex items-center gap-2 text-sm text-teal-ink">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="reward-check h-4 w-4"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Logged for today
        </p>
      ) : (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="kind" value={active.kind} />
          <input type="hidden" name="skill" value={active.skill} />
          <input
            type="hidden"
            name="drill_slug"
            value={active.kind === "drill" && active.drill ? active.drill.slug : ""}
          />

          {active.kind === "drill" && (
            <>
              <label
                htmlFor="challenge-reps"
                className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim"
              >
                Reps you got through
              </label>
              <input
                id="challenge-reps"
                name="reps"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 20"
                className="input-field font-mono"
              />

              <fieldset className="mt-3">
                <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
                  How did it feel
                </legend>
                <div className="flex flex-wrap gap-2">
                  {FELT.map((f) => (
                    <label key={f.value} className="cursor-pointer">
                      {/* peer + sr-only, not appearance-none: the radio stays a
                          real radio for keyboard and screen readers, and the
                          chip is the visible control. */}
                      <input
                        type="radio"
                        name="felt"
                        value={f.value}
                        className="peer sr-only"
                      />
                      <span className="chip min-h-11">{f.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {state.error && (
            <p role="alert" className="mt-3 text-sm text-coral-ink">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-ghost mt-4 w-full min-h-11 py-2.5 text-sm disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : active.kind === "drill"
                ? "Log it"
                : "Mark as read"}
          </button>
        </form>
      )}

      {/* The escape hatch. A streak that only survives on court days is a
          streak designed to break, and roughly half a player's days have no
          gym in them. */}
      {!logged && (
        <button
          type="button"
          onClick={() => setNoCourt((v) => !v)}
          aria-pressed={noCourt}
          className="mt-3 -mb-1 w-full py-1 text-center font-mono text-[11px] text-chalk-dim underline decoration-line-control underline-offset-4 transition-colors hover:text-chalk"
        >
          {noCourt ? "I can train today" : "No court today"}
        </button>
      )}

      {state.ok && state.awarded > 0 && !xpToastDone && (
        <RewardToast
          title={`+${state.awarded} XP`}
          detail="Challenge logged."
          onDismiss={() => setXpToastDone(true)}
        />
      )}
      {/* Badges queue behind the XP toast: same screen anchor, one at a time. */}
      {state.ok &&
        state.badges.length > 0 &&
        (state.awarded === 0 || xpToastDone) && (
          <BadgeToasts badges={state.badges} />
        )}
    </div>
  );
}
