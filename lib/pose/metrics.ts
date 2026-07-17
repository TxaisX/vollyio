// Per-skill metric definitions over detected reps. Pure and DOM-free.
//
// The contract that makes all six skills safe to ship: every metric carries a
// confidence, and only genuine noise is omitted (its name is listed in
// omitted_below_confidence, never its value); everything else is passed through
// WITH its confidence so the coaching service can weigh it.
//
// Confidence = confidenceScore(landmark visibility, detector fit, reliability):
// an affine remap of visibility x (0.8 + 0.2 x fit) x a per-metric reliability
// factor. The remap is calibrated to the on-device pose engine, whose peak
// scores are NOT MediaPipe visibilities: a cleanly-seen body joint reads ~0.70
// (not ~0.95) and legs/ankles ~0.55. Anchors: a clean body-joint mean (~0.70)
// maps to ~0.90 confidence at full fit and reliability; genuine occlusion
// (~0.40) falls below NOISE_FLOOR at any reliability, so it is omitted.
// Reliability attenuates the transmitted confidence; it is no longer a gate.

import type { Skill } from "../skills.ts";
import {
  LM,
  MEASUREMENTS_VERSION,
  UNITS_NOTE,
  type DetectorFamily,
  type LandmarkFrame,
  type Measurement,
  type MeasurementsBlock,
  type MeasurementValue,
  type RepMeasurements,
  type RepWindow,
} from "./types.ts";
import {
  angleAt,
  detectReps,
  dist,
  feetY,
  frameNearest,
  framesIn,
  headTop,
  hittingSide,
  landmarkSpeed,
  median,
  mid,
  segmentFrames,
  smooth,
  standingBaseline,
  stddev,
  visibilityMean,
  type Baseline,
} from "./kinematics.ts";

export const SKILL_FAMILY: Record<Skill, DetectorFamily> = {
  serve: "swing",
  attack: "swing",
  block: "jump",
  pass: "platform",
  dig: "platform",
  set: "platform",
};

// The single include/exclude gate. A metric whose confidence lands below this
// is genuine noise and is omitted (fail-closed abstain lane); anything at or
// above it is passed through carrying its confidence for the model to weigh.
export const NOISE_FLOOR = 0.4;
const MAX_REPS = 8;

type Ctx = {
  rep: RepWindow;
  repFrames: LandmarkFrame[];
  contact: LandmarkFrame | null;
  baseline: Baseline;
  side: "left" | "right";
};

type MetricDef = {
  key: string;
  unit: string;
  reliability: number;
  landmarks: number[];
  compute: (ctx: Ctx) => MeasurementValue | null;
};

function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

function wrist(ctx: Ctx, frame: LandmarkFrame) {
  return frame.pts[ctx.side === "left" ? LM.leftWrist : LM.rightWrist];
}
function elbow(ctx: Ctx, frame: LandmarkFrame) {
  return frame.pts[ctx.side === "left" ? LM.leftElbow : LM.rightElbow];
}
function shoulder(ctx: Ctx, frame: LandmarkFrame) {
  return frame.pts[ctx.side === "left" ? LM.leftShoulder : LM.rightShoulder];
}
function hip(ctx: Ctx, frame: LandmarkFrame) {
  return frame.pts[ctx.side === "left" ? LM.leftHip : LM.rightHip];
}
function offWrist(ctx: Ctx, frame: LandmarkFrame) {
  return frame.pts[ctx.side === "left" ? LM.rightWrist : LM.leftWrist];
}

// Height above ground in body heights: standing feet minus point, normalized.
function heightAboveGround(ctx: Ctx, y: number): number {
  return (ctx.baseline.footY - y) / ctx.baseline.bodyHeight;
}

function kneeAngle(frame: LandmarkFrame, side: "left" | "right"): number {
  return side === "left"
    ? angleAt(frame.pts[LM.leftHip], frame.pts[LM.leftKnee], frame.pts[LM.leftAnkle])
    : angleAt(frame.pts[LM.rightHip], frame.pts[LM.rightKnee], frame.pts[LM.rightAnkle]);
}

