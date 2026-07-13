"use client";

import { useEffect } from "react";
import { applyFunnel } from "@/app/(app)/welcome/actions";
import { FUNNEL_STORAGE_KEY } from "@/lib/funnel";

/**
 * Bridges the pre-signup funnel into the account. The /start quiz parks its
 * answers in localStorage; the first authed page to mount finds them here,
 * clears them, and hands them to the server action (which validates, applies,
 * and redirects into /analyze with the chosen skill preselected).
 */
export function FunnelHandoff() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(FUNNEL_STORAGE_KEY);
      if (raw !== null) localStorage.removeItem(FUNNEL_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    void applyFunnel(parsed);
  }, []);

  return null;
}
