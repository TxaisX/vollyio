// Pure kinematics over landmark time series. No DOM, no engine imports:
// everything here runs identically in the browser, on the server, and under
// node --test. All positions are in normalized image space (y grows downward);
// distances are normalized by measured body proportions before use.

import {
  LM,
  type DetectorFamily,
  type Landmark,
  type LandmarkFrame,
  type PersonFrame,
  type PersonTrack,
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

// ---------------------------------------------------------------------------
// Person tracks: follow each athlete through multi-player footage so the
// single-athlete measurement pipeline can run on one chosen person.

function personCenter(pts: Landmark[]): { x: number; y: number } {
  return mid(pts[LM.leftHip], pts[LM.rightHip]);
}

function personExtent(pts: Landmark[]): number {
  const top = Math.min(pts[LM.nose].y, pts[LM.leftEar].y, pts[LM.rightEar].y);
  const bottom = Math.max(pts[LM.leftAnkle].y, pts[LM.rightAnkle].y);
  return Math.max(0.02, bottom - top);
}

// ---------------------------------------------------------------------------
// Focus region: crop-zoomed detection around a framed player. Detecting on a
// crop makes a small, distant athlete large enough for the pose model to see.

export type FocusRegion = { left: number; top: number; width: number; height: number };

// Map landmarks detected inside a crop back to full-frame coordinates. z is
// scaled by the crop width to stay in the same units as full-frame depth.
export function mapRegionPersons(persons: Landmark[][], region: FocusRegion): Landmark[][] {
  return persons.map((pts) =>
    pts.map((p) => ({
      x: region.left + p.x * region.width,
      y: region.top + p.y * region.height,
      z: p.z * region.width,
      v: p.v,
    })),
  );
}

// Generous detection window around a followed player: sized from the user's
// frame so movement between detections stays inside, clamped to the frame.
export function focusRegionAround(
  cx: number,
  cy: number,
  box: FocusRegion | null,
): FocusRegion {
  const width = Math.min(1, Math.max(0.45, (box?.width ?? 0.3) * 2.5));
  const height = Math.min(1, Math.max(0.45, (box?.height ?? 0.4) * 2.2));
  return {
    left: Math.min(Math.max(0, cx - width / 2), 1 - width),
    top: Math.min(Math.max(0, cy - height / 2), 1 - height),
    width,
    height,
  };
}

// Best-effort hip center of one detected person; null when too little of the
// body is visible to place them.
export function hipCenter(pts: Landmark[]): { x: number; y: number } | null {
  const lh = pts[LM.leftHip];
  const rh = pts[LM.rightHip];
  if (lh.v >= 0.4 && rh.v >= 0.4) return mid(lh, rh);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of pts) {
    if (p.v < 0.4) continue;
    xs.push(p.x);
    ys.push(p.y);
  }
  if (xs.length < 6) return null;
  return {
    x: xs.reduce((a, b) => a + b, 0) / xs.length,
    y: ys.reduce((a, b) => a + b, 0) / ys.length,
  };
}

// The detector can fire two or three overlapping detections on one body,
// which would each become their own track and crowd out real players.
// Collapse detections whose hip centers sit within a fraction of their own
// body size to the most visible one.
export function dedupePersons(persons: Landmark[][]): Landmark[][] {
  if (persons.length <= 1) return persons;
  const meanVis = (pts: Landmark[]) =>
    pts.reduce((a, p) => a + p.v, 0) / pts.length;
  const ranked = [...persons].sort((a, b) => meanVis(b) - meanVis(a));
  const kept: Landmark[][] = [];
  for (const pts of ranked) {
    const c = personCenter(pts);
    const h = personExtent(pts);
    const duplicate = kept.some((other) => {
      const oc = personCenter(other);
      const oh = personExtent(other);
      const dist = Math.hypot(c.x - oc.x, c.y - oc.y);
      return dist < 0.4 * Math.min(h, oh);
    });
    if (!duplicate) kept.push(pts);
  }
  return kept;
}