function minKneeAngle(frame: LandmarkFrame): number {
  return Math.min(kneeAngle(frame, "left"), kneeAngle(frame, "right"));
}

// Forearm platform line angle vs horizontal, averaged over both arms.
function platformAngle(frame: LandmarkFrame): number {
  const arm = (e: number, w: number) => {
    const dx = frame.pts[w].x - frame.pts[e].x;
    const dy = frame.pts[w].y - frame.pts[e].y;
    return (Math.atan2(Math.abs(dy), Math.abs(dx) + 1e-6) * 180) / Math.PI;
  };
  return (arm(LM.leftElbow, LM.leftWrist) + arm(LM.rightElbow, LM.rightWrist)) / 2;
}

// Landing frame: first time feet return near the standing baseline after contact.
function landingFrame(ctx: Ctx): LandmarkFrame | null {
  if (!ctx.contact) return null;
  const after = ctx.repFrames.filter((f) => f.t > ctx.contact!.t);
  for (const f of after) {
    if (ctx.baseline.footY - feetY(f) < ctx.baseline.bodyHeight * 0.03) return f;
  }
  return null;
}

// Plant frame: the lowest-feet moment before contact (load into the jump/swing).
function plantFrame(ctx: Ctx): LandmarkFrame | null {
  if (!ctx.contact) return null;
  const before = ctx.repFrames.filter((f) => f.t < ctx.contact!.t);
  if (before.length < 3) return null;
  let plant = before[0];
  for (const f of before) if (feetY(f) > feetY(plant)) plant = f;
  return plant;
}

// Max angle between the shoulder line and hip line in the load window before
// contact: the 2D projection of hip-shoulder separation ("X-factor"). A flat
// projection under-reads true separation, hence the low reliability.
function shoulderHipSeparation(ctx: Ctx): number | null {
  if (!ctx.contact) return null;
  const win = ctx.repFrames.filter(
    (f) => f.t < ctx.contact!.t && f.t >= ctx.contact!.t - 0.5,
  );
  if (win.length < 3) return null;
  const lineAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  let max = 0;
  for (const f of win) {
    const s = lineAngle(f.pts[LM.leftShoulder], f.pts[LM.rightShoulder]);
    const h = lineAngle(f.pts[LM.leftHip], f.pts[LM.rightHip]);
    let d = Math.abs(s - h);
    if (d > 180) d = 360 - d;
    max = Math.max(max, d);
  }
  return round(max, 0);
}

// Step events before contact from alternating ankle speed peaks.
function stepTimes(ctx: Ctx): number[] {
  const before = ctx.repFrames.filter((f) => !ctx.contact || f.t <= ctx.contact.t);
  if (before.length < 6) return [];
  const left = smooth(landmarkSpeed(before, LM.leftAnkle), 1);
  const right = smooth(landmarkSpeed(before, LM.rightAnkle), 1);
  const times: number[] = [];
  const floor = ctx.baseline.bodyHeight * 0.8;
  for (let i = 1; i < before.length - 1; i++) {
    const v = Math.max(left[i], right[i]);
    if (v < floor) continue;
    if (v >= Math.max(left[i - 1], right[i - 1]) && v >= Math.max(left[i + 1], right[i + 1])) {
      if (times.length === 0 || before[i].t - times[times.length - 1] > 0.12) {
        times.push(before[i].t);
      }
    }
  }
  return times;
}

// ---------------------------------------------------------------------------
// Metric tables

