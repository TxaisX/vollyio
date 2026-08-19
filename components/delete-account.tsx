"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Self-serve deletion for the Account card. Everything goes: footage, reps,
// ratings, goals, chats, and the account itself. Deliberately hard to trigger
// by accident: a modal that requires typing DELETE.
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        throw new Error(error ?? "The account couldn't be deleted. Try again.");
      }
      try {
        await createClient().auth.signOut();
      } catch {
        // The account is already gone; the dead session can't outlive it.
      }
      window.location.assign("/");
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-md">
            <p className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
              Delete account
            </p>
            <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
              Permanently removes your account and everything in it: footage,
              breakdowns, ratings, goals, and coach chats. This cannot be
              undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPhrase("");
              setError(null);
              setOpen(true);
            }}
            className="btn-destructive min-h-11 px-4 text-sm"
          >
            Delete account
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setOpen(false);
          }}
        >
          <div className="card w-full max-w-md p-6">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-coral-ink">
              This cannot be undone
            </p>
            <h2 id="delete-account-title" className="mt-2 font-display text-xl font-bold">
              Delete your account?
            </h2>
            <p className="mt-3 text-body text-chalk-dim">
              Your footage, breakdowns, ratings, goals, coach chats, and the
              account itself are permanently deleted, right now, not in 30
              days. Type <span className="font-mono text-chalk">DELETE</span>{" "}
              to confirm.
            </p>
            <input
              ref={inputRef}
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              aria-label="Type DELETE to confirm"
              autoComplete="off"
              className="input-field mt-4 w-full font-mono"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-coral-ink">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={phrase !== "DELETE" || busy}
                aria-busy={busy}
                className="btn-destructive min-h-11 disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete everything"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="btn-ghost min-h-11"
              >
                Keep my account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
