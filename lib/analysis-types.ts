import type { Skill, Discipline } from "@/lib/skills";

// The request carries no pixels at all any more (D-097). The read is performed
// on the clip, the clip cannot fit in a 4.5 MB body, so it is uploaded to
// storage first and named here. What is left is small enough to describe in
// one shape, and lib/analyze-request.ts validates exactly this.
export type AnalyzeRequest = {
  skill: Skill;
  discipline: Discipline;
  source: "video";
  duration_s: number | null;
  // The clip, already in storage under the caller's own pending prefix. This id
  // is the only thing the route has to find the bytes with.
  pending_clip_id: string;
  clip_ext: "mp4" | "webm" | "mov";
  // Where the player tapped the athlete, normalized 0..1 across and down the
  // frame, at a time measured from the START of the trimmed clip. The ring the
  // frame path burned into a JPEG cannot be burned into a clip forwarded byte
  // for byte, so the mark travels as coordinates instead.
  focus_point?: { x: number; y: number; t_s: number };
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

// target_metric and expected_gain are optional because the VIDEO path makes no
// numeric promise about a checkpoint (D-097, amended D-099). The video path DOES
// name checkpoints now, but through `key` below, which says only which of the
// five dimensions a change is about. `target_metric` paired with `expected_gain`
// meant something stronger and different: that a specific checkpoint SCORE would
// rise by that many points. Nothing on this path measures a per-checkpoint
// score, so that pair stays absent rather than being filled with a
// plausible-looking metric key and a number the player would act on.
export type Change = {
  title: string;
  detail: string;
  target_metric?: string;
  expected_gain?: number;
  difficulty: "quick" | "moderate" | "long-term" | string;
  timeframe: string;
  // Which named checkpoint this change is about (D-099), as a METRICS[skill]
  // key. Distinct from `target_metric`, which was the frame path's claim that a
  // specific checkpoint SCORE would rise by `expected_gain`. This one makes no
  // numeric promise; it only says which of the five dimensions the point is
  // about, so the breakdown can tie the "what to change" column back to the
  // checkpoint that explains it.
  //
  // Optional because rows written before this shipped have none, including the
  // ones already in production. Readers must render without it.
  key?: string;
};

/**
 * One named checkpoint of a skill, as the video path can honestly report it.
 *
 * `key` is a METRICS[skill] key, so the label, the weight and the authored
 * "what 90 looks like" all resolve from the catalog. A key the model invents is
 * dropped by the route rather than stored.
 *
 * `visible` is the honest half. About ten low-resolution stills cannot show
 * every mechanic of every rep, and a checkpoint the footage hides has to be
 * able to say so instead of being described anyway. It is the same abstain lane
 * `ratable` gives the whole clip, one level down.
 *
 * There is deliberately no score and no met/missed verdict. See `checkpoints`
 * on AnalysisResult for why.
 */
export type AnalysisCheckpoint = {
  key: string;
  visible: boolean;
  /** What was seen of this checkpoint in this rep. Empty when not visible. */
  observation: string;
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
  // Who the model says it analyzed. Optional: rows predating this field, and
  // replies that omitted it, simply have none.
  subject_check?: SubjectCheck;
  // Which engine produced this row (D-097). Absent or 1 means the frame path:
  // a dense frame sequence read against the 120-pointer catalog, which is the
  // only thing that can fill metrics, insights and the frame indices. 2 means
  // the video path: one clip read holistically, which produces a score, a
  // summary, strengths and changes but has no per-checkpoint evidence to
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
  //
  // Three of these against two `changes` (D-099), and the asymmetry is the
  // product decision: five checkpoints, ranked into the three that were
  // strongest and the two that most need work. `key` names which checkpoint
  // each one is about, which is what lets the breakdown tie a verdict back to
  // the observation and the "what 90 looks like" that explains it.
  //
  // The fixed count is safe ONLY because it is a ranking over a fixed set. Ask
  // for three strengths in the abstract and a model will pad with generalities;
  // ask which three of five observed checkpoints were strongest and there is
  // nothing to invent. It is also the operation this model is good at: rank
  // correlation held at 0.708 across a re-anchor while the median moved
  // 55/78/97 (docs/model-findings-2026-08-05.md). Ordering survives what
  // absolute judgement does not. Counts come back lower when the clip did not
  // show enough of the rep, and that is correct rather than a bug.
  strengths?: { title: string; detail: string; key?: string }[];
  // The named checkpoints of the skill, observed rather than scored (D-099).
  //
  // This is deliberately NOT `Metric`. A Metric carries a 0-100 `score` derived
  // in code from per-pointer verdicts (lib/ai/pointers.ts), and that derivation
  // is exactly what ceiling-pegged on video: the model marked 90-100% of
  // pointers "met" and the arithmetic turned that into a median of 97 (D-094).
  // The verdict and the number were one bug, so the number is gone and with it
  // the pressure to inflate: nothing here feeds `overall_score`, which still
  // comes from the calibrated holistic read.
  //
  // What survives is what players actually wanted from that section: the names
  // of the things a coach looks at on this skill, and what was seen of each in
  // THIS rep. The cue text, the weights and the "what 90 looks like" prose are
  // authored content (lib/ai/metrics.ts, content/technique.ts) and are rendered
  // from the catalog, never from the reply, so they cost nothing and cannot be
  // hallucinated.
  checkpoints?: AnalysisCheckpoint[];
  // The model's own confidence in the read, free-form. Video only.
  confidence?: string;
  // Clip time of each sent frame by index, echoed from the request so viewers
  // can place sparse per-frame data (like ball marks) on the clip timeline.
  frame_times?: (number | null)[];
};

// The current engine. Stamped on every row this build writes, so a reader never
// has to date-guess which shape it is holding.
export const RESULT_VERSION_VIDEO = 2;

// The clip the video read is performed on, base64'd into one request.
//
// RAISED FROM 8 MB (D-100). The old number assumed every clip had been trimmed
// in the browser first, where a full-length window re-encodes to about 3 MB. A
// browser that cannot DECODE the clip cannot trim it either, and refusing those
// players was the dead end this constant helped create: an untrimmed phone
// recording is the whole file, and 1080p HEVC off an iPhone runs 8 to 10 Mbps,
// so ten seconds is already past 8 MB before anything has gone wrong.
//
// 20 MB is MEASURED, not assumed. Six real reads on 2026-08-06 walked the size
// up until the gateway refused: 21.4 MB of MP4 (28.6 MB base64) was accepted
// and scored, 25.4 MB (33.9 MB base64) was refused. The wall is a 32 MB request
// cap, and it fails badly: the connection is refused about a second in, before
// the upload completes, so it surfaces as a bare transport error rather than as
// anything a player could act on. That is the reason for a cap at all. 20 MB
// raw is 26.7 MB encoded, which leaves real margin under the wall for the JSON
// envelope and the rubric.
//
// An earlier draft of this comment said the limit was 20 MB per REQUEST and set
// the cap at 14 MB on that basis. That was wrong, and measuring it back was
// worth four minutes: it cost players roughly six megabytes of headroom.
//
// Worth knowing before anyone tries to buy more room by shrinking clips: SIZE
// IS NOT WHAT COSTS. Input tokens measured 2445 on every one of those reads,
// from 4.3 MB to 21.4 MB, because the provider bills per SECOND of footage at
// about 89 tokens. A bigger file of the same clip costs the same to read. What
// it costs is the player's upload time and this function's wall clock.
//
// It is a byte cap standing in for a duration cap, because a browser that
// cannot decode cannot tell us the duration either. That is a real limitation
// and the copy on the untrimmed path says so: keep it to one rep. A long clip
// is a quality problem independently of size, since the rubric asks about a
// single rep and has been measured silently picking one out of a 32 second
// multi-rep video without abstaining.
//
// This number is MIRRORED BY A STORAGE POLICY (migration 055). The two move
// together or a player uploads successfully and is then refused by the route
// that reads it; lib/security-contract.test.ts ties them.
export const MAX_CLIP_BYTES = 20_000_000;

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