const SERVE: MetricDef[] = [
  {
    key: "toss_release_height",
    unit: "body_heights",
    reliability: 0.85,
    landmarks: [LM.leftWrist, LM.rightWrist, LM.nose],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const before = ctx.repFrames.filter((f) => f.t < ctx.contact!.t);
      if (before.length < 3) return null;
      const highest = Math.min(...before.map((f) => offWrist(ctx, f).y));
      return round(heightAboveGround(ctx, highest));
    },
  },
  {
    key: "toss_drift",
    unit: "shoulder_widths",
    reliability: 0.7,
    landmarks: [LM.leftWrist, LM.rightWrist],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const before = ctx.repFrames.filter((f) => f.t < ctx.contact!.t);
      if (before.length < 4) return null;
      let apex = before[0];
      for (const f of before) if (offWrist(ctx, f).y < offWrist(ctx, apex).y) apex = f;
      const drift = Math.abs(offWrist(ctx, apex).x - offWrist(ctx, before[0]).x);
      return round(drift / ctx.baseline.shoulderWidth);
    },
  },
  {
    key: "contact_height",
    unit: "body_heights",
    reliability: 0.95,
    landmarks: [LM.leftWrist, LM.rightWrist, LM.leftHeel, LM.rightHeel],
    compute: (ctx) =>
      ctx.contact ? round(heightAboveGround(ctx, wrist(ctx, ctx.contact).y)) : null,
  },
  {
    key: "elbow_angle_at_contact",
    unit: "deg",
    reliability: 0.9,
    landmarks: [LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist],
    compute: (ctx) =>
      ctx.contact
        ? round(angleAt(shoulder(ctx, ctx.contact), elbow(ctx, ctx.contact), wrist(ctx, ctx.contact)), 0)
        : null,
  },
  {
    key: "arm_extension_at_contact",
    unit: "deg",
    reliability: 0.85,
    landmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    compute: (ctx) =>
      ctx.contact
        ? round(angleAt(hip(ctx, ctx.contact), shoulder(ctx, ctx.contact), wrist(ctx, ctx.contact)), 0)
        : null,
  },
  {
    key: "follow_through_direction",
    unit: "deg_from_vertical",
    reliability: 0.75,
    landmarks: [LM.leftWrist, LM.rightWrist],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const after = ctx.repFrames.filter((f) => f.t > ctx.contact!.t && f.t <= ctx.contact!.t + 0.35);
      if (after.length < 2) return null;
      const a = wrist(ctx, after[0]);
      const b = wrist(ctx, after[after.length - 1]);
      const ang = (Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 180) / Math.PI;
      return round(ang, 0);
    },
  },
  {
    key: "body_rotation",
    unit: "deg",
    reliability: 0.7,
    landmarks: [LM.leftShoulder, LM.rightShoulder],
    compute: (ctx) => {
      if (!ctx.contact || ctx.repFrames.length < 3) return null;
      const line = (f: LandmarkFrame) =>
        (Math.atan2(
          f.pts[LM.rightShoulder].y - f.pts[LM.leftShoulder].y,
          f.pts[LM.rightShoulder].x - f.pts[LM.leftShoulder].x,
        ) * 180) / Math.PI;
      return round(Math.abs(line(ctx.contact) - line(ctx.repFrames[0])), 0);
    },
  },
  {
    key: "shoulder_hip_separation",
    unit: "deg",
    reliability: 0.65,
    landmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    compute: shoulderHipSeparation,
  },
];

