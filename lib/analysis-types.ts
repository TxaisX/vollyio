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

export type AnalysisResult = {
  skill: Skill;
  discipline?: Discipline;
  overall_score: number;
  metrics: Metric[];
  insights: Insight[];
  priority_fix: PriorityFix;
  drill_slugs: string[];
  summary: string;
};

export const MAX_FRAMES = 12;
export const MAX_BODY_BYTES = 4_000_000;
