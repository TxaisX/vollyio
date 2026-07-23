// Frame sizing rules. Pure and DOM-free so the arithmetic is testable on its
// own, frames.ts is coupled to the DOM and to Next path aliases, which is why
// this lives beside it rather than inside it.

// Long edge for photo-path frames and for the reduced re-encode pass.
export const MAX_FRAME_DIM = 768;
// Long edge for the primary video-frame pass; final video frames render larger
// than photos because the model reads motion detail out of them.
export const VIDEO_FRAME_DIM = 1568;

// Long edge for the single frame sent to the coach-spotting endpoint. Smaller
// than the analysis frames: it only needs to resolve players well enough to
// describe kit and position, not to grade mechanics.
export const SPOT_FRAME_DIM = 1024;

// Upscaling adds no information, it changes how the vision model samples the
// image. A sub-target frame is otherwise handed over at native size, so a 640px
// clip is read at 640px even though the budget allows 1568, and thin structures
// (a wrist against a busy background, the ball at distance) can fall below what
// the model resolves. Interpolating up recovers some of that, but every extra
// pixel is billed as image tokens, and past roughly 2x the source it is
// interpolation artifacts rather than detail, so the factor is capped instead
// of stretching whatever it is given all the way to the target.
export const MAX_UPSCALE_FACTOR = 2;

// Scale (w, h) to fit `maxDim` on the long edge, preserving aspect ratio.
// Shrinks whenever the source exceeds the cap. Only grows when `upscale` is
// set, and then by at most MAX_UPSCALE_FACTOR. Never returns a zero dimension.
export function scaledSize(
  w: number,
  h: number,
  maxDim = MAX_FRAME_DIM,
  opts?: { upscale?: boolean },
): [number, number] {
  if (!(w > 0) || !(h > 0)) return [1, 1];
  const longEdge = Math.max(w, h);
  const scale =
    longEdge > maxDim
      ? maxDim / longEdge
      : opts?.upscale && longEdge < maxDim
        ? Math.min(maxDim / longEdge, MAX_UPSCALE_FACTOR)
        : 1;
  if (scale === 1) return [Math.round(w), Math.round(h)];
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}