const ATTACK: MetricDef[] = [
  {
    key: "approach_tempo",
    unit: "s_between_steps",
    reliability: 0.65,
    landmarks: [LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      const steps = stepTimes(ctx);
      if (steps.length < 3) return null;
      const gaps: number[] = [];
      for (let i = 1; i < steps.length; i++) gaps.push(round(steps[i] - steps[i - 1]));
      return gaps;
    },
  },
  {
    key: "penultimate_step_length",
    unit: "body_heights",
    reliability: 0.65,
    landmarks: [LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      const steps = stepTimes(ctx);
      if (steps.length < 2) return null;
      const f = frameNearest(ctx.repFrames, steps[steps.length - 1]);
      if (!f) return null;
      return round(dist(f.pts[LM.leftAnkle], f.pts[LM.rightAnkle]) / ctx.baseline.bodyHeight);
    },
  },
  {
    key: "arms_back_on_plant",
    unit: "bool",
    reliability: 0.6,
    landmarks: [LM.leftWrist, LM.rightWrist, LM.leftHip, LM.rightHip],
    compute: (ctx) => {
      const plant = plantFrame(ctx);
      if (!plant) return null;
      const hipY = mid(plant.pts[LM.leftHip], plant.pts[LM.rightHip]).y;
      return plant.pts[LM.leftWrist].y > hipY && plant.pts[LM.rightWrist].y > hipY;
    },
  },
  {
    key: "knee_flexion_at_plant",
    unit: "deg",
    reliability: 0.7,
    landmarks: [LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      const plant = plantFrame(ctx);
      return plant ? round(minKneeAngle(plant), 0) : null;
    },
  },
  {
    key: "shoulder_hip_separation",
    unit: "deg",
    reliability: 0.65,
    landmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    compute: shoulderHipSeparation,
  },
  {
    key: "jump_height",
    unit: "body_heights",
    reliability: 0.85,
    landmarks: [LM.leftAnkle, LM.rightAnkle, LM.leftHeel, LM.rightHeel],
    compute: (ctx) => {
      const highest = Math.min(...ctx.repFrames.map((f) => feetY(f)));
      const rise = (ctx.baseline.footY - highest) / ctx.baseline.bodyHeight;
      return rise > 0.02 ? round(rise) : null;
    },
  },
  {
    key: "contact_height",
    unit: "body_heights",
    reliability: 0.95,
    landmarks: [LM.leftWrist, LM.rightWrist],
    compute: (ctx) =>
      ctx.contact ? round(heightAboveGround(ctx, wrist(ctx, ctx.contact).y)) : null,
  },
  {
    key: "elbow_angle_at_contact",
    unit: "deg",
    reliability: 0.9,
    landmarks: [LM.leftElbow, LM.rightElbow],
    compute: (ctx) =>
      ctx.contact
        ? round(angleAt(shoulder(ctx, ctx.contact), elbow(ctx, ctx.contact), wrist(ctx, ctx.contact)), 0)
        : null,
  },
  {
    key: "landing_knee_flexion",
    unit: "deg",
    reliability: 0.75,
    landmarks: [LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      const land = landingFrame(ctx);
      if (!land) return null;
      const after = ctx.repFrames.filter((f) => f.t >= land.t && f.t <= land.t + 0.4);
      if (after.length === 0) return null;
      return round(Math.min(...after.map(minKneeAngle)), 0);
    },
  },
];

const BLOCK: MetricDef[] = [
  {
    key: "jump_height",
    unit: "body_heights",
    reliability: 0.85,
    landmarks: [LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      const highest = Math.min(...ctx.repFrames.map((f) => feetY(f)));
      const rise = (ctx.baseline.footY - highest) / ctx.baseline.bodyHeight;
      return rise > 0.02 ? round(rise) : null;
    },
  },
  {
    key: "hand_spacing",
    unit: "shoulder_widths",
    reliability: 0.8,
    landmarks: [LM.leftWrist, LM.rightWrist],
    compute: (ctx) =>
      ctx.contact
        ? round(
            dist(ctx.contact.pts[LM.leftWrist], ctx.contact.pts[LM.rightWrist]) /
              ctx.baseline.shoulderWidth,
          )
        : null,
  },
  {
    key: "verticality_drift",
    unit: "deg_from_vertical",
    reliability: 0.7,
    landmarks: [LM.leftHip, LM.rightHip],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const before = ctx.repFrames.filter((f) => f.t < ctx.contact!.t);
      if (before.length < 2) return null;
      const from = mid(before[0].pts[LM.leftHip], before[0].pts[LM.rightHip]);
      const to = mid(ctx.contact.pts[LM.leftHip], ctx.contact.pts[LM.rightHip]);
      const dy = Math.abs(to.y - from.y);
      if (dy < 1e-4) return null;
      return round((Math.atan2(Math.abs(to.x - from.x), dy) * 180) / Math.PI, 0);
    },
  },
  {
    key: "landing_knee_flexion",
    unit: "deg",
    reliability: 0.75,
    landmarks: [LM.leftKnee, LM.rightKnee],
    compute: (ctx) => {
      const land = landingFrame(ctx);
      if (!land) return null;
      const after = ctx.repFrames.filter((f) => f.t >= land.t && f.t <= land.t + 0.4);
      if (after.length === 0) return null;
      return round(Math.min(...after.map(minKneeAngle)), 0);
    },
  },
  {
    key: "hands_above_head_duration",
    unit: "s",
    reliability: 0.8,
    landmarks: [LM.leftWrist, LM.rightWrist, LM.nose],
    compute: (ctx) => {
      let duration = 0;
      for (let i = 1; i < ctx.repFrames.length; i++) {
        const f = ctx.repFrames[i];
        const up = f.pts[LM.leftWrist].y < headTop(f) && f.pts[LM.rightWrist].y < headTop(f);
        if (up) duration += f.t - ctx.repFrames[i - 1].t;
      }
      return duration > 0.05 ? round(duration) : null;
    },
  },
];

