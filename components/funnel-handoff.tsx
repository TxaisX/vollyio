"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { applyFunnel } from "@/app/(app)/welcome/actions";
import { FUNNEL_PENDING_COOKIE, FUNNEL_STORAGE_KEY } from "@/lib/funnel";

/**
 * Bridges the pre-signup funnel into the account. The /start quiz parks its
 * answers in localStorage; the first authed page to mount finds them here,
 * clears them, and hands them to the server action (which validates, applies,
 * and redirects into /analyze with the chosen skill preselected).
 *
 * The pending cookie is deleted on the FIRST run, whatever this finds. It only
 * exists so /welcome can hold a loading card instead of flashing the quiz the
 * player just finished; once this effect has run, either the answers are on
 * their way to the server or there is nothing to wait for. If the cookie was
 * present but the storage is gone (cleared mid-signup, a different profile),
 * the refresh re-renders /welcome without the cookie, which is the quiz - the
 * honest fallback, not a hang.
 */
export function FunnelHandoff() {
  const router = useRouter();
  useEffect(() => {
    const hadCookie = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${FUNNEL_PENDING_COOKIE}=`));
    document.cookie = `${FUNNEL_PENDING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(FUNNEL_STORAGE_KEY);
      if (raw !== null) localStorage.removeItem(FUNNEL_STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      if (hadCookie) router.refresh();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (hadCookie) router.refresh();
      return;
    }
    void applyFunnel(parsed);
  }, [router]);

  return null;
}
