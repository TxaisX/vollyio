"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  abandonGoal,
  completeGoal,
  createGoal,
} from "@/app/(app)/goals/actions";
import { Reveal } from "@/components/motion";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/skills";

export type Goal = {
  id: string;
  skill: Skill | null;
  title: string;
  target_rating: number | null;
  deadline: string | null;
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
    <form
      key={state?.key ?? 0}
      action={formAction}
      noValidate
      className="space-y-4"
    >
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
        />
        {errors?.title && (
          <p className="mt-1.5 text-xs text-coral">{errors.title}</p>
        )}
      </div>

      <div>
        <span className={LABEL_CLASS}>Skill</span>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={skill === s}
              onClick={() => setSkill(skill === s ? null : s)}
              className={`chip min-h-11 ${skill === s ? "chip-active" : ""}`}
            >
              {SKILL_LABEL[s]}
            </button>
          ))}
        </div>
        {errors?.skill && (
          <p className="mt-1.5 text-xs text-coral">{errors.skill}</p>
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
          />
          {errors?.target_rating && (
            <p className="mt-1.5 text-xs text-coral">{errors.target_rating}</p>
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
          />
          {errors?.deadline && (
            <p className="mt-1.5 text-xs text-coral">{errors.deadline}</p>
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

export function NewGoal() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost min-h-11 w-full sm:w-auto"
      >
        + New goal
      </button>
    );
  }

  return (
    <div className="card p-5">
      <GoalForm
        onCreated={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

export function GoalsEmptyState() {
  return (
    <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
      <div className="text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="mx-auto h-10 w-10 text-gold"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        <p className="mt-4 text-sm text-chalk-dim">
          One number to chase gives every session a direction.
        </p>
      </div>
      <div className="mt-6">
        <GoalForm />
      </div>
    </div>
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
      className={`font-mono text-xs ${days < 0 ? "text-coral" : "text-chalk-dim"}`}
    >
      {label}
    </span>
  );
}

export function ActiveGoalCard({
  goal,
  rating,
  delay = 0,
}: {
  goal: Goal;
  rating: number | null;
  delay?: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();

  const target = goal.target_rating;
  const showBar = goal.skill != null && target != null;
  const pct = showBar
    ? Math.min(100, Math.max(0, ((rating ?? 0) / target) * 100))
    : 0;
  const hit = showBar && rating != null && rating >= target;

  return (
    <Reveal delay={delay}>
      <div className="card card-lift spot p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="font-display text-lg font-bold">{goal.title}</h3>
          {goal.skill && (
            <span className="rounded bg-navy px-2 py-0.5 font-mono text-[10px] uppercase text-chalk-dim">
              {SKILL_LABEL[goal.skill]}
            </span>
          )}
          {goal.deadline && <Deadline date={goal.deadline} />}
        </div>

        {showBar && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim">
                Rating
              </span>
              <span className="font-mono text-xs text-chalk">
                {rating != null ? Math.round(rating) : "—"} / {target}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy">
              <div
                className="h-full rounded-full bg-gold"
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  transition: "width 0.6s var(--ease-court)",
                }}
              />
            </div>
            {hit && (
              <p className="mt-2 text-xs text-teal">
                Target hit &mdash; mark it done
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-chalk-dim">
                Abandon this goal?
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => abandonGoal(goal.id))}
                className="btn-ghost min-h-11 px-4 py-2 text-sm text-coral disabled:opacity-60"
              >
                Abandon
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="btn-ghost min-h-11 px-4 py-2 text-sm"
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => completeGoal(goal.id))}
                className="btn-primary min-h-11 px-5 py-2 text-sm disabled:opacity-60"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-ghost min-h-11 border-transparent px-4 py-2 text-sm text-chalk-dim"
              >
                Abandon
              </button>
            </>
          )}
        </div>
      </div>
    </Reveal>
  );
}