const PASS: MetricDef[] = [
  {
    key: "platform_angle",
    unit: "deg_from_horizontal",
    reliability: 0.8,
    landmarks: [LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist],
    compute: (ctx) => (ctx.contact ? round(platformAngle(ctx.contact), 0) : null),
  },
  {
    key: "platform_still_before_contact",
    unit: "s",
    reliability: 0.75,
    landmarks: [LM.leftWrist, LM.rightWrist],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      return round(Math.max(0, ctx.contact.t - ctx.rep.startS));
    },
  },
  {
    key: "knee_flexion_at_contact",
    unit: "deg",
    reliability: 0.8,
    landmarks: [LM.leftKnee, LM.rightKnee],
    compute: (ctx) => (ctx.contact ? round(minKneeAngle(ctx.contact), 0) : null),
  },
  {
    key: "footwork_pattern",
    unit: "pattern",
    reliability: 0.65,
    landmarks: [LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) => {
      if (ctx.repFrames.length < 4) return null;
      const first = ctx.repFrames[0];
      let crossed = false;
      const startOrder = first.pts[LM.leftAnkle].x < first.pts[LM.rightAnkle].x;
      for (const f of ctx.repFrames) {
        if (f.pts[LM.leftAnkle].x < f.pts[LM.rightAnkle].x !== startOrder) crossed = true;
      }
      return crossed ? "cross" : "shuffle";
    },
  },
  {
    key: "torso_lean",
    unit: "deg_from_vertical",
    reliability: 0.8,
    landmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const sh = mid(ctx.contact.pts[LM.leftShoulder], ctx.contact.pts[LM.rightShoulder]);
      const hp = mid(ctx.contact.pts[LM.leftHip], ctx.contact.pts[LM.rightHip]);
      const dy = Math.abs(hp.y - sh.y);
      if (dy < 1e-4) return null;
      return round((Math.atan2(Math.abs(hp.x - sh.x), dy) * 180) / Math.PI, 0);
    },
  },
];

const SET: MetricDef[] = [
  {
    key: "hands_above_forehead",
    unit: "bool",
    reliability: 0.8,
    landmarks: [LM.leftWrist, LM.rightWrist, LM.nose],
    compute: (ctx) =>
      ctx.contact
        ? ctx.contact.pts[LM.leftWrist].y < ctx.contact.pts[LM.nose].y &&
          ctx.contact.pts[LM.rightWrist].y < ctx.contact.pts[LM.nose].y
        : null,
  },
  {
    key: "elbow_extension_symmetry",
    unit: "deg_delta",
    reliability: 0.7,
    landmarks: [LM.leftElbow, LM.rightElbow],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const left = angleAt(
        ctx.contact.pts[LM.leftShoulder],
        ctx.contact.pts[LM.leftElbow],
        ctx.contact.pts[LM.leftWrist],
      );
      const right = angleAt(
        ctx.contact.pts[LM.rightShoulder],
        ctx.contact.pts[LM.rightElbow],
        ctx.contact.pts[LM.rightWrist],
      );
      return round(Math.abs(left - right), 0);
    },
  },
  {
    key: "leg_to_arm_sequence_lag",
    unit: "s",
    reliability: 0.6,
    landmarks: [LM.leftKnee, LM.rightKnee, LM.leftWrist, LM.rightWrist],
    compute: (ctx) => {
      if (!ctx.contact || ctx.repFrames.length < 5) return null;
      let extendStart: number | null = null;
      for (let i = 1; i < ctx.repFrames.length; i++) {
        if (ctx.repFrames[i].t >= ctx.contact.t) break;
        if (minKneeAngle(ctx.repFrames[i]) > minKneeAngle(ctx.repFrames[i - 1]) + 2) {
          extendStart = ctx.repFrames[i].t;
          break;
        }
      }
      if (extendStart == null) return null;
      return round(Math.max(0, ctx.contact.t - extendStart));
    },
  },
  {
    key: "shoulder_squareness",
    unit: "deg_from_horizontal",
    reliability: 0.75,
    landmarks: [LM.leftShoulder, LM.rightShoulder],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const dx = ctx.contact.pts[LM.rightShoulder].x - ctx.contact.pts[LM.leftShoulder].x;
      const dy = ctx.contact.pts[LM.rightShoulder].y - ctx.contact.pts[LM.leftShoulder].y;
      if (Math.abs(dx) < 1e-4) return null;
      return round((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI, 0);
    },
  },
];

