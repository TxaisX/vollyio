// Blank-frame detection, pure on purpose. lib/frames.ts is DOM-coupled and
// untestable under node --test, so every decision that can be wrong lives here
// instead: what counts as blank, when a failing pass should be abandoned, and
// what to do with a set that came back partially blank. The browser plumbing
// only supplies pixels and byte counts.
//
// Why this exists (D-091): a mobile browser produced 61 structurally valid,
// solid-black JPEG frames for a real clip (analyses row 204a9569). The
// mechanism is spec-mandated and silent: drawImage(video) is a no-op below
// HAVE_CURRENT_DATA, the canvas backing store is transparent after resize, and
// toDataURL("image/jpeg") flattens transparency to opaque black. The result is
// a valid image of nothing, which then costs a real analysis and a real model
// call to discover. These checks catch it while it is still free.

/** Luma statistics over an RGBA pixel buffer, sampling every `stride`th pixel. */
export function lumaStats(
  rgba: ArrayLike<number>,
  stride = 4,
): { mean: number; spread: number } {
  const pixelStep = Math.max(1, Math.floor(stride)) * 4;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  for (let i = 0; i + 2 < rgba.length; i += pixelStep) {
    const y =
      0.2126 * (rgba[i] as number) +
      0.7152 * (rgba[i + 1] as number) +
      0.0722 * (rgba[i + 2] as number);
    sum += y;
    if (y < min) min = y;
    if (y > max) max = y;
    n++;
  }
  if (n === 0) return { mean: 0, spread: 0 };
  return { mean: sum / n, spread: max - min };
}

// A broken decode is near-UNIFORM, not necessarily near-black: iOS's
// transparent-canvas path flattens to black, but Android decoder failures are
// known to emit solid green or gray (YUV zeros misread as RGB). So blankness is
// judged on spread alone. A real video frame is essentially never this uniform:
// even a plain wall carries lighting gradient and sensor noise well past this
// threshold, and genuinely dark gym footage keeps its ceiling lights and skin
// tones. Deliberately conservative, because a false positive here blocks a
// legitimate clip, which is the worse failure.
export const BLANK_SPREAD_MAX = 8;

export function isBlankStats(stats: { mean: number; spread: number }): boolean {
  return stats.spread <= BLANK_SPREAD_MAX;
}

// Abandon a render pass after this many consecutive blank frames instead of
// grinding out the rest. A frame-dead element costs seconds per frame in seek
// and retry waits; without this, a doomed 61-frame pass runs for minutes
// before the player learns anything. Eight in a row cannot be a coincidence of
// content: no rep contains eight consecutive genuinely uniform frames.
export const BLANK_ABORT_RUN = 8;

/**
 * What to do with a completed pass given how many of its frames were blank.
 *
 * - "keep-all": nothing blank, pass through untouched.
 * - "drop-blanks": some blanks; drop them and send the rest. Dropping happens
 *   BEFORE frame indices are assigned, so the wire indices stay contiguous and
 *   the route's marker_index < frames.length contract holds.
 * - "fail-pass": too little real content would survive. The route requires at
 *   least 2 frames, and a 1-frame "sequence" is not a rep.
 */
export function blankFilterVerdict(
  total: number,
  blankCount: number,
): "keep-all" | "drop-blanks" | "fail-pass" {
  if (total <= 0) return "fail-pass";
  if (blankCount <= 0) return "keep-all";
  return total - blankCount >= 2 ? "drop-blanks" : "fail-pass";
}

// ---------------------------------------------------------------------------
// Server-side floor. The client guard above is bypassable by a stale bundle or
// a future client bug, and the incident's money loss stays reachable without a
// server check. Pixels are not available server-side without decoding JPEGs,
// but byte size is: a solid-black 1024px JPEG measured 4.3KB against a healthy
// median of 26.6KB (calibrated on the incident row 204a9569 vs a healthy
// analysis, 2026-08-03). The MEDIAN is compared, not the minimum, so a few
// legitimately simple frames cannot trip it; and the floor sits at 6KB, well
// above the black median and 4x under the healthy one.

export const BLANK_MEDIAN_BYTES = 6_000;

// Only meaningful on sets big enough for a median to mean something. A short
// set (the 2-frame minimum, photo-derived sends) must never be judged by this.
export const BLANK_FLOOR_MIN_FRAMES = 8;

/** Approximate decoded byte length of a base64 payload string. */
export function base64Bytes(base64Length: number): number {
  return Math.floor(base64Length * 0.75);
}

export function blankSetByBytes(byteLengths: number[]): boolean {
  if (byteLengths.length < BLANK_FLOOR_MIN_FRAMES) return false;
  const sorted = [...byteLengths].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return median < BLANK_MEDIAN_BYTES;
}
