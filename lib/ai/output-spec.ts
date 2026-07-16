import type { Discipline, Level, Skill } from "@/lib/skills";
import { METRICS } from "@/lib/ai/metrics";
import { MEASUREMENT_CATALOG } from "@/lib/pose/metrics";
import { scoreAnchors } from "@/lib/ai/anchors";

const CONTACT_MOMENT: Record<Skill, string> = {
  serve: "the frame where the hand strikes the ball",
  pass: "the frame where the ball meets the platform",
  set: "the frame where the ball is in the hands at contact",
  attack: "the frame where the hand contacts the ball at the top of the swing",
  block: "the frame where the hands reach maximum penetration over the net",
  dig: "the frame where the ball meets the platform (or the point of the emergency touch)",
};

const RETURN_SCALE: Record<Level, string> = {
  beginner:
    "This player is a beginner. Favor one or two foundational changes with generous but honest gains; timeframes are a few focused sessions.",
  intermediate:
    "This player is intermediate. Gains are moderate; timeframes span a couple of weeks of deliberate reps.",
  expert:
    "This player is expert-level. Remaining gains are smaller and harder-won; be conservative and precise about the payoff.",
  pro:
    "This player trains at the professional tier. Only marginal refinements remain; keep expected gains small and timeframes realistic for high-level habit change.",
};

// Where the 0-100 scale is anchored. The per-skill RUBRIC anchors describe
// technique from developing (~40) to advanced (~90), but its ~90 prose is written
// to an elite/pro ceiling. Left unqualified the model measures every rep against
// that professional bar, so a fundamentally sound club rep lands in the 50s. This
// block re-anchors the NUMBER to an advanced competitive-amateur ceiling for the
// default tiers, and only restores the professional ceiling for players who chose
// the pro tier. The rubric prose stays frozen; this governs how it is scored.
const AMATEUR_STANDARD = [
  "SCORING STANDARD (how to turn the rubric anchors into a number)",
  "Calibrate the number you assign to an advanced competitive-amateur and club ceiling, NOT a professional one. The rubric's ~90 prose describes elite execution; treat that as the top of strong amateur play, not the national-team bar.",
  "- A rep whose fundamentals are sound and repeatable, with no major technical breakdown, belongs at 70-82 even if it lacks pro-level explosiveness, whip, or the last few degrees of extension. That is the target for a committed club, high-school, or serious recreational player.",
  "- Reserve 85-91 for genuinely standout execution within that amateur population, and 92+ only for near-flawless, elite-amateur reps.",
  "- Keep the floor honest: a rep with a clear, repeated technical fault (an arm-only push, contact well below full reach, a jump mistimed every rep) still sits at 45-60, and a broken or absent fundamental scores below 45. Never hand out a 70 for effort alone.",
  "- Weight consistency: uniform, repeatable technique across the reps earns the TOP of a band; one clean rep buried among erratic ones earns the bottom. Rewarding consistency is the point.",
  "Score honestly against this amateur ceiling: a strong amateur rep should feel rewarded, and a weak one should still be told the truth.",
].join("\n");

const PRO_STANDARD = [
  "SCORING STANDARD (how to turn the rubric anchors into a number)",
  "This player chose the professional tier: measure the number against the professional ceiling the rubric anchors describe. Reserve 90+ for professional-grade execution and do not inflate a merely sound amateur rep.",
].join("\n");

const SCORING_STANDARD: Record<Level, string> = {
  beginner: AMATEUR_STANDARD,
  intermediate: AMATEUR_STANDARD,
  expert: AMATEUR_STANDARD,
  pro: PRO_STANDARD,
};