const DIG: MetricDef[] = [
  {
    key: "lunge_depth",
    unit: "body_heights",
    reliability: 0.6,
    landmarks: [LM.leftHip, LM.rightHip],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const hipY = mid(ctx.contact.pts[LM.leftHip], ctx.contact.pts[LM.rightHip]).y;
      const standingHipY = ctx.baseline.footY - ctx.baseline.bodyHeight * 0.5;
      const drop = (hipY - standingHipY) / ctx.baseline.bodyHeight;
      return drop > 0.02 ? round(drop) : null;
    },
  },
  {
    key: "platform_angle",
    unit: "deg_from_horizontal",
    reliability: 0.75,
    landmarks: [LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist],
    compute: (ctx) => (ctx.contact ? round(platformAngle(ctx.contact), 0) : null),
  },
  {
    key: "recovery_time",
    unit: "s",
    reliability: 0.65,
    landmarks: [LM.nose],
    compute: (ctx) => {
      if (!ctx.contact) return null;
      const after = ctx.repFrames.filter((f) => f.t > ctx.contact!.t);
      for (const f of after) {
        if (Math.abs(headTop(f) - ctx.baseline.headY) < ctx.baseline.bodyHeight * 0.05) {
          return round(f.t - ctx.contact.t);
        }
      }
      return null;
    },
  },
  {
    key: "base_width",
    unit: "shoulder_widths",
    reliability: 0.75,
    landmarks: [LM.leftAnkle, LM.rightAnkle],
    compute: (ctx) =>
      ctx.contact
        ? round(
            dist(ctx.contact.pts[LM.leftAnkle], ctx.contact.pts[LM.rightAnkle]) /
              ctx.baseline.shoulderWidth,
          )
        : null,
  },
];

const METRIC_DEFS: Record<Skill, MetricDef[]> = {
  serve: SERVE,
  attack: ATTACK,
  block: BLOCK,
  pass: PASS,
  set: SET,
  dig: DIG,
};

// Public catalog of what can be measured per skill, for prompt construction
// and docs. Key and unit only; compute internals stay private.
export const MEASUREMENT_CATALOG: Record<Skill, { key: string; unit: string }[]> =
  Object.fromEntries(
    (Object.entries(METRIC_DEFS) as [Skill, MetricDef[]][]).map(([skill, defs]) => [
      skill,
      defs.map((d) => ({ key: d.key, unit: d.unit })),
    ]),
  ) as Record<Skill, { key: string; unit: string }[]>;

