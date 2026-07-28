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
}: {
  endpoint: string;
  label: string;
  busyLabel: string;
  variant: "primary" | "ghost";
  // The refusal surfaces give this the full width of their card; the plan card
  // sits it inline under the terms.
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-busy={busy}
        className={`${variant === "primary" ? "btn-primary" : "btn-ghost"} mt-4 min-h-11 text-sm disabled:opacity-40${fullWidth ? " w-full" : ""}`}
      >
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-coral">
          {error}
        </p>
      )}
    </>
  );
}
