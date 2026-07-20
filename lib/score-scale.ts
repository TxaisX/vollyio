// The product score scale (D-034).
//
// The model judges reps against rubric checkpoints and is consistent about it:
// the same rep lands within a few points across runs and effort tiers. But its
// raw scale bottoms recreational players out in the 40s, which reads as
// failure for a rep with a real athletic foundation. Prompt wording proved an
// unstable lever for moving this (validated: three rewordings moved the same
// clip 42-58 with regressions), so the scale is set HERE, deterministically,
// and the model's judgment is left alone.
//
// This is a monotonic remap: ordering between reps is preserved exactly; only
// where the numbers sit changes. Notes stay blunt about faults either way.
// Applies to every account (D-037): one scale, one meaning per number.

// Piecewise-linear knots, raw -> displayed. Anchored on an owner-labeled rep
// (raw ~50 on grass, judged mid-to-high 60s by an independent full-frame
// read) with the elite end pinned so a great rep cannot inflate.
const KNOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [30, 40],
  [50, 66],
  [70, 80],
  [90, 92],
  [100, 100],
];

export function toProductScale(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const v = Math.min(100, Math.max(0, raw));
  for (let i = 1; i < KNOTS.length; i++) {
    const [x0, y0] = KNOTS[i - 1];
    const [x1, y1] = KNOTS[i];
    if (v <= x1) {
      return Math.round(y0 + ((v - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return 100;
}
