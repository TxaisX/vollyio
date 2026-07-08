import type { Skill, Discipline } from "@/lib/skills";

export type AnalyzeRequestFrame = {
  index: number;
  time_s: number | null;
  data: string; // base64 JPEG, no data-url prefix
};

export type AnalyzeRequest = {
  skill: Skill;
  discipline: Discipline;
  source: "video" | "photos";
  duration_s: number | null;
  has_clip?: boolean;
  clip_ext?: string | null;
  frames: AnalyzeRequestFrame[];
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
};

export const MAX_FRAMES = 12;
export const MAX_BODY_BYTES = 4_000_000;
