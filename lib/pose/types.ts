// Shared, DOM-free types for the on-device motion-tracking pipeline.
// Everything here must stay importable from client, server, and node tests.

export const MEASUREMENTS_VERSION = 1;
export const POSE_LANDMARK_COUNT = 33;

// Landmark indices for the 33-point body model.
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

// Skeleton bone graph over the 33-landmark body model, grouped by body region.
// Single source of truth for both the live results-viewer overlay and the
// skeleton baked into frames, so the two always match. The head has no straight
// bones here; it is drawn as a ring plus a neck line (see headGeometry).
export type SkeletonRegion = "head" | "arms" | "torso" | "legs";

export const SKELETON_REGION_BONES: Record<
  Exclude<SkeletonRegion, "head">,
  [number, number][]
> = {
  arms: [
    [LM.leftShoulder, LM.leftElbow],
    [LM.leftElbow, LM.leftWrist],
    [LM.rightShoulder, LM.rightElbow],
    [LM.rightElbow, LM.rightWrist],
  ],
  torso: [
    [LM.leftShoulder, LM.rightShoulder],
    [LM.leftShoulder, LM.leftHip],
    [LM.rightShoulder, LM.rightHip],
    [LM.leftHip, LM.rightHip],
  ],
  legs: [
    [LM.leftHip, LM.leftKnee],
    [LM.leftKnee, LM.leftAnkle],
    [LM.rightHip, LM.rightKnee],
    [LM.rightKnee, LM.rightAnkle],
    [LM.leftAnkle, LM.leftHeel],
    [LM.rightAnkle, LM.rightHeel],
  ],
};

// The design-token color name each body region draws in. Renderers turn these
// into `var(--color-<name>)` (SVG) or a resolved hex (canvas).
export const SKELETON_REGION_COLOR: Record<SkeletonRegion, string> = {
  head: "gold",
  arms: "teal",
  torso: "chalk",
  legs: "coral",
};

// Every landmark index that is an endpoint of some bone, for drawing joint pins.
export const SKELETON_JOINTS: number[] = [
  ...new Set(Object.values(SKELETON_REGION_BONES).flat().flat()),
];

// Min landmark visibility before a bone, joint, or head part is drawn.
export const SKELETON_MIN_V = 0.5;

// Head placement in normalized image coords: a ring centered on the head with a
// neck line down to the shoulder midpoint. Returns null when neither a head
// landmark (nose, else an ear) nor a shoulder anchor is confidently visible.
// `r` is a radius on the normalized x-axis scale; renderers size it as needed.
export function headGeometry(
  pts: Landmark[],
): { cx: number; cy: number; r: number; neckX: number; neckY: number } | null {
  const seen = (i: number) => {
    const p = pts[i];
    return p && p.v >= SKELETON_MIN_V ? p : null;
  };
  const ls = seen(LM.leftShoulder);
  const rs = seen(LM.rightShoulder);
  const shoulder = ls ?? rs;
  if (!shoulder) return null;
  const neckX = ls && rs ? (ls.x + rs.x) / 2 : shoulder.x;
  const neckY = ls && rs ? (ls.y + rs.y) / 2 : shoulder.y;

  const nose = seen(LM.nose);
  const le = seen(LM.leftEar);
  const re = seen(LM.rightEar);
  const ear = le ?? re;
  let cx: number;
  let cy: number;
  if (nose) {
    cx = nose.x;
    cy = nose.y;
  } else if (ear) {
    cx = le && re ? (le.x + re.x) / 2 : ear.x;
    cy = le && re ? (le.y + re.y) / 2 : ear.y;
  } else {
    return null;
  }

  const shoulderW = ls && rs ? Math.abs(ls.x - rs.x) : 0;
  const gap = Math.hypot(cx - neckX, cy - neckY);
  const r = Math.min(0.11, Math.max(0.028, shoulderW > 0.02 ? shoulderW * 0.35 : gap * 0.9));
  return { cx, cy, r, neckX, neckY };
}

