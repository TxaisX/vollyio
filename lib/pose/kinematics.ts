// Pure kinematics over landmark time series. No DOM, no engine imports:
// everything here runs identically in the browser, on the server, and under
// node --test. All positions are in normalized image space (y grows downward);
// distances are normalized by measured body proportions before use.

import {
  LM,
  type DetectorFamily,
  type Landmark,
  type LandmarkFrame,
  type RepWindow,
} from "./types.ts";

export type Baseline = {
  bodyHeight: number; // image units, standing head-to-heel extent
  headY: number;
  footY: number;
  shoulderWidth: number; // image units
};

// ---------------------------------------------------------------------------
// Basic geometry

export function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a: Landmark, b: Landmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Interior angle at vertex b, in degrees.
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb < 1e-6 || magCb < 1e-6) return 0;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function visibilityMean(frame: LandmarkFrame, indices: number[]): number {
  if (indices.length === 0) return 0;
  let acc = 0;
  for (const i of indices) acc += frame.pts[i]?.v ?? 0;
  return acc / indices.length;
}

// ---------------------------------------------------------------------------
// Series utilities

// Split frames into contiguous segments; dense capture produces one segment
// per rep window with real gaps between them.
export function segmentFrames(frames: LandmarkFrame[], maxGapS = 0.5): LandmarkFrame[][] {
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  const segments: LandmarkFrame[][] = [];
  let current: LandmarkFrame[] = [];
  for (const f of sorted) {
    if (current.length > 0 && f.t - current[current.length - 1].t > maxGapS) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(f);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

// Centered moving average over a numeric series.
export function smooth(values: number[], radius = 1): number[] {
  if (radius <= 0) return [...values];
  return values.map((_, i) => {
    let acc = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      acc += values[j];
      n++;
    }
    return acc / n;
  });
}

// Speed of one landmark between consecutive frames, in image units per second.
export function landmarkSpeed(segment: LandmarkFrame[], index: number): number[] {
  const out: number[] = new Array(segment.length).fill(0);
  for (let i = 1; i < segment.length; i++) {
    const dt = segment[i].t - segment[i - 1].t;
    if (dt <= 1e-4) continue;
    out[i] = dist(segment[i].pts[index], segment[i - 1].pts[index]) / dt;
  }
  return out;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Body baseline

function headTopY(frame: LandmarkFrame): number {
  // Nose sits below the crown; extend by the nose-to-ear vertical spread.
  const nose = frame.pts[LM.nose];
  const earY = (frame.pts[LM.leftEar].y + frame.pts[LM.rightEar].y) / 2;
  return nose.y - Math.abs(earY - nose.y);
}

function footY(frame: LandmarkFrame): number {
  return Math.max(
    frame.pts[LM.leftHeel].y,
    frame.pts[LM.rightHeel].y,
    frame.pts[LM.leftAnkle].y,
    frame.pts[LM.rightAnkle].y,
  );
}

// Estimate the standing baseline from the calmest third of the series: frames
// whose combined wrist speed is lowest are the closest thing to "standing".
export function standingBaseline(frames: LandmarkFrame[]): Baseline | null {
  const segments = segmentFrames(frames);
  const all = segments.flat();
  if (all.length < 6) return null;

  const speeds: { frame: LandmarkFrame; speed: number }[] = [];
  for (const segment of segments) {
    const left = landmarkSpeed(segment, LM.leftWrist);
    const right = landmarkSpeed(segment, LM.rightWrist);
    segment.forEach((frame, i) => speeds.push({ frame, speed: left[i] + right[i] }));
  }
  speeds.sort((a, b) => a.speed - b.speed);
  const calm = speeds.slice(0, Math.max(4, Math.floor(speeds.length / 3))).map((s) => s.frame);

  const heights = calm.map((f) => footY(f) - headTopY(f)).filter((h) => h > 0.05);
  if (heights.length < 3) return null;

  return {
    bodyHeight: median(heights),
    headY: median(calm.map(headTopY)),
    footY: median(calm.map(footY)),
    shoulderWidth: median(
      calm.map((f) => dist(f.pts[LM.leftShoulder], f.pts[LM.rightShoulder])),
    ),
  };
}

// ---------------------------------------------------------------------------
// Rep detectors. Each returns rep windows with a 0..1 template fit.

type PeakOpts = { minSeparationS: number; thresholdRatio: number };

function seriesPeaks(
  values: number[],
  times: number[],
  { minSeparationS, thresholdRatio }: PeakOpts,
): { index: number; strength: number }[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return [];
  const threshold = max * thresholdRatio;
  const peaks: { index: number; strength: number }[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] < threshold) continue;
    if (values[i] < values[i - 1] || values[i] < values[i + 1]) continue;
    const prev = peaks[peaks.length - 1];
    if (prev && times[i] - times[prev.index] < minSeparationS) {
      if (values[i] > values[prev.index]) peaks[peaks.length - 1] = { index: i, strength: values[i] };
      continue;
    }
    peaks.push({ index: i, strength: values[i] });
  }
  return peaks;
}

// Swing (serve, attack): the hitting wrist accelerates through contact far
// faster than anything else in the series.
export function detectSwingReps(frames: LandmarkFrame[], baseline: Baseline | null): RepWindow[] {
  const reps: RepWindow[] = [];
  for (const segment of segmentFrames(frames)) {
    const times = segment.map((f) => f.t);
    const speed = smooth(
      segment.map((_, i) => {
        const l = landmarkSpeed(segment, LM.leftWrist)[i];
        const r = landmarkSpeed(segment, LM.rightWrist)[i];
        return Math.max(l, r);
      }),
      1,
    );
    const bodyH = baseline?.bodyHeight ?? 0.5;
    // A real swing moves the wrist multiple body-heights per second.
    const absoluteFloor = bodyH * 1.6;
    for (const peak of seriesPeaks(speed, times, { minSeparationS: 1.2, thresholdRatio: 0.55 })) {
      if (speed[peak.index] < absoluteFloor) continue;
      const t = times[peak.index];
      const fit = Math.min(1, speed[peak.index] / (bodyH * 4));
      reps.push({
        startS: Math.max(times[0], t - 1.1),
        contactS: t,
        endS: Math.min(times[times.length - 1], t + 0.9),
        detector: "swing",
        fit,
      });
    }
  }
  return reps;
}