type OpenTrack = {
  id: number;
  frames: LandmarkFrame[];
  lastT: number;
  cx: number;
  cy: number;
  h: number;
};

// Greedy frame-to-track association on hip-center distance and body-size
// similarity, with a match window that widens for sparse probe gaps.
export function buildTracks(personFrames: PersonFrame[], maxTracks = 4): PersonTrack[] {
  const sorted = [...personFrames].sort((a, b) => a.t - b.t);
  const open: OpenTrack[] = [];
  let nextId = 0;

  for (const rawFrame of sorted) {
    const frame = { t: rawFrame.t, persons: dedupePersons(rawFrame.persons) };
    const assignments: { cost: number; person: number; track: OpenTrack }[] = [];
    frame.persons.forEach((pts, person) => {
      const c = personCenter(pts);
      const h = personExtent(pts);
      for (const track of open) {
        const dt = frame.t - track.lastT;
        if (dt > 3) continue;
        const dist = Math.hypot(c.x - track.cx, c.y - track.cy);
        const sizeCost = Math.abs(Math.log(h / track.h));
        if (sizeCost > 0.5) continue;
        const cost = dist + sizeCost * 0.5;
        const budget = 0.12 + 0.2 * Math.min(dt, 2);
        if (cost <= budget) assignments.push({ cost, person, track });
      }
    });

    assignments.sort((a, b) => a.cost - b.cost);
    const usedPersons = new Set<number>();
    const usedTracks = new Set<number>();
    for (const a of assignments) {
      if (usedPersons.has(a.person) || usedTracks.has(a.track.id)) continue;
      usedPersons.add(a.person);
      usedTracks.add(a.track.id);
      const pts = frame.persons[a.person];
      const c = personCenter(pts);
      a.track.frames.push({ t: frame.t, pts });
      a.track.lastT = frame.t;
      a.track.cx = c.x;
      a.track.cy = c.y;
      a.track.h = personExtent(pts);
    }
    frame.persons.forEach((pts, person) => {
      if (usedPersons.has(person)) return;
      const c = personCenter(pts);
      open.push({
        id: nextId++,
        frames: [{ t: frame.t, pts }],
        lastT: frame.t,
        cx: c.x,
        cy: c.y,
        h: personExtent(pts),
      });
    });
  }

  // Score the tracks: who is actually playing, prominent, and on screen.
  const candidates = open.filter((t) => t.frames.length >= 4);
  if (candidates.length === 0) return [];
  const maxFrames = Math.max(...candidates.map((t) => t.frames.length));

  const scored: PersonTrack[] = candidates.map((t) => {
    const heights = t.frames.map((f) => personExtent(f.pts));
    const medianH = median(heights);
    const wristSpeed = Math.max(
      ...smooth(
        t.frames.map((_, i) => {
          const l = landmarkSpeed(t.frames, LM.leftWrist)[i];
          const r = landmarkSpeed(t.frames, LM.rightWrist)[i];
          return Math.max(l, r);
        }),
        1,
      ),
      0,
    );
    const motion = Math.min(1, wristSpeed / (medianH * 4));
    const centerDist = median(
      t.frames.map((f) => {
        const c = personCenter(f.pts);
        return Math.hypot(c.x - 0.5, c.y - 0.5);
      }),
    );
    const centered = 1 - Math.min(1, centerDist * 2);
    const coverage = t.frames.length / maxFrames;
    return {
      id: t.id,
      frames: t.frames,
      motion,
      size: medianH,
      centered,
      score: 0, // filled after size normalization below
    };
  });

  const maxSize = Math.max(...scored.map((t) => t.size), 0.01);
  for (const t of scored) {
    const size = t.size / maxSize;
    const coverage = t.frames.length / maxFrames;
    t.size = size;
    t.score =
      0.45 * t.motion + 0.25 * size + 0.15 * t.centered + 0.15 * coverage;
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxTracks);
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
