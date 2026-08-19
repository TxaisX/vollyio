"use client";

import { useActionState } from "react";
import { generateWeeklyPlan, type PlanState } from "@/app/(app)/plan/actions";

const INITIAL: PlanState = { ok: false, error: null };

export function PlanGenerate({ label }: { label: string }) {
  const [state, formAction, pending] = useActionState(generateWeeklyPlan, INITIAL);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary min-h-11 text-sm disabled:opacity-60"
      >
        {/* The wait is real (one model call), so the label says what is
            happening rather than spinning silently. */}
        {pending ? "Building your week…" : label}
      </button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-coral-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}