export type Landmark = {
  x: number; // normalized 0..1, image space
  y: number; // normalized 0..1, image space (y grows downward)
  z: number; // depth, roughly normalized to hip width
  v: number; // visibility 0..1
};

export type LandmarkFrame = {
  t: number; // clip time in seconds
  pts: Landmark[]; // length POSE_LANDMARK_COUNT
};

// One capture instant with every detected person (multi-player footage).
export type PersonFrame = {
  t: number;
  persons: Landmark[][]; // each entry length POSE_LANDMARK_COUNT
  // Strongest sports-ball detection in the FULL frame at this instant (the
  // ball leaves any player crop, so it is always detected full-frame).
  ball?: BallPoint | null;
};

// One on-device ball detection, full-frame normalized coords.
export type BallPoint = {
  t: number; // clip time in seconds
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  score: number; // detector confidence 0..1
};

// One person followed through the clip, ready to feed the single-athlete
// measurement pipeline.
export type PersonTrack = {
  id: number;
  frames: LandmarkFrame[];
  // Ranking components, 0..1 across the clip's tracks.
  score: number;
  motion: number;
  size: number;
  centered: number;
};

export type DetectorFamily = "swing" | "jump" | "platform";

export type RepWindow = {
  startS: number;
  contactS: number | null;
  endS: number;
  detector: DetectorFamily;
  // Detector fit 0..1: how cleanly the motion matched the family template.
  fit: number;
};

export type MeasurementValue = number | number[] | string | boolean;

export type Measurement = {
  value: MeasurementValue;
  unit: string;
  confidence: number; // 0..1
};

export type RepMeasurements = {
  start_s: number;
  contact_s: number | null;
  end_s: number;
  detector: DetectorFamily;
  metrics: Record<string, Measurement>;
};

export type MeasurementsBlock = {
  version: number;
  capture: {
    dense_fps: number | null;
    // "full" = every presented frame of the trimmed window; "windows"/
    // "probes" are legacy captures from the peak-windowed sampler.
    coverage: "windows" | "probes" | "full";
    engine: string;
  };
  units: string;
  reps: RepMeasurements[];
  session: Record<string, number>;
  omitted_below_confidence: string[];
};

export const UNITS_NOTE =
  "body-relative: heights in standing-body-heights, widths in shoulder-widths, angles in degrees, time in seconds";

// The landmarker's VIDEO mode needs strictly increasing timestamps, but real
// clip times regress between capture phases (probes sweep the clip, then the
// dense windows revisit earlier moments). This clock keeps REAL inter-frame
// spacing inside each monotonic run — what the temporal filter actually uses —
// and rebases by an offset whenever the input time steps backwards, instead of
// discarding real timing for a fixed synthetic tick.
export function createMonotonicClock(minStepMs = 33.34): (tMs: number) => number {
  let last = Number.NEGATIVE_INFINITY;
  let offset = 0;
  return (tMs: number): number => {
    let ts = tMs + offset;
    if (!(ts > last)) {
      offset = last + minStepMs - tMs;
      ts = tMs + offset;
    }
    last = ts;
    return ts;
  };
}

// Per-frame keypoints persisted alongside the sent frames so the results page
// can draw skeletons without refetching the dense file.
export type FrameKeypoints = {
  frame_index: number;
  time_s: number | null;
  pts: Landmark[] | null;
};

// A normalized bounding box at a clip time, for viewer overlays.
export type TimedBox = {
  t: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

// Shape of the keypoints.json object uploaded to storage. Version 2 adds the
// timed on-device ball track; version-1 files simply have no ball array.
// `others` (optional, additive) carries the non-followed players' timed
// boxes so the results player can show who else was on the court. Version 3
// keeps the same shape but `frames` covers the whole trimmed window (full-
// clip capture) instead of short windows around motion peaks.
export type KeypointsFile = {
  version: number;
  clip_duration_s: number | null;
  frames: LandmarkFrame[];
  ball?: BallPoint[];
  others?: TimedBox[][];
};
