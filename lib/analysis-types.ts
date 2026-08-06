import type { Skill, Discipline } from "@/lib/skills";

export type AnalyzeRequestFrame = {
  index: number;
  time_s: number | null;
  data: string; // base64 JPEG, no data-url prefix
};

export type AnalyzeRequest = {
  skill: Skill;
  discipline: Discipline;
  source: "video";
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
  // The metric's share of the overall (weights sum to 100 per skill). Optional:
  // rows stored before D-045 have none and render without a weight badge.
  weight?: number;
};
export type Insight = {
  frame_index: number;
  time_s: number | null;
  type: "strength" | "issue";
  observation: string;
};
// Always present: it is the analysis page's headline, so every row needs one and
// both paths derive it from their top-ranked change. The frame coordinates are
// optional because only the frame path can resolve an instant to point at.
export type PriorityFix = {
  title: string;
  detail: string;
  frame_index?: number;
  time_s?: number | null;
};

export type Focus = {
  frame_index: number;
  label: string;
  why: string;
  time_s: number | null;
};

// target_metric and expected_gain are optional because the VIDEO path has no
// checkpoints to target or to move (D-096). They are omitted there rather than
// filled with a plausible-looking metric key, because a change that claims to
// raise a checkpoint nothing measured is a number the player would act on.
export type Change = {
  title: string;
  detail: string;
  target_metric?: string;
  expected_gain?: number;
  difficulty: "quick" | "moderate" | "long-term" | string;
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
  // How much of the weighted checklist this clip supported, and whether that was
  // low enough to flag (< 60%). Optional: rows stored before D-045 have neither.
  coverage_pct?: number;
  low_confidence?: boolean;
  // Which calibration of the pointer-to-score mapping produced these numbers
  // (D-094). Absent means version 1, the scale every row carried before
  // versioning existed.
  scale_version?: number;
  // Who the model says it analyzed. Optional: rows predating this field, and
  // replies that omitted it, simply have none.
  subject_check?: SubjectCheck;
  // Which engine produced this row (D-096). Absent or 1 means the frame path:
  // Opus reading a dense frame sequence against the 120-pointer catalog, which
  // is the only thing that can fill metrics, insights and the frame indices.
  // 2 means the video path: one clip read holistically, which produces a score,
  // a summary, strengths and changes but has no per-checkpoint evidence to
  // report. Readers branch on this rather than sniffing for missing fields.
  result_version?: number;
  // Per-rep mini-scores when more than one repetition was distinguishable.
  rep_scores?: RepScore[];
  // EVERYTHING BELOW THIS LINE THAT IS OPTIONAL is optional because the video
  // path cannot honestly produce it, NOT because it is unimportant. The vision
  // provider samples video at roughly one low-resolution image per second, so
  // per-checkpoint verdicts come back 90-100% "met" (measured 2026-08-05:
  // median 97 with strict evidence enforcement on, which is every player being
  // told they are near-perfect), and a contact lasting 50-150ms is not in the
  // sample at all. Filling these on a video row would be inventing evidence.
  // v1 rows carry all of them and render exactly as they always have.
  metrics?: Metric[];
  contact_frame_index?: number;
  focus?: Focus;
  insights?: Insight[];
  changes: Change[];
  priority_fix: PriorityFix; // derived from changes[0] by BOTH paths
  drill_slugs: string[];
  summary: string;
  // Video path only: what the player did well. The frame path expresses this
  // through per-metric notes and `insights`, so it has none.
  strengths?: { title: string; detail: string }[];
  // The model's own confidence in the read, free-form. Video only.
  confidence?: string;
  // Clip time of each sent frame by index, echoed from the request so viewers
  // can place sparse per-frame data (like ball marks) on the clip timeline.
  frame_times?: (number | null)[];
};

// Dense continuous coverage (D-041), shaped to the movement (D-061). Raised
// 40 -> 64 without growing the request: context frames render at 640 while
// contact frames keep 1024, so the pixel pool is unchanged and the extra
// budget buys the approach back to a ~55ms stride.
//
// This number is MIRRORED BY A DATABASE TRIGGER. Changing it here alone
// recreates D-046, where a dense clip was read and BILLED and then rejected at
// the insert. The trigger ceiling lives in the newest migration that redefines
// private.enforce_analysis_insert_limit, and lib/security-contract.test.ts
// pins the two together.
export const MAX_FRAMES = 64;
// Total frames stored permanently per analysis (send set + extras); only the
// send set ships to the model. Shared so the API schema accepts exactly what
// the extraction planner can produce.
export const MAX_STORED_FRAMES = 24;
export const MAX_BODY_BYTES = 4_000_000;
