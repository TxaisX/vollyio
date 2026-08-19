"use client";

import { useState } from "react";
import { submitAnalysisFeedback } from "@/app/(app)/analysis/[id]/actions";

type Reason = "wrong_player" | "off_read" | "not_helpful";
// `label` is the chip; `phrase` is the same reason read back inside a sentence.
const REASONS: { key: Reason; label: string; phrase: string }[] = [
  { key: "wrong_player", label: "Wrong player", phrase: "wrong player" },
  { key: "off_read", label: "The read was off", phrase: "the read was off" },
  { key: "not_helpful", label: "Nothing I can use", phrase: "nothing you could use" },
];
const REASON_PHRASE: Record<Reason, string> = Object.fromEntries(
  REASONS.map((r) => [r.key, r.phrase]),
) as Record<Reason, string>;

type Feedback = { wasRight: boolean; reasons: Reason[]; note: string | null };

// The player's one-tap decision on a breakdown -- was the opus-low COACHING
// helpful. Skill/subject are user-declared, so this grades the coaching (read +
// score + fix), not the skill. Kept light so it's a reflex, not a chore. This is
// the real-usage ground-truth signal that replaces hand-labeling. The stored
// column stays `was_right` (migration 022); only the ask is framed as usefulness.
export function AnalysisFeedback({
  analysisId,
  initial,
}: {
  analysisId: string;
  initial: Feedback | null;
}) {
  const [saved, setSaved] = useState<Feedback | null>(initial);
  // Two distinct states, deliberately not one. `revising` means "re-open the
  // question"; `correcting` means "I am filling in what was off". Collapsing
  // them sent Change straight into the negative form, which left a player who
  // had answered "did not help" no way back to helpful.
  const [revising, setRevising] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [reasons, setReasons] = useState<Reason[]>(initial?.reasons ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(r: Reason) {
    setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  // Back to the standing answer, with the draft reset to what is actually
  // stored (not to `initial`, which goes stale the moment they answer once).
  function dismissDraft() {
    setCorrecting(false);
    setRevising(false);
    setReasons(saved?.reasons ?? []);
    setNote(saved?.note ?? "");
  }

  async function send(wasRight: boolean, rs?: Reason[], n?: string) {
    setBusy(true);
    setError(null);
    const res = await submitAnalysisFeedback({ analysisId, wasRight, reasons: rs, note: n });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    const next = { wasRight, reasons: wasRight ? [] : (rs ?? []), note: n?.trim() || null };
    setSaved(next);
    setReasons(next.reasons);
    setNote(next.note ?? "");
    setCorrecting(false);
    setRevising(false);
  }

  // Already answered: show the standing decision with a way to change it.
  if (saved && !correcting && !revising) {
    return (
      <div className="card mt-8 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-ink">Your call</p>
        <p className="mt-2 text-body text-chalk">
          {saved.wasRight ? (
            <>You marked this breakdown <span className="font-semibold text-teal-ink">helpful</span>.</>
          ) : (
            <>You said this breakdown <span className="font-semibold text-coral-ink">did not help</span>
              {saved.reasons.length > 0 && (
                <>: {saved.reasons.map((r) => REASON_PHRASE[r]).join(", ")}</>
              )}
              .</>
          )}
        </p>
        {saved.note && <p className="mt-1 text-xs text-chalk-dim">&ldquo;{saved.note}&rdquo;</p>}
        <button
          type="button"
          onClick={() => setRevising(true)}
          className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim underline underline-offset-4 hover:text-gold-ink"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="card mt-8 p-5">
      <p className="font-display font-bold">Was this helpful?</p>
      <p className="mt-1 text-xs text-chalk-dim">
        A quick call helps the coach get sharper on reps like yours.
      </p>

      {!correcting ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => send(true)}
            className="rounded-card border border-teal/50 bg-navy-lighter px-4 py-2 text-sm font-semibold text-teal-ink transition hover:border-teal disabled:opacity-50"
          >
            Yes, helpful
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCorrecting(true)}
            className="rounded-card border border-chalk-dim/30 bg-navy-lighter px-4 py-2 text-sm font-semibold text-chalk transition hover:border-gold disabled:opacity-50"
          >
            Not quite
          </button>
          {saved && (
            <button
              type="button"
              disabled={busy}
              onClick={dismissDraft}
              className="px-3 py-2 text-sm text-chalk-dim transition hover:text-chalk disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
            What was off? (optional)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => toggle(r.key)}
                aria-pressed={reasons.includes(r.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  reasons.includes(r.key)
                    ? "border-gold bg-gold/15 text-gold-ink"
                    : "border-chalk-dim/30 bg-navy-lighter text-chalk hover:border-gold"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="What should it have caught? (optional)"
            rows={2}
            className="mt-3 w-full resize-none rounded-card border border-chalk-dim/20 bg-navy-lighter p-3 text-sm text-chalk placeholder:text-chalk-dim/60 focus:border-gold focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send(false, reasons, note)}
              className="rounded-card border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-ink transition hover:border-gold disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={dismissDraft}
              className="px-3 py-2 text-sm text-chalk-dim transition hover:text-chalk"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-coral-ink">{error}</p>}
    </div>
  );
}
