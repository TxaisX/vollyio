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
// server check. Pixels are not available server-side without decoding the
// media, but byte size is.
//
// This floor used to judge a FRAME SET, comparing the median JPEG size against
// 6 KB: a solid-black 1024px frame measured 4.3 KB against a healthy median of
// 26.6 KB, calibrated on the incident row 204a9569. There is no frame set to
// judge any more (D-097): the read is performed on the clip, and the request
// carries no pixels at all. So the same guard moved to the same job in the new
// medium, which is the only change that keeps D-091's property rather than
// quietly retiring it.
//
// A clip below this is not footage. `lib/video-clip.ts` re-encodes the trimmed
// window at about 2.5 Mbps, so even a two second cut lands in the hundreds of
// kilobytes, and a source forwarded untouched is larger still. The margin is
// therefore an order of magnitude, not a hair, which matters because a false
// positive here blocks a legitimate clip and that is the worse failure.
//
// The route checks this BEFORE the hourly slot and the entitlement, so a clip
// that arrived empty costs the player nothing and "nothing was counted" stays
// literally true.

export const MIN_CLIP_BYTES = 20_000;

export function blankClipByBytes(byteLength: number): boolean {
  return byteLength < MIN_CLIP_BYTES;
}
