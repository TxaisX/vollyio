"use client";

import { useEffect, useRef, useState } from "react";
import {
  NOTE_MAX_CHARS,
  REPORT_REASON_LABEL,
  REPORT_REASON_ORDER,
  type ReportReason,
} from "@/lib/content-report";

// The in-app way to report offensive content, required by Play's
// AI-Generated Content policy (the coach is generative AI and its output must
// be reportable without leaving the app) and by its User-Generated Content
// policy (a /share/<token> page is public user content and must be reportable
// by whoever opened it, account or no account).
//
// Deliberately NOT the same control as AnalysisFeedback. That one asks whether
// the coaching was useful and feeds the eval loop; this one asks whether the
// content is harmful and feeds moderation. A player who taps "Not quite" has
// not raised a safety report, and a reviewer who finds only a helpfulness
// widget has found an app with no reporting mechanism.

export type ReportTarget =
  | { surface: "analysis"; analysisId: string }
  | { surface: "coach"; sessionId: string | null; excerpt: string }
  | { surface: "shared_analysis"; token: string };

function requestBody(target: ReportTarget, reason: ReportReason, note: string) {
  const base = { reason, ...(note.trim() ? { note: note.trim() } : {}) };
  switch (target.surface) {
    case "analysis":
      return { ...base, surface: target.surface, analysis_id: target.analysisId };
    case "coach":
      return {
        ...base,
        surface: target.surface,
        ...(target.sessionId ? { coach_session_id: target.sessionId } : {}),
        // Trimmed to the server's ceiling here rather than sent whole and
        // rejected: a long coach answer is the normal case, not an edge one.
        excerpt: target.excerpt.slice(0, 2000),
      };
    case "shared_analysis":
      return { ...base, surface: target.surface, token: target.token };
  }
}

export function ReportContent({
  target,
  label = "Report",
  className = "",
}: {
  target: ReportTarget;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // A native <dialog> opened with showModal(), for the same reason CoachDrawer
  // uses one: the browser supplies the top layer, the backdrop, the focus trap,
  // focus restoration and Escape, all correct everywhere and none of it worth
  // reimplementing on a control that has to work on a stranger's phone.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(target, reason, note)),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "We could not file that right now. Try again shortly.");
        return;
      }
      setDone(data.message ?? "Thanks. We have this and will look at it.");
      setOpen(false);
    } catch {
      setError("We could not file that right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  // Once filed, the trigger is replaced rather than left inviting a second
  // report on the same thing. The hourly cap exists for abuse, not to be the
  // thing that tells an honest reporter they already did this.
  if (done) {
    return (
      <p className={`text-xs text-chalk-dim ${className}`} role="status">
        {done}
      </p>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim underline underline-offset-4 transition-colors hover:text-gold-ink ${className}`}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Report this content"
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[min(28rem,92vw)] overflow-y-auto rounded-card border border-line bg-navy-light p-0 text-chalk shadow-lift backdrop:bg-deep/60"
      >
        <div className="p-5">
          <h2 className="font-display text-lg font-bold">Report this</h2>
          <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
            Tell us what is wrong with it and we will review it. If someone is in
            immediate danger, contact your local emergency services first.
          </p>

          <fieldset className="mt-4">
            <legend className="font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim">
              What is wrong?
            </legend>
            <div className="mt-2 flex flex-col gap-1.5">
              {REPORT_REASON_ORDER.map((r) => (
                <label
                  key={r}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-card border px-3 py-2 text-sm transition ${
                    reason === r
                      ? "border-gold bg-gold/10 text-gold-ink"
                      : "border-chalk-dim/25 bg-navy-lighter text-chalk hover:border-gold/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="h-4 w-4 shrink-0 accent-gold"
                  />
                  {REPORT_REASON_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <label
            htmlFor="report-note"
            className="mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-chalk-dim"
          >
            Anything else? (optional)
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_CHARS))}
            rows={3}
            placeholder="What should we look at?"
            // 16px exactly: iOS Safari zooms the viewport on a focused field
            // under 16px, and this one sits inside a modal on a phone.
            className="mt-2 w-full resize-none rounded-card border border-chalk-dim/20 bg-navy-lighter p-3 text-[16px] text-chalk placeholder:text-chalk-dim/60 focus:border-gold focus:outline-none"
          />

          {error && (
            <p role="alert" className="mt-3 text-xs text-coral-ink">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost min-h-11 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reason || busy}
              onClick={() => void submit()}
              className="btn-primary min-h-11 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Sending..." : "Send report"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
