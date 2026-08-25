"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  clearTrainingTarget,
  setTrainingTarget,
  type TargetState,
} from "@/app/(app)/dashboard/actions";
import {
  formatEventDate,
  runwayCount,
  runwayLine,
  targetRunway,
  type PhaseSegment,
  type TargetPhase,
} from "@/lib/training-target";

export type TrainingTarget = {
  id: string;
  title: string;
  event_date: string;
};

const LABEL_CLASS =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-chalk-dim";

// The ramp is the whole point of the strip: one token at four strengths, going
// up as the date gets closer, so the shape says "this intensifies" before a
// single word is read. Four separate hues would have said "four unrelated
// things" and would also have cost the palette three colors it does not have.
const PHASE_FILL: Record<TargetPhase, string> = {
  base: "bg-gold/25",
  build: "bg-gold/45",
  sharpen: "bg-gold/70",
  compete: "bg-gold",
};

function TargetForm({
  target,
  todayKey,
  maxDateKey,
  onDone,
  onCancel,
}: {
  target: TrainingTarget | null;
  todayKey: string;
  maxDateKey: string;
  onDone: () => void;
  onCancel: (() => void) | null;
}) {
  const [state, formAction, pending] = useActionState(setTrainingTarget, null);
  const handledKey = useRef(0);

  useEffect(() => {
    if (state?.status === "success" && state.key !== handledKey.current) {
      handledKey.current = state.key;
      onDone();
    }
  }, [state, onDone]);

  const errors = state?.status === "error" ? state.errors : undefined;
  const values = state?.status === "error" ? state.values : undefined;

  return (
    <form key={state?.key ?? 0} action={formAction} className="mt-4 space-y-4">
      {/* Base track stated, same rule as the dashboard grids: an implicit `auto`
          track is at least its item's min-content, and a date input carries an
          intrinsic width that does not shrink. The layout contract test reads
          the page file, not this one, so this was the one grid on the dashboard
          its own guard could not see. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
        <div>
          <label htmlFor="target-title" className={LABEL_CLASS}>
            Event
          </label>
          <input
            id="target-title"
            name="title"
            maxLength={80}
            defaultValue={values?.title ?? target?.title}
            placeholder="Winter club qualifier"
            className="input-field"
            aria-invalid={errors?.title ? true : undefined}
            aria-describedby={errors?.title ? "target-title-error" : undefined}
          />
          {errors?.title && (
            <p id="target-title-error" className="mt-1.5 text-xs text-coral-ink">
              {errors.title}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="target-date" className={LABEL_CLASS}>
            Date
          </label>
          {/* min and max come from the SERVER's Pacific day, not from a clock
              in this browser. A phone set to Tokyo would otherwise offer a
              tomorrow the server reads as today and refuses. */}
          <input
            id="target-date"
            name="event_date"
            type="date"
            min={todayKey}
            max={maxDateKey}
            defaultValue={values?.event_date ?? target?.event_date}
            className="input-field font-mono"
            aria-invalid={errors?.event_date ? true : undefined}
            aria-describedby={errors?.event_date ? "target-date-error" : undefined}
          />
          {errors?.event_date && (
            <p id="target-date-error" className="mt-1.5 text-xs text-coral-ink">
              {errors.event_date}
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
          {target ? "Save target" : "Set the target"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function PhaseStrip({
  segments,
  current,
}: {
  segments: PhaseSegment[];
  current: TargetPhase;
}) {
  const total = segments.reduce((sum, s) => sum + s.weeks, 0);

  return (
    <div className="mt-4">
      {/* One flex row, each segment grown by its own week count, so the widths
          ARE the arithmetic rather than an illustration of it. The minimum
          width stops the one-week phases collapsing to a sliver on a phone
          beside a long base block. */}
      <ul className="flex items-end gap-1.5">
        {segments.map((s) => {
          const on = s.phase === current;
          return (
            <li
              key={s.phase}
              style={{ flexGrow: s.weeks, flexBasis: 0 }}
              className="min-w-11"
            >
              <span
                aria-hidden="true"
                className={`block rounded-full ${PHASE_FILL[s.phase]} ${
                  on ? "h-2.5" : "h-1.5"
                }`}
              />
              <span
                className={`mt-1.5 block truncate font-mono text-[9px] uppercase tracking-[0.06em] ${
                  on ? "text-chalk" : "text-chalk-faint"
                }`}
              >
                {s.label}
              </span>
              <span className="block font-mono text-[9px] text-chalk-faint">
                {s.weeks}w
              </span>
            </li>
          );
        })}
      </ul>
      {/* The bars are decorative; the sentence is the accessible reading of the
          same thing, so a screen reader gets the plan rather than a row of
          unlabelled boxes. */}
      <p className="sr-only">
        {total} weeks left, split into{" "}
        {segments.map((s) => `${s.weeks} weeks of ${s.label}`).join(", ")}.
      </p>
    </div>
  );
}

/**
 * THE SEASON TARGET (D-127), directly under the opening band.
 *
 * A rating says where a player is. This says what it is FOR: one date, the
 * weeks left to it, and what this stretch of those weeks is meant to be spent
 * on. It sits above "Film a rep" so today's work reads as work toward
 * something, which is the entire argument for it existing.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is score the player against the date. There
 * is no percentage, no projection, and no verdict on whether they are ready,
 * because nothing this product measures supports one. Weeks remaining and the
 * phase those weeks fall in are both simply true; a readiness number would be
 * the exact kind of claim docs/llms.txt exists to refuse.
 *
 * `todayKey` arrives from the server so the countdown is computed from the same
 * Pacific day on both sides of hydration. A `new Date()` in here would render
 * one number on the server and, for anyone east of the date line, a different
 * one in the browser.
 */
export function TargetBand({
  target,
  todayKey,
  maxDateKey,
}: {
  target: TrainingTarget | null;
  todayKey: string;
  maxDateKey: string;
}) {
  const [editing, setEditing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, startTransition] = useTransition();
  const editRef = useRef<HTMLButtonElement>(null);

  // CLOSE THE FORM WHEN THE TARGET ITSELF CHANGES, adjusted during render
  // rather than in an effect, because an effect cannot see this happen.
  //
  // Setting the first target moves this component from the empty branch to the
  // filled one, and the form sits at a different position in each. React
  // unmounts and remounts it across that move, which resets its `useActionState`
  // to null and destroys the success signal before the form's own effect can
  // read it. The result was a saved target rendering with a blank "set a
  // target" form still sitting under it, which is what a real 390px pass caught
  // and what nothing in the type system was ever going to.
  //
  // The row's identity is the honest trigger: a new row, a moved date, a
  // renamed event and a cleared target all change it, and nothing else does.
  const signature = target ? `${target.id}:${target.event_date}:${target.title}` : "none";
  const [seenSignature, setSeenSignature] = useState(signature);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setEditing(false);
    setClearing(false);
  }

  const runway = target ? targetRunway(todayKey, target.event_date) : null;
  const count = runway ? runwayCount(runway) : null;

  if (!target) {
    return (
      <section aria-labelledby="target-heading" className="card p-5 sm:p-6">
        <h2
          id="target-heading"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink"
        >
          Target
        </h2>
        {editing ? (
          <TargetForm
            target={null}
            todayKey={todayKey}
            maxDateKey={maxDateKey}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="mt-2 font-display text-lg font-bold">
              Give the season a date.
            </p>
            <p className="mt-1 max-w-md text-body text-chalk-dim">
              A tournament, a tryout, the first match back. Every week between
              now and then gets a job, and today stops being an isolated rep.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost mt-4 inline-flex min-h-11 text-sm"
            >
              Set a target
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="target-heading" className="card spot p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="target-heading"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-ink"
          >
            Target
          </h2>
          <p className="mt-1.5 truncate font-display text-xl font-bold">
            {target.title}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-chalk-dim">
            {formatEventDate(target.event_date)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {count ? (
            <>
              <p className="stat-num text-3xl text-gold-ink">{count.value}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-chalk-dim">
                {count.unit}
              </p>
            </>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-chalk-dim">
              {runway ? runwayLine(runway) : null}
            </p>
          )}
        </div>
      </div>

      {runway?.state === "ahead" && (
        <>
          <PhaseStrip segments={runway.segments} current={runway.phase.phase} />
          <p className="mt-3.5 text-body text-chalk-dim">
            <span className="font-medium text-chalk">
              This week: {runway.phase.label}.
            </span>{" "}
            {runway.phase.blurb}
          </p>
        </>
      )}

      {runway?.state === "today" && (
        <p className="mt-3.5 text-body text-chalk-dim">
          <span className="font-medium text-chalk">Today is the day.</span> Go
          and play it. The rating will still be here tomorrow.
        </p>
      )}

      {runway?.state === "past" && (
        <p className="mt-3.5 text-body text-chalk-dim">
          That date has been and gone. Set the next one and the weeks start
          counting again.
        </p>
      )}

      {editing ? (
        <TargetForm
          target={target}
          todayKey={todayKey}
          maxDateKey={maxDateKey}
          onDone={() => {
            setEditing(false);
            editRef.current?.focus();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
          {clearing ? (
            <>
              <span className="text-xs text-chalk-dim">Clear this target?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => clearTrainingTarget())}
                className="btn-ghost min-h-11 px-3.5 py-1.5 text-xs text-coral-ink disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setClearing(false)}
                className="btn-ghost min-h-11 px-3.5 py-1.5 text-xs"
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                ref={editRef}
                type="button"
                onClick={() => setEditing(true)}
                className="btn-ghost min-h-11 px-4 py-1.5 text-xs"
              >
                {runway?.state === "past" ? "Set the next one" : "Change"}
              </button>
              <button
                type="button"
                onClick={() => setClearing(true)}
                className="btn-ghost min-h-11 border-transparent px-3.5 py-1.5 text-xs text-chalk-dim"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