// Jump (block): both wrists above the head while the body rises off its
// standing baseline; contact anchor is the jump apex.
export function detectJumpReps(frames: LandmarkFrame[], baseline: Baseline | null): RepWindow[] {
  if (!baseline) return [];
  const reps: RepWindow[] = [];
  for (const segment of segmentFrames(frames)) {
    const times = segment.map((f) => f.t);
    const rise = smooth(
      segment.map((f) => Math.max(0, baseline.footY - footY(f))),
      1,
    );
    const handsUp = segment.map(
      (f) =>
        f.pts[LM.leftWrist].y < headTopY(f) + baseline.bodyHeight * 0.05 &&
        f.pts[LM.rightWrist].y < headTopY(f) + baseline.bodyHeight * 0.05,
    );
    const minRise = baseline.bodyHeight * 0.06;
    for (const peak of seriesPeaks(rise, times, { minSeparationS: 1.5, thresholdRatio: 0.6 })) {
      if (rise[peak.index] < minRise || !handsUp[peak.index]) continue;
      const t = times[peak.index];
      reps.push({
        startS: Math.max(times[0], t - 1.0),
        contactS: t,
        endS: Math.min(times[times.length - 1], t + 1.0),
        detector: "jump",
        fit: Math.min(1, rise[peak.index] / (baseline.bodyHeight * 0.2)),
      });
    }
  }
  return reps;
}

// Platform (pass, dig, set): a window where both wrists travel together
// slowly (formed platform or setting shape) followed by a small impulse.
export function detectPlatformReps(
  frames: LandmarkFrame[],
  baseline: Baseline | null,
): RepWindow[] {
  const reps: RepWindow[] = [];
  const bodyH = baseline?.bodyHeight ?? 0.5;
  for (const segment of segmentFrames(frames)) {
    const times = segment.map((f) => f.t);
    // Tight threshold: hanging arms sit about a shoulder width apart, a formed
    // platform brings the wrists nearly together.
    const together = segment.map(
      (f) => dist(f.pts[LM.leftWrist], f.pts[LM.rightWrist]) < bodyH * 0.18,
    );
    const speed = smooth(
      segment.map((_, i) => {
        const l = landmarkSpeed(segment, LM.leftWrist)[i];
        const r = landmarkSpeed(segment, LM.rightWrist)[i];
        return (l + r) / 2;
      }),
      1,
    );
    // Find runs where hands are together, then take the speed impulse inside
    // or immediately after the run as the contact anchor.
    let runStart = -1;
    for (let i = 0; i <= segment.length; i++) {
      const inRun = i < segment.length && together[i];
      if (inRun && runStart < 0) runStart = i;
      if (!inRun && runStart >= 0) {
        const runEnd = i - 1;
        const runS = times[runEnd] - times[runStart];
        if (runS >= 0.25) {
          let contactIdx = runStart;
          for (let j = runStart; j <= Math.min(runEnd + 3, segment.length - 1); j++) {
            if (speed[j] > speed[contactIdx]) contactIdx = j;
          }
          const impulse = speed[contactIdx];
          const fit = Math.min(1, (runS / 1.0) * 0.6 + Math.min(1, impulse / (bodyH * 1.2)) * 0.4);
          const last = reps[reps.length - 1];
          const contactS = times[contactIdx];
          if (!last || contactS - (last.contactS ?? last.endS) > 1.0) {
            reps.push({
              startS: times[runStart],
              contactS,
              endS: Math.min(times[times.length - 1], contactS + 0.6),
              detector: "platform",
              fit,
            });
          }
        }
        runStart = -1;
      }
    }
  }
  return reps;
}

export function detectReps(
  family: DetectorFamily,
  frames: LandmarkFrame[],
  baseline: Baseline | null,
): RepWindow[] {
  if (family === "swing") return detectSwingReps(frames, baseline);
  if (family === "jump") return detectJumpReps(frames, baseline);
  return detectPlatformReps(frames, baseline);
}

// ---------------------------------------------------------------------------
// Shared rep-scoped helpers used by the metric definitions.

export function framesIn(frames: LandmarkFrame[], startS: number, endS: number): LandmarkFrame[] {
  return frames.filter((f) => f.t >= startS - 1e-3 && f.t <= endS + 1e-3).sort((a, b) => a.t - b.t);
}

export function frameNearest(frames: LandmarkFrame[], t: number): LandmarkFrame | null {
  let best: LandmarkFrame | null = null;
  let bestD = Infinity;
  for (const f of frames) {
    const d = Math.abs(f.t - t);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return bestD <= 0.15 ? best : null;
}

// Which wrist is doing the hitting in this rep: the faster one.
export function hittingSide(segment: LandmarkFrame[]): "left" | "right" {
  const left = Math.max(...landmarkSpeed(segment, LM.leftWrist), 0);
  const right = Math.max(...landmarkSpeed(segment, LM.rightWrist), 0);
  return left > right ? "left" : "right";
}

export function headTop(frame: LandmarkFrame): number {
  return headTopY(frame);
}

export function feetY(frame: LandmarkFrame): number {
  return footY(frame);
}
