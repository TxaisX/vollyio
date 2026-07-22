"use client";

import { useState } from "react";
import { createShareLink, revokeShareLinks } from "@/app/(app)/analysis/[id]/actions";
import { SHARE_LINK_TTL_DAYS } from "@/lib/share-constants";

// Owner control for the public share link (D-049). Each press of the copy
// button mints a fresh token server-side; the URL is shown once and copied,
// never stored readable. Turning sharing off revokes every live link for the
// analysis, which also kills the clip stream.
export function ShareLink({
  analysisId,
  active,
}: {
  analysisId: string;
  active: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(active);
  const [status, setStatus] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function copyLink() {
    setBusy(true);
    setStatus(null);
    setUrl(null);
    try {
      const result = await createShareLink(analysisId);
      if ("error" in result) {
        setStatus(result.error);
        return;
      }
      setSharing(true);
      try {
        await navigator.clipboard.writeText(result.url);
        setStatus(
          `Link copied. Anyone with it can see this breakdown. It turns off on its own in ${SHARE_LINK_TTL_DAYS} days.`,
        );
      } catch {
        // Clipboard can be blocked (permissions, non-secure context); the
        // link still has to reach the player, so show it for manual copy.
        setUrl(result.url);
        setStatus(
          `Copy the link below. Anyone with it can see this breakdown. It turns off on its own in ${SHARE_LINK_TTL_DAYS} days.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setStatus(null);
    setUrl(null);
    try {
      const { ok } = await revokeShareLinks(analysisId);
      if (ok) {
        setSharing(false);
        setStatus("Sharing is off. Old links no longer work.");
      } else {
        setStatus("Couldn't turn sharing off. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={busy}
          className="btn-ghost min-h-11 px-4 py-2 text-sm disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5.93" />
            <path d="M14 10a5 5 0 0 0-7.07 0l-2.12 2.12a5 5 0 0 0 7.07 7.07L13 18.07" />
          </svg>
          {busy ? "Working…" : "Copy share link"}
        </button>
        {sharing && (
          <button
            type="button"
            onClick={turnOff}
            disabled={busy}
            className="btn-ghost min-h-11 px-4 py-2 text-sm text-chalk-dim disabled:opacity-40"
          >
            Turn off sharing
          </button>
        )}
      </div>
      {url && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input-field w-full max-w-md text-xs"
          aria-label="Share link"
        />
      )}
      <span role="status" aria-live="polite" className="text-xs text-chalk-dim">
        {status}
      </span>
    </div>
  );
}