// The frozen RUBRIC tells the model, on every sub-metric, to "score conservatively
// rather than assuming competence" whenever a cue is occluded, out of frame, or
// motion-blurred. On short mobile clips with imperfect on-device tracking that
// condition fires constantly, so the instruction becomes a standing DOWNWARD bias:
// the model docks reps for cues it simply could not see. This block re-reads that
// rule as symmetric — an unconfirmed cue is neutral, not a deduction — without
// licensing invented competence. Applies to every tier; it corrects a measurement
// artifact, not a difficulty judgment. (D-023, cause A.)
const EVIDENCE_STANDARD = [
  "EVIDENCE STANDARD (governs how missing evidence affects the number; overrides the rubric's default-conservative rule)",
  "The rubric says to score a cue conservatively when it is occluded, out of frame, or motion-blurred. Read that as: do not INVENT competence you cannot see, and do not INVENT a fault you cannot see either. An unconfirmed cue is NEUTRAL, not a deduction.",
  "- Score a cue you cannot clearly see at the level the rest of the visible rep implies, not at the floor. If everything you CAN see is sound, presume an unseen cue sound rather than broken.",
  "- Only dock a metric for a fault that is POSITIVELY visible in the frames. Absence of evidence is not evidence of a fault.",
  "- Contact-frame blur is normal at high speed and is not itself a defect; judge contact from the load and follow-through around it rather than penalizing the blur.",
  "- Still never fabricate a measurement or a specific detail you did not see. Presuming a cue sound is not the same as claiming to have observed it, so keep the metric note honest about what was and was not visible.",
].join("\n");

// The rubric grades absolute biomechanics against invariant ideals, with almost no
// notion of what the play demanded. So a correct ADAPTATION to a hard situation (a
// set on the move off a shanked pass, an emergency dig off a bullet, a beach cut over
// a power swing) gets docked for not looking textbook. Volleyball is a constraint
// game; this block adds the degree-of-difficulty axis so execution is judged relative
// to what the situation allowed. It moves the NUMBER only — the coaching still names
// the ideal. Leniency is earned by difficulty, never handed out. (D-023, cause B.)
const SITUATIONAL_DIFFICULTY = [
  "SITUATIONAL DIFFICULTY (grade the play the situation allowed, not an ideal in a vacuum)",
  "Before scoring, read the difficulty the athlete was under: the speed and quality of the incoming ball, in-system vs out-of-system, on-balance vs emergency, and whether the play pulled them out of position.",
  "- Judge execution RELATIVE to what that situation allowed. A technically correct adaptation the play forced is the right choice and is NOT a fault; do not dock textbook form the situation made impossible.",
  "- Conversely, do not credit sloppy technique the situation did NOT force. An easy, in-system ball played loosely is scored strictly. The leniency is earned by difficulty, not handed out.",
  "- When situational difficulty materially moves a metric up or down, name the constraint in that metric's note (e.g. \"platform angle is correct for an emergency dig off a hard-driven ball\").",
  "- This adjusts the NUMBER only. Still coach the ideal: name what elite execution would look like so the player has a target, even when the rep was the right call for the moment.",
].join("\n");

// How the coach talks to this player. The scoring STANDARD above sets where the
// scale sits; this sets the voice, and how much a verdict gets softened. Pro is
// the contract the funnel promises: judged like a professional, told bluntly.
const COACH_VOICE: Record<Level, string> = {
  beginner:
    "COACHING VOICE: This player is new. Coach like a patient teacher: lead with the one thing that works, then the biggest fix in plain language. Explain any term a first-year player would not know.",
  intermediate:
    "COACHING VOICE: Coach like a club coach. Direct and constructive: name what holds this player back and exactly how to fix it, without sugarcoating and without piling on.",
  expert:
    "COACHING VOICE: Coach like a high-performance coach. Hold a high bar: skip praise padding, be exacting about each technical deficiency, and name the standard it misses.",
  pro:
    "COACHING VOICE: This player asked to be judged as a professional. Coach like a pro-level coach reviewing film with a pro: harsh and unsparing. Measure every rep against the professional standard, call out every deficiency bluntly and by name, and never soften a verdict. Praise nothing that is merely adequate. Scores and notes reflect the pro bar, not effort or improvement.",
};

