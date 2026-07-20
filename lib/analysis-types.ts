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
  extra_frame_count?: number;
  // True when one sent frame carries a ring marker around the focus athlete
  // (D-033). marker_frame_index names that frame so the model is pointed at
  // it rather than left to find the ring.
  focus_marker?: boolean;
  marker_frame_index?: number;
};

// observed is false when the checkpoint's mechanics were not visible in the
// footage; such metrics are excluded from the overall. pointers carries the
// checklist verdicts the score was derived from (D-039). Both optional: older
// rows predate them and count as observed.
export type MetricPointer = { key: string; status: string };
export type Metric = {
  key: string;
  score: number;
  note: string;
  observed?: boolean;
  pointers?: MetricPointer[];
};
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

// The model's own account of who it graded. marker_match is a free-form string
// ("confirmed" | "mismatch" | "unmarked" by prompt guidance, not by schema), so
// readers must treat an unrecognized value as "no signal" rather than an error.
export type SubjectCheck = {
  analyzed: string;
  marker_match: string;
};

export type AnalysisResult = {
  skill: Skill;
  discipline?: Discipline;
  overall_score: number;
  // Who the model says it analyzed. Optional: rows predating this field, and
  // replies that omitted it, simply have none.
  subject_check?: SubjectCheck;
  // Per-rep mini-scores when more than one repetition was distinguishable.
  rep_scores?: RepScore[];
  metrics: Metric[];
  contact_frame_index: number;
  focus: Focus;
  insights: Insight[];
  changes: Change[];
  priority_fix: PriorityFix; // derived from changes[0] for back-compat readers
  drill_slugs: string[];
  summary: string;
  // Clip time of each sent frame by index, echoed from the request so viewers
  // can place sparse per-frame data (like ball marks) on the clip timeline.
  frame_times?: (number | null)[];
};

// Dense continuous coverage (D-041): the whole trim window at up to 6fps,
// capped by what one request can carry. The coach watches the clip, it does
// not get a highlight reel.
export const MAX_FRAMES = 40;
// Total frames stored permanently per analysis (send set + extras); only the
// send set ships to the model. Shared so the API schema accepts exactly what
// the extraction planner can produce.
export const MAX_STORED_FRAMES = 24;
export const MAX_BODY_BYTES = 4_000_000;
