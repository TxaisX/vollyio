// Pure, DOM-free frame-selection logic for the content-aware sampler.
// Kept import-free so it is headless-testable via `node --test` (see
// lib/frame-select.test.ts). The DOM/canvas work that feeds these functions
// lives in lib/frames.ts. Times are in seconds.

export type Peak = { timeS: number; score: number };
export type FrameKind = "peak" | "burst" | "context";
export type PlannedFrame = { timeS: number; kind: FrameKind };

const INSET = 0.05; // ignore the outer 5% of the clip (bad first/last frames)
const SMOOTH_WINDOW = 3;
const PEAK_K = 0.8; // a peak must exceed mean + PEAK_K * std
const MOTION_EPS = 1.5; // below this, the whole clip is basically still
const PEAK_PROMINENCE_MIN = 2; // max must stand this far above the mean
const FLATNESS_RATIO = 0.12; // std/mean below this = too flat to trust
const MIN_PEAK_SEPARATION_S = 1.0; // non-max suppression window
const MAX_PEAKS = 3;
const CONTEXT_FRAMES = 3;
const BURST_SPACING_FACTOR = 0.35; // burst spacing = this * coarse probe interval
const BURST_SPACING_MIN = 0.08;
const BURST_SPACING_MAX = 0.2;
const DEDUPE_S = 0.06;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Evenly-spaced probe timestamps across the trustworthy middle of the clip. */
export function buildProbeTimes(duration: number, count: number): number[] {
  const start = duration * INSET;
  const end = duration * (1 - INSET);
  if (count <= 1 || end <= start) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + step * i);
}

function smooth(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      sum += values[j];
      n++;
    }
    return sum / n;
  });
}

/**
 * Find the 1-3 strongest motion peaks. Returns [] when the motion curve is
 * degenerate (a still or evenly-moving clip) so the caller can fall back to
 * uniform sampling. Peaks are refined to sub-probe accuracy and returned
 * strongest-first.
 */
export function findPeaks(motion: number[], probeTimes: number[]): Peak[] {
  const n = motion.length;
  if (n < 3 || probeTimes.length !== n) return [];

  const ms = smooth(motion, SMOOTH_WINDOW);
  const mmax = Math.max(...ms);
  const mean = ms.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(ms.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

  if (
    mmax < MOTION_EPS ||
    mmax - mean < PEAK_PROMINENCE_MIN ||
    std / (mean + 1e-6) < FLATNESS_RATIO
  ) {
    return [];
  }

  const threshold = mean + PEAK_K * std;
  const coarseInterval = probeTimes[1] - probeTimes[0];
  const candidates: Peak[] = [];

  for (let i = 1; i < n - 1; i++) {
    if (ms[i] > ms[i - 1] && ms[i] >= ms[i + 1] && ms[i] > threshold) {
      // Parabolic interpolation over the three points → sub-probe center.
      const denom = ms[i - 1] - 2 * ms[i] + ms[i + 1];
      const delta =
        Math.abs(denom) > 1e-6
          ? clamp(0.5 * ((ms[i - 1] - ms[i + 1]) / denom), -0.5, 0.5)
          : 0;
      candidates.push({
        timeS: probeTimes[i] + delta * coarseInterval,
        score: ms[i],
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Non-max suppression: don't let two probes inside one rep both win.
  const peaks: Peak[] = [];
  for (const c of candidates) {
    if (peaks.length >= MAX_PEAKS) break;
    if (peaks.every((p) => Math.abs(p.timeS - c.timeS) >= MIN_PEAK_SEPARATION_S)) {
      peaks.push(c);
    }
  }
  return peaks;
}

/**
 * Plan the final frame timestamps: a dense burst around each peak (to catch
 * approach → contact → follow-through) plus a few context frames for chronology.
 * Returns at most `maxFrames`, sorted ascending; [] if nothing usable.
 */
export function planFrameTimes(
  duration: number,
  peaks: Peak[],
  coarseInterval: number,
  maxFrames: number,
): PlannedFrame[] {
  if (peaks.length === 0 || maxFrames < 2) return [];

  const contextN = Math.min(CONTEXT_FRAMES, Math.max(0, maxFrames - 3));
  const burstBudget = maxFrames - contextN;
  const nPeaks = Math.min(peaks.length, Math.floor(burstBudget / 3), MAX_PEAKS);
  if (nPeaks === 0) return [];

  const chosen = peaks.slice(0, nPeaks);

  // Every peak gets a minimum of 3, remainder distributed by score.
  const counts = chosen.map(() => 3);
  let remaining = burstBudget - 3 * nPeaks;
  const totalScore = chosen.reduce((a, p) => a + p.score, 0) || 1;
  const fracs = chosen.map((p) => (remaining * p.score) / totalScore);
  fracs.forEach((f, i) => (counts[i] += Math.floor(f)));
  let leftover = remaining - fracs.reduce((a, f) => a + Math.floor(f), 0);
  const byFrac = fracs
    .map((f, i) => ({ i, frac: f - Math.floor(f) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < leftover; k++) counts[byFrac[k % nPeaks].i]++;

  const spacing = clamp(
    coarseInterval * BURST_SPACING_FACTOR,
    BURST_SPACING_MIN,
    BURST_SPACING_MAX,
  );

  const planned: PlannedFrame[] = [];
  chosen.forEach((peak, pi) => {
    const c = counts[pi];
    let centerK = 0;
    let centerD = Infinity;
    const group: PlannedFrame[] = [];
    for (let k = 0; k < c; k++) {
      const timeS = peak.timeS + (k - (c - 1) / 2) * spacing;
      group.push({ timeS, kind: "burst" });
      const d = Math.abs(timeS - peak.timeS);
      if (d < centerD) {
        centerD = d;
        centerK = k;
      }
    }
    group[centerK].kind = "peak";
    planned.push(...group);
  });

  const contextFracs = [INSET, 0.5, 1 - INSET].slice(0, contextN);
  contextFracs.forEach((fr) => planned.push({ timeS: fr * duration, kind: "context" }));

  // Clamp into range, sort, and dedupe near-identical times (keep the
  // higher-priority kind so a peak is never dropped for a context frame).
  const priority: Record<FrameKind, number> = { peak: 3, burst: 2, context: 1 };
  const sorted = planned
    .map((f) => ({ ...f, timeS: clamp(f.timeS, 0.05, Math.max(0.05, duration - 0.05)) }))
    .sort((a, b) => a.timeS - b.timeS);

  const out: PlannedFrame[] = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(f.timeS - last.timeS) < DEDUPE_S) {
      if (priority[f.kind] > priority[last.kind]) out[out.length - 1] = f;
    } else {
      out.push(f);
    }
  }
  return out.length >= 2 ? out : [];
}
