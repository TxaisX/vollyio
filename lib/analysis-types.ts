import type { Skill, Discipline } from "@/lib/skills";
import type { MeasurementsBlock } from "@/lib/pose/types";

export type AnalyzeRequestFrame = {
  index: number;
  time_s: number | null;
  data: string; // base64 JPEG, no data-url prefix
};

// Per-sent-frame landmarks for the results-page skeleton overlay: 33 points
// as a flat [x, y, z, v, ...] array of 132 numbers, rounded client-side.
export type FrameKeypointsWire = {
  frame_index: number;
  pts: number[];
};

export type AnalyzeRequest = {
  skill: Skill;
  discipline: Discipline;
  source: "video" | "photos";
  duration_s: number | null;
  has_clip?: boolean;
  clip_ext?: string | null;
  frames: AnalyzeRequestFrame[];
  // Motion-tracking sidecar, all optional; absence reproduces the pre-CV
  // request exactly.
  measurements?: MeasurementsBlock | null;
  frame_keypoints?: FrameKeypointsWire[];
  has_keypoints?: boolean;
  extra_frame_count?: number;
  // True when the sent frames carry a gold tracking ring on the focus athlete.
  focus_marker?: boolean;
  player_selection?: PlayerSelection;
  continuity?: ContinuityWire;
  // On-device tracked ball marks for the sent frames (D-019). When present
  // and plausible they replace the model's eyeballed ball_track in the stored
  // result and ride the request as trusted measured data.
  ball_track?: BallMark[];
};

// Which athlete the tracking followed in multi-player footage.
export type PlayerSelection = {
  candidates: number;
  selected_rank: number; // 1-based rank of the chosen track
  auto: boolean; // false when the user tapped a different player
};

// How the follow went, on the wire: evidenced occlusions and frame exits from
// lib/pose/track-state, snake-cased like every other transported field.
export type ContinuityAbsenceWire = {
  kind: "occluded" | "off_frame";
  edge?: "left" | "right" | "top" | "bottom";
  start_s: number;
  returned_at_s: number | null;
};
export type ContinuityWire = {
  coverage: number;
  lost: boolean;
  absences: ContinuityAbsenceWire[];
};

export type Metric = { key: string; score: number; note: string };
export type Insight = {
  frame_index: number;
  time_s: number | null;
  type: "strength" | "issue";
  observation: string;
};
export type PriorityFix = {
  title: string;
  detail: string;
  frame_index: number;
  time_s: number | null;
};

export type BallMark = {
  frame_index: number;
  x: number; // normalized 0-1, origin top-left
  y: number; // normalized 0-1, origin top-left
  visible: boolean;
};

export type Focus = {
  frame_index: number;
  label: string;
  why: string;
  time_s: number | null;
};

export type Change = {
  title: string;
  detail: string;
  target_metric: string;
  expected_gain: number;
  difficulty: "quick" | "moderate" | "long-term";
  timeframe: string;
};

export type RepScore = {
  rep_index: number;
  overall: number;
  note: string;
};

export type AnalysisResult = {
  skill: Skill;
  discipline?: Discipline;
  overall_score: number;
  // Coach-style opening line: setting, rep count, context. Optional: rows
  // predating this field simply omit it.
  scene_read?: string;
  // Per-rep mini-scores when more than one repetition was distinguishable.
  rep_scores?: RepScore[];
  metrics: Metric[];
  ball_track: BallMark[];
  contact_frame_index: number;
  focus: Focus;
  insights: Insight[];
  changes: Change[];
  priority_fix: PriorityFix; // derived from changes[0] for back-compat readers
  drill_slugs: string[];
  summary: string;
  // Motion-tracking sidecar (CV Phase 1). All optional: rows predating the
  // pipeline, photo analyses, and fallback extractions simply omit them.
  measurements?: MeasurementsBlock | null;
  frame_keypoints?: FrameKeypointsWire[];
  ball_track_source?: "model_estimate" | "tracked";
  player_selection?: PlayerSelection;
  continuity?: ContinuityWire;
  // Clip time of each sent frame by index, echoed from the request so viewers
  // can place sparse per-frame data (like ball marks) on the clip timeline.
  frame_times?: (number | null)[];
};

export const MAX_FRAMES = 12;
// Total frames stored permanently per analysis (send set + extras); only the
// send set ships to the model. Shared so the API schema accepts exactly what
// the extraction planner can produce.
export const MAX_STORED_FRAMES = 24;
export const MAX_BODY_BYTES = 4_000_000;
