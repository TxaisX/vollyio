"use client";

import { useEffect, useState } from "react";

/**
 * Daylight or courtside (D-126).
 *
 * The product's face is the light theme, so this control does NOT follow the
 * operating system: most phones ship dark-on, and inheriting that would mean
 * the daylight identity is the one most players never see. Dark is something
 * a player asks for here, and the answer is remembered.
 *
 * The attribute is written to <html> rather than held in React state, because
 * the pre-paint script in app/layout.tsx reads the same storage key and sets
 * the same attribute. One source of truth, no flash.
 */
const KEY = "vollyio.theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Starts light to match the server-rendered markup, then corrects on mount
  // from whatever the pre-paint script already applied. Reading localStorage
  // during render would desync hydration.
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
    setReady(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // Private mode or a full quota: the theme still applies for this visit,
      // it simply will not be remembered. Not worth surfacing.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Until the effect has run, the label would be a guess. Rendering it
      // inert-but-present keeps layout stable and avoids announcing a wrong
      // state to a screen reader for one frame.
      aria-pressed={ready ? dark : undefined}
      aria-label={dark ? "Switch to daylight theme" : "Switch to courtside dark theme"}
      title={dark ? "Daylight" : "Courtside dark"}
      className={`icon-btn ${className}`}
    >
      <span aria-hidden className="text-base leading-none">
        {dark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