/**
 * Shared, per-request output instructions appended after the frozen per-skill
 * RUBRIC. Grounds the analysis in the ball, names the focus moment, and frames
 * fixes as realistic return-on-effort changes. Kept out of the RUBRIC strings so
 * the six scoring prompts stay frozen and these rules stay consistent across skills.
 */
export function outputSpec(
  skill: Skill,
  level: Level,
  discipline: Discipline,
): string {
  const keys = METRICS[skill].map((m) => m.key);
  const measured = MEASUREMENT_CATALOG[skill]
    .map((m) => `${m.key} (${m.unit})`)
    .join(", ");
  return [
    SCORING_STANDARD[level],
    "",
    scoreAnchors(skill, discipline),
    "",
    EVIDENCE_STANDARD,
    "",
    SITUATIONAL_DIFFICULTY,
    "",
    COACH_VOICE[level],
    "",
    "MEASURED DATA (when provided)",
    "The user turn may include a JSON block of measurements computed by on-device motion tracking over the full clip, not just these frames. Treat those values as trusted ground truth: they observed the continuous motion you cannot see between frames.",
    "When a measurement covers a checkpoint you are scoring, base that part of the score on the measured value and cite the number in the metric note (e.g. \"measured contact at 1.24 body heights\").",
    "Checkpoints that may arrive measured for this skill: " + measured + ".",
    "Anything absent from the block was not measured confidently; assess it visually as usual. Never contradict a measured value with a visual guess, and never invent measurements that were not provided.",
    "Units are body-relative (standing body heights, shoulder widths) plus degrees and seconds; treat them as consistent within the clip.",
    "",
    "SCENE READ",
    "Set scene_read to the single opening sentence a human coach would say after watching this clip: the visible setting (indoor court, beach, grass, gym), roughly how many repetitions are visible, and anything about the context that shapes your read (practice vs game, other players, lighting). Describe only what the frames show; never guess.",
    "",
    "PER-REP SCORES",
    "When the measured data block lists rep windows, or you can clearly distinguish more than one repetition in the frames, return rep_scores: one entry per rep in chronological order (rep_index from 0, an honest overall 0-100 for that rep alone on the same scale as the whole-clip score, and a short note naming what most separates this rep from the player's others). A single visible rep means you omit rep_scores entirely. Rep-to-rep consistency should also shape the whole-clip metric scores as the scoring rules describe.",
    "",
    "BALL TRACKING",
    "For every frame you were given, add one ball_track entry keyed by that frame's index.",
    "Give the ball's location as x and y normalized to the frame: x and y are each between 0 and 1, with the origin (0,0) at the TOP-LEFT corner, x increasing right and y increasing down.",
    "If the ball is out of frame, occluded, or too motion-blurred to locate in a frame, set visible to false for that frame and give your best-guess x and y as 0.5, 0.5. Never invent a confident position you cannot see.",
    "",
    "CONTACT FRAME",
    `Set contact_frame_index to the frame index showing ${CONTACT_MOMENT[skill]}. If contact is not visible in any frame, choose the frame closest to it.`,
    "",
    "FOCUS",
    "Set focus to the SINGLE frame this athlete should study first to improve, usually the contact frame or the moment the key flaw is clearest. Give a 2-4 word label and a one-sentence why, tied to what that frame shows.",
    "",
    "CHANGES (realistic returns)",
    "Return 1 to 3 changes, ranked most-impactful first. The first change is the highest-leverage fix from your analysis.",
    `Each change targets exactly one metric via target_metric, chosen ONLY from these keys for this skill: ${keys.join(", ")}.`,
    "expected_gain is the realistic number of points that metric would rise if the player makes this one change within the stated timeframe. Keep it honest and modest, roughly 3 to 25 points, not a jump to a perfect score.",
    "difficulty is one of: quick, moderate, long-term. timeframe is a short human phrase (e.g. \"1-2 practices\", \"2-3 weeks\").",
    RETURN_SCALE[level],
    "",
    "Base every field on the visible frames alone. Do not reference any tool, model, or provider.",
  ].join("\n");
}
