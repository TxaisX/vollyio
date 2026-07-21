// Pure, DOM-free trim-window and frame-plan types plus a clock helper. Kept
// import-free so it stays headless-testable via `node --test`. The DOM/canvas
// work that produces and renders frames lives in lib/frames.ts, which now covers
// the whole trim window uniformly (D-041); the old content-aware peak sampler
// that used to live here was removed once nothing shipped it. Times are seconds.

export type FrameKind = "peak" | "burst" | "context";
export type PlannedFrame = {
  timeS: number;
  kind: FrameKind;
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// A user-trimmed analysis window inside the clip. All sampling, capture, and
// measurement stay inside it; times remain absolute clip seconds throughout.
export type TrimWindow = { startS: number; endS: number };

export const MIN_TRIM_SPAN_S = 2;

/**
 * Resolve a requested trim against the real clip: bounds clamp to the clip,
 * a missing trim means the whole clip, and the window never collapses below
 * the minimum span a useful analysis needs (short clips stay whole).
 */
export function clampTrimWindow(
  duration: number,
  win?: { startS: number; endS: number } | null,
  minSpanS = MIN_TRIM_SPAN_S,
): TrimWindow {
  const span = Math.min(minSpanS, Math.max(0, duration));
  const endS = clamp(win?.endS ?? duration, span, Math.max(0, duration));
  const startS = clamp(win?.startS ?? 0, 0, Math.max(0, endS - span));
  return { startS, endS };
}

// "0:02.5" style clock stamp for trim handles and rep boundaries.
export function clockStamp(seconds: number | null): string {
  if (seconds == null) return "–";
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(
    Math.floor((s % 1) * 10),
  )}`;
}
