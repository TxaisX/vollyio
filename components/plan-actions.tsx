"use client";

import { useState } from "react";

// The one interactive part of the plan card, kept to a button so the rest of
// the card stays on the server with the two-key gate.
//
// Both billing routes answer with a URL instead of a redirect, because a
// `fetch` follows a 3xx transparently and the browser would never leave the
// page (docs/billing.md 4.5). The navigation therefore has to happen here.
export function PlanAction({
  endpoint,
  label,
  busyLabel,
  variant,
  fullWidth = false,
  attestation,
}: {
  endpoint: string;
  label: string;
  busyLabel: string;
  variant: "primary" | "ghost";
  // The refusal surfaces give this the full width of their card; the plan card
  // sits it inline under the terms.
  fullWidth?: boolean;
  // Text for a required tick-box that gates the button. It asks the thing that
  // actually matters at a card transaction: that the person pressing it is
  // entitled to use the card and knows the charge recurs. A checkbox is not
  // identity verification and does not pretend to be; it is the difference
  // between a promise nobody is ever asked to make and one they are (D-073).
  attestation?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const blocked = attestation ? !attested : false;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;
      // Only ever hand the browser an https destination our own server chose.
      // location.assign() will happily run a `javascript:` string, so anything
      // that is not a plain https URL is treated as a failed reply, not as a
      // place to send a player who is about to type card details.
      const url = typeof body?.url === "string" ? body.url : null;
      if (!res.ok || !url || !url.startsWith("https://")) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "That didn't work. Try again in a moment.",
        );
      }
      // No setBusy(false): the page is leaving, and dropping the button back to
      // its idle label for the last frame reads as the click not registering.
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      {attestation && (
        <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-chalk-dim">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
          />
          <span>{attestation}</span>
        </label>
      )}
      <button
        type="button"
        onClick={open}
        disabled={busy || blocked}
        aria-busy={busy}
        className={`${variant === "primary" ? "btn-primary" : "btn-ghost"} mt-4 min-h-11 text-sm disabled:opacity-40${fullWidth ? " w-full" : ""}`}
      >
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-coral-ink">
          {error}
        </p>
      )}
    </>
  );
}