// The distinct landmark indices every metric for a skill depends on, sorted.
// The single source of truth for "which joints matter for this skill", so a
// capture-quality warning and the scoring gate agree on what to check.
export function keyJointsForSkill(skill: Skill): number[] {
  return [...new Set(METRIC_DEFS[skill].flatMap((d) => d.landmarks))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Block assembly

// Affine remap constants for the RTM visibility scale: 1.8*0.70 - 0.36 = 0.90
// (clean body joint -> high confidence) and 1.8*0.40 - 0.36 = 0.36 (occluded ->
// below NOISE_FLOOR for every reliability, since reliability and fit are <= 1).
const RTM_VIS_GAIN = 1.8;
const RTM_VIS_BIAS = -0.36;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// Pure confidence model, exported so the calibration can be pinned at named
// anchors. Visibility is remapped to the engine's real scale, attenuated by
// detector fit and the checkpoint's reliability.
export function confidenceScore(vis: number, fit: number, reliability: number): number {
  const visAdj = clamp01(RTM_VIS_GAIN * Math.max(0, vis) + RTM_VIS_BIAS);
  return clamp01(visAdj * (0.8 + 0.2 * fit) * reliability);
}

function metricConfidence(def: MetricDef, ctx: Ctx): number {
  const frames = ctx.repFrames.length > 0 ? ctx.repFrames : ctx.contact ? [ctx.contact] : [];
  if (frames.length === 0) return 0;
  const vis =
    frames.reduce((acc, f) => acc + visibilityMean(f, def.landmarks), 0) / frames.length;
  return confidenceScore(vis, ctx.rep.fit, def.reliability);
}

export function buildMeasurementsBlock(
  skill: Skill,
  frames: LandmarkFrame[],
  denseFps: number | null,
  engineName = "unknown",
  coverage: MeasurementsBlock["capture"]["coverage"] = "windows",
): MeasurementsBlock | null {
  if (frames.length < 8) return null;
  const baseline = standingBaseline(frames);
  if (!baseline || baseline.bodyHeight <= 0.05 || baseline.shoulderWidth <= 0.005) return null;

  const family = SKILL_FAMILY[skill];
  const reps = detectReps(family, frames, baseline).slice(0, MAX_REPS);
  if (reps.length === 0) return null;

  const omitted = new Set<string>();
  const repBlocks: RepMeasurements[] = [];

  for (const rep of reps) {
    const repFrames = framesIn(frames, rep.startS, rep.endS);
    if (repFrames.length < 4) continue;
    const contact = rep.contactS != null ? frameNearest(repFrames, rep.contactS) : null;
    const side = hittingSide(repFrames);
    const ctx: Ctx = { rep, repFrames, contact, baseline, side };

    const metrics: Record<string, Measurement> = {};
    for (const def of METRIC_DEFS[skill]) {
      const value = def.compute(ctx);
      if (value == null) {
        omitted.add(def.key);
        continue;
      }
      const confidence = metricConfidence(def, ctx);
      if (confidence < NOISE_FLOOR) {
        omitted.add(def.key);
        continue;
      }
      metrics[def.key] = { value, unit: def.unit, confidence: round(confidence) };
    }

    if (Object.keys(metrics).length === 0) continue;
    repBlocks.push({
      start_s: round(rep.startS),
      contact_s: rep.contactS != null ? round(rep.contactS) : null,
      end_s: round(rep.endS),
      detector: rep.detector,
      metrics,
    });
  }

  if (repBlocks.length === 0) return null;

  const session: Record<string, number> = { rep_count: repBlocks.length };
  const contactHeights = repBlocks
    .map((r) => r.metrics.contact_height?.value)
    .filter((v): v is number => typeof v === "number");
  if (contactHeights.length >= 2) {
    session.contact_height_stddev = round(stddev(contactHeights), 3);
  }
  const contactTimes = repBlocks
    .map((r) => r.contact_s)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (contactTimes.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < contactTimes.length; i++) gaps.push(contactTimes[i] - contactTimes[i - 1]);
    session.contact_interval_stddev = round(stddev(gaps), 3);
  }

  return {
    version: MEASUREMENTS_VERSION,
    capture: {
      dense_fps: denseFps,
      coverage,
      engine: engineName,
    },
    units: UNITS_NOTE,
    reps: repBlocks,
    session,
    omitted_below_confidence: [...omitted].sort(),
  };
}

// Exported for tests and for the extraction pipeline's contact-centered
// frame planning.
export function detectRepsForSkill(
  skill: Skill,
  frames: LandmarkFrame[],
): { reps: RepWindow[]; baseline: Baseline | null } {
  const baseline = standingBaseline(frames);
  return { reps: baseline ? detectReps(SKILL_FAMILY[skill], frames, baseline) : [], baseline };
}

export { segmentFrames };
