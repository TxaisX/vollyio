"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  abandonGoal,
  completeGoal,
  createGoal,
  type CompleteGoalResult,
} from "@/app/(app)/goals/actions";
import { RewardMark, RewardToast } from "@/components/reward-toast";
import { BadgeToasts } from "@/components/xp-toast";
import type { AchievementKey } from "@/lib/achievements";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

export type Goal = {
  id: string;
  skill: Skill | null;
  title: string;
  target_rating: number | null;
  deadline: string | null;
  // Written once, by the onboarding funnel, explaining why this focus suits
  // this player (D-105). Null on every goal the player adds by hand and on any
  // account whose personalization call did not answer, so it renders only when
  // it exists rather than reserving space for itself.
  note?: string | null;
};

const LABEL_CLASS =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim";

function GoalForm({
  onCreated,
  onCancel,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [state, formAction, pending] = useActionState(createGoal, null);
  const handledKey = useRef(0);

  useEffect(() => {
    if (state?.status === "success" && state.key !== handledKey.current) {
      handledKey.current = state.key;
      setSkill(null);
      onCreated?.();
    }
  }, [state, onCreated]);

  const errors = state?.status === "error" ? state.errors : undefined;
  const values = state?.status === "error" ? state.values : undefined;

  return (
    <form key={state?.key ?? 0} action={formAction} className="space-y-4">
      <input type="hidden" name="skill" value={skill ?? ""} />

      <div>
        <label htmlFor="goal-title" className={LABEL_CLASS}>
          Goal
        </label>
        <input
          id="goal-title"
          name="title"
          maxLength={80}
          defaultValue={values?.title}
          placeholder="Serve 8 of 10 past the ten-foot line"
          className="input-field"
          aria-invalid={errors?.title ? true : undefined}
          aria-describedby={errors?.title ? "goal-title-error" : undefined}
        />
        {errors?.title && (
          <p id="goal-title-error" className="mt-1.5 text-xs text-coral-ink">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <span id="goal-skill-label" className={LABEL_CLASS}>
          Skill
        </span>
        <div
          role="group"
          aria-labelledby="goal-skill-label"
          aria-invalid={errors?.skill ? true : undefined}
          aria-describedby={errors?.skill ? "goal-skill-error" : undefined}
          className="flex flex-wrap gap-2"
        >
          {SKILLS.map((s) => {
            const on = skill === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSkill(on ? null : s)}
                className={`chip min-h-11 ${on ? "chip-active" : ""}`}
              >
                {on && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                )}
                {SKILL_LABEL[s]}
              </button>
            );
          })}
        </div>
        {errors?.skill && (
          <p id="goal-skill-error" className="mt-1.5 text-xs text-coral-ink">
            {errors.skill}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="goal-target" className={LABEL_CLASS}>
            Target rating
          </label>
          <input
            id="goal-target"
            name="target_rating"
            type="number"
            min={1}
            max={100}
            step={1}
            inputMode="numeric"
            defaultValue={values?.target_rating}
            placeholder="75"
            className="input-field font-mono"
            aria-invalid={errors?.target_rating ? true : undefined}
            aria-describedby={
              errors?.target_rating ? "goal-target-error" : undefined
            }
          />
          {errors?.target_rating && (
            <p id="goal-target-error" className="mt-1.5 text-xs text-coral-ink">
              {errors.target_rating}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="goal-deadline" className={LABEL_CLASS}>
            Deadline
          </label>
          <input
            id="goal-deadline"
            name="deadline"
            type="date"
            defaultValue={values?.deadline}
            className="input-field scheme-dark font-mono"
            aria-invalid={errors?.deadline ? true : undefined}
            aria-describedby={errors?.deadline ? "goal-deadline-error" : undefined}
          />
          {errors?.deadline && (
            <p id="goal-deadline-error" className="mt-1.5 text-xs text-coral-ink">
              {errors.deadline}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-11 disabled:opacity-60"
        >
          Add goal
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost min-h-11"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function Deadline({ date }: { date: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000,
  );
  const label =
    days > 0
      ? `${days} day${days === 1 ? "" : "s"} left`
      : days === 0
        ? "Due today"
        : `${-days} day${days === -1 ? "" : "s"} overdue`;
  return (
    <span
      suppressHydrationWarning
      className={`font-mono text-[11px] ${days < 0 ? "text-coral-ink" : "text-chalk-dim"}`}
    >
      {label}
    </span>
  );
}

function GoalRow({
  goal,
  rating,
  onCompleted,
}: {
  goal: Goal;
  rating: number | null;
  onCompleted: (goal: Goal, result: CompleteGoalResult) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [intent, setIntent] = useState<"complete" | "abandon" | null>(null);
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();

  const target = goal.target_rating;
  const showBar = goal.skill != null && target != null;
  const pct = showBar
    ? Math.min(100, Math.max(0, ((rating ?? 0) / target) * 100))
    : 0;
  const hit = showBar && rating != null && rating >= target;

  return (
    <li
      className={`relative border-b border-line py-3.5 last:border-b-0 last:pb-1 ${
        pending && intent === "complete" ? "reward-completing" : ""
      }`}
    >
      {pending && intent === "complete" && (
        <RewardMark className="absolute right-0 top-3.5" />
      )}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-chalk">
          {goal.title}
        </span>
        {goal.skill && (
          <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-[10px] uppercase text-chalk-dim">
            {SKILL_LABEL[goal.skill]}
          </span>
        )}
        {goal.deadline && <Deadline date={goal.deadline} />}
      </div>

      {/* Only ever present on the goal the funnel created, and only when the
          model answered. No placeholder and no reserved space, so an account
          without one looks like the card always did. */}
      {goal.note && (
        <p className="mt-1.5 text-xs leading-relaxed text-chalk-dim">{goal.note}</p>
      )}

      {showBar && (
        <div className="mt-2">
          <div
            role="progressbar"
            aria-label={`${SKILL_LABEL[goal.skill!]} rating progress`}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={rating != null ? Math.round(rating) : 0}
            aria-valuetext={
              rating != null
                ? `${Math.round(rating)} of ${target}`
                : `Not rated yet, target ${target}`
            }
            className="h-1 overflow-hidden rounded-full bg-line/60"
          >
            <div
              className={`h-full rounded-full ${hit ? "bg-teal" : "bg-gold"}`}
              style={{
                width: mounted ? `${pct}%` : "0%",
                transition: "width 0.6s var(--ease-court)",
              }}
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] text-chalk-dim">
              {rating != null ? Math.round(rating) : "·"}/{target}
            </span>
            {hit && (
              <span className="font-mono text-[10px] uppercase tracking-wide text-teal-ink">
                Target hit
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-chalk-dim">Abandon this goal?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setIntent("abandon");
                startTransition(() => abandonGoal(goal.id));
              }}
              className="btn-ghost min-h-11 px-3.5 py-1.5 text-xs text-coral-ink disabled:opacity-60"
            >
              Abandon
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn-ghost min-h-11 px-3.5 py-1.5 text-xs"
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setIntent("complete");
                startTransition(async () => {
                  const result = await completeGoal(goal.id);
                  onCompleted(goal, result);
                });
              }}
              className={`${
                hit ? "btn-primary" : "btn-ghost"
              } min-h-11 px-4 py-1.5 text-xs disabled:opacity-60`}
            >
              {pending && intent === "complete" ? "Completing" : "Mark done"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-ghost min-h-11 border-transparent px-3.5 py-1.5 text-xs text-chalk-dim"
            >
              Abandon
            </button>
          </>
        )}
      </div>
    </li>
  );
}

const VISIBLE_DEFAULT = 4;

// The goals surface, on the dashboard where the chasing happens (D-088).
// Everything the old /goals page could do happens in this one card: set a
// goal, watch the bar, mark it done, and actually SEE the 150 XP land, which
// used to be paid in silence. Active goals are unlimited; the card shows four
// and says how many more there are instead of silently hiding them.
export function GoalsBoard({
  goals,
  ratings,
  doneCount,
}: {
  goals: Goal[];
  ratings: Partial<Record<Skill, number>>;
  doneCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(
    null,
  );
  const [badgeQueue, setBadgeQueue] = useState<AchievementKey[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);

  const visible = showAll ? goals : goals.slice(0, VISIBLE_DEFAULT);
  const hidden = goals.length - visible.length;

  const handleCompleted = (goal: Goal, result: CompleteGoalResult) => {
    if (!result.completed) return;
    // awarded 0 means the ledger already paid once (a retry); the goal is
    // still done, so the words stay true either way.
    setToast(
      result.awarded > 0
        ? { title: `+${result.awarded} XP`, detail: `Goal completed. ${goal.title}` }
        : { title: "Goal completed", detail: goal.title },
    );
    if (result.badges.length > 0) {
      setBadgeQueue((queue) => [...queue, ...result.badges]);
    }
  };

  return (
    <section
      id="goals"
      aria-labelledby="goals-heading"
      tabIndex={-1}
      className="card scroll-mt-20 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="goals-heading"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-ink"
        >
          Goals
          {goals.length > 0 && (
            <span className="ml-2 text-chalk-dim">{goals.length} active</span>
          )}
        </h2>
        {!adding && (
          <button
            ref={addRef}
            type="button"
            onClick={() => setAdding(true)}
            className="-my-2 py-2 font-mono text-[11px] text-chalk-dim transition-colors hover:text-chalk"
          >
            + New goal
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 border-b border-line pb-4">
          <GoalForm
            onCreated={() => {
              setAdding(false);
              setToast({ title: "Goal added", detail: "Your target is set." });
              addRef.current?.focus();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {goals.length === 0 && !adding ? (
        <p className="mt-2 text-body text-chalk-dim">
          One number to chase gives every session a direction.{" "}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-gold-ink transition-colors hover:text-chalk"
          >
            Set a target.
          </button>
        </p>
      ) : (
        <ul className="mt-1">
          {visible.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              rating={g.skill ? (ratings[g.skill] ?? null) : null}
              onCompleted={handleCompleted}
            />
          ))}
        </ul>
      )}

      {(hidden > 0 || showAll) && goals.length > VISIBLE_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full py-2 text-center font-mono text-[11px] text-chalk-dim underline decoration-line-control underline-offset-4 transition-colors hover:text-chalk"
        >
          {showAll ? "Show fewer" : `Show all (${goals.length})`}
        </button>
      )}

      {doneCount > 0 && (
        <p className="mt-3 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
          {doneCount} completed ·{" "}
          <Link
            href="/progress/milestones"
            className="text-chalk-dim underline decoration-line-control underline-offset-4 transition-colors hover:text-chalk"
          >
            See them in Milestones
          </Link>
        </p>
      )}

      {toast && (
        <RewardToast
          key={`${toast.title}-${toast.detail}`}
          title={toast.title}
          detail={toast.detail}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* Badges wait for the XP toast's spot to free up: same anchor, queued
          rather than stacked. */}
      {!toast && badgeQueue.length > 0 && (
        <BadgeToasts key={badgeQueue.join(",")} badges={badgeQueue} />
      )}
    </section>
  );
}
