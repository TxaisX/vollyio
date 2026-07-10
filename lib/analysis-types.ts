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
  player_selection?: PlayerSelection;
};

// Which athlete the tracking followed in multi-player footage.
export type PlayerSelection = {
  candidates: number;
  selected_rank: number; // 1-based rank of the chosen track
  auto: boolean; // false when the user tapped a different player
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

export type AnalysisResult = {
  skill: Skill;
  discipline?: Discipline;
  overall_score: number;
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
};

export const MAX_FRAMES = 12;
export const MAX_BODY_BYTES = 4_000_000;
