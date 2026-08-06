import type { Skill } from "../skills.ts";
import { METRICS } from "./metrics.ts";
import { pointerSpec } from "./pointers.ts";

const CONTACT_MOMENT: Record<Skill, string> = {
  serve: "the frame where the hand strikes the ball",
  pass: "the frame where the ball meets the platform",
  set: "the frame where the ball is in the hands at contact",
  attack: "the frame where the hand contacts the ball at the top of the swing",
  block: "the frame where the hands reach maximum penetration over the net",
  dig: "the frame where the ball meets the platform (or the point of the emergency touch)",
};

// One return-on-effort framing for every account (D-053): the per-level scale
// went with the coaching-level setting.
const RETURN_SCALE =
  "Size each expected gain to what the named change actually buys within the stated timeframe: honest and specific, neither inflated nor padded down.";

// Where the 0-100 scale is anchored. ONE standard for every account (D-037):
// the advanced-amateur ceiling, with the rubric's ~90 elite prose as the top of
// the scale. Per-tier scoring standards are gone; a 75 means the same thing on
// every profile. The player's level still shapes the coaching VOICE and the
// realism of expected gains, never where the bar sits.
const STANDARD = [
  "SCORING STANDARD (how to turn the rubric anchors into a number)",
  "Calibrate the number you assign to an advanced competitive-amateur and club ceiling, NOT a professional one. The rubric's prose describes WHAT to look at; its numeric anchors describe a professional scale and do NOT set your numbers. Remap the whole scale so the ceiling is a reachable 100: execution the rubric prose would call developing (~40 on its scale) scores 58-68 here when the mechanics are present but flawed; what it calls solid (~60-70) scores 70-84 here; its ~90 elite prose maps to 90-100 here, and execution you cannot fault for this population scores 100.",
  "Score each checkpoint on its own evidence, independently. One fault must not bleed into every number: a genuinely strong jump still scores in the 70s or higher even when the contact that follows it is late or out of position. Only the checkpoints the fault actually lives in carry it.",
  "- A checkpoint executed with sound, repeatable mechanics belongs at 72-84 even if it lacks pro-level explosiveness, whip, or the last few degrees of extension. That is the target for a committed club, high-school, or serious recreational player.",
  "- Reserve 85-93 for genuinely standout execution within that amateur population.",
  "- Reserve 94-100 for near-flawless to flawless execution: a checkpoint with clean, repeatable mechanics and no correctable fault reaches 96-100, and a checkpoint you cannot fault at all for this competitive-amateur population is a 100. A rep whose every checkpoint is flawless earns 100 overall; 100 is real and attainable, not a number you withhold on principle.",
  "- A checkpoint with a clear, repeated technical fault sits at 55-68 depending on what the fault costs; the athletic foundation underneath it still counts toward the number, and the note names the fault bluntly.",
  "- Reserve scores below 50 for a fundamental that is broken or absent outright (no approach at all, no arm draw, a push instead of a swing), not for a present-but-flawed one.",
  "- Weight consistency: uniform, repeatable technique across the reps earns the TOP of a band; one clean rep buried among erratic ones earns the bottom. Rewarding consistency is the point.",
  "The shape this produces: a rep with a real athletic foundation and one clear fault lands in the mid-to-high 60s overall, not the 40s; a rep with no correctable fault left across every checkpoint reaches 100. Keep the floor honest in the notes, price the fault against what works rather than instead of it, and never hand out a 70 for effort alone.",
].join("\n");

// One voice for every account (D-053): the coaching-level selector is gone.
// The single STANDARD above sets where the scale sits; this sets only how the
// coach talks.
const COACH_VOICE =
  "COACHING VOICE: Coach like a high-performance coach reviewing film with a serious player. Hold a high bar: skip praise padding, be exacting about each technical deficiency and name the standard it misses, in plain language any player can follow.";

/**
 * Shared, per-request output instructions appended after the frozen per-skill
 * RUBRIC. Grounds the analysis in the ball, names the focus moment, and frames
 * fixes as realistic return-on-effort changes. Kept out of the RUBRIC strings so
 * the six scoring prompts stay frozen and these rules stay consistent across skills.
 */
// Strict-evidence block (D-095), appended only when the caller asks for it.
// Everything here is enforced in code by enforceEvidence(), so this text is
// telling the model what the parser will do rather than asking it for a favor.
// The physical limits are stated because a model that does not know the
// athlete is a quarter of frame height will confidently report finger pads.
const STRICT_EVIDENCE = [
  "EVIDENCE REQUIREMENT (enforced after you reply, not a request)",
  "Two SEPARATE questions. Answer them in order and never let the first decide the second.",
  "1. CAN YOU SEE IT? Name the frame where the mechanic is resolvable, in that pointer's `frame` field. Every judged verdict needs one: met, partial and missed alike. A judged verdict whose `frame` is absent or outside the range of frames you were sent is REPLACED with not_visible before scoring.",
  "2. WAS IT DONE WELL? Only now choose between met, partial and missed. Seeing a mechanic clearly is NOT a reason to mark it met. A perfectly visible flaw is `missed`. A perfectly visible but imperfect execution is `partial`.",
  "",
  "THE BAR FOR met",
  "met means you would show this rep to another player as an example of the mechanic done CORRECTLY. Not merely present. Not roughly right. Correct.",
  "partial is the honest verdict for a mechanic that is there but flawed, inconsistent, late, or approximate, and on real footage of real players it is the MOST COMMON verdict. A rep where most pointers are met is a rep with almost nothing left to coach, which is rare.",
  "missed is for a mechanic the athlete visibly does not perform, in a phase that is on camera.",
  "If you find yourself marking nearly every pointer met, re-read the rep against the bar above: you are grading visibility, not execution.",
  "",
  "WHAT THIS FOOTAGE PHYSICALLY CANNOT SHOW",
  "The clip is a phone recording from the sideline. The athlete may occupy a quarter of the frame height, so a hand is tens of pixels and a finger is a few. Contact lasts 50 to 150 milliseconds, which is often less than one sampled frame. There is NO AUDIO: you receive images only.",
  "Therefore: finger-pad versus palm contact, ball spin off the hands, limb velocity, and whether a contact was quiet or a carry are usually NOT resolvable. If you cannot point to a frame where the detail is genuinely legible, the honest verdict is not_visible.",
  "A pointer asking whether something REPEATS cannot be answered from a single repetition. A pointer asking about SOUND cannot be answered from images at all. Both are forced to not_visible in code regardless of what you return.",
  "",
  "Abstaining is not a failure and never lowers the athlete's score: not_visible pointers are excluded from the arithmetic entirely. Over-claiming is the failure, because it credits an athlete for mechanics nobody saw.",
].join("\n");

/**
 * Video-mode overrides (2026-08-05).
 *
 * The schema is frozen and every `*_frame_index` field stays an integer, so
 * video re-purposes them to carry TENTHS OF A SECOND from clip start (2.4s ->
 * 24). That is the convention the eval harness has used since 2026-08-04, and
 * it keeps one schema, one derivation and one UI across both modalities.
 *
 * The sampling paragraph is the load-bearing part. Measured 2026-08-05, the
 * provider ingests video at roughly one low-resolution image per second and
 * there is no parameter that raises it. A contact lasting 50-150ms is therefore
 * almost never IN the sample, and a model that has not been told this will
 * confidently grade it anyway: D-094 measured 0.0% not_visible across 108 runs,
 * which is the exact shape of a model answering questions it cannot see. Naming
 * the limit is the only lever this prompt has over that.
 */
const VIDEO_MODE = [
  "WHAT YOU ARE LOOKING AT, AND WHAT IT COSTS YOU",
  "You receive this rep as VIDEO, not as a frame sequence. You do not see every frame: the clip is sampled at roughly ONE IMAGE PER SECOND at low resolution. A volleyball contact lasts 50 to 150 milliseconds, so the instant of contact is usually NOT among the images you received, however continuous the motion appears to you.",
  "Judge what persists across the rep: approach rhythm, body shape, platform or hand position, extension, balance, landing. Those survive at one image per second. Do NOT judge what lives inside a single instant unless you can genuinely see it, and do not reconstruct it from what came before and after.",
  "You will feel able to describe the contact. That feeling is not evidence. If the decisive instant was not in an image you actually received, the honest verdict is not_visible.",
  "",
  "HOW TO REPORT MOMENTS",
  "Every field named *_frame_index carries TENTHS OF A SECOND from the start of the clip, not a frame number. A moment 2.4 seconds in is 24. A moment 0.7 seconds in is 7. The same applies to each pointer's `frame` field. Never report a value beyond the clip length you were told.",
].join("\n");

export function outputSpec(skill: Skill, strict = false, video = false): string {
  const keys = METRICS[skill].map((m) => m.key);
  return [
    ...(video ? [VIDEO_MODE, ""] : []),
    ...(strict ? [STRICT_EVIDENCE, ""] : []),
    STANDARD,
    "",
    COACH_VOICE,
    "",
    "SUBJECT CHECK",
    "Before anything else, state who you analyzed. Set subject_check.analyzed to a short physical description of that one person as they appear in the frames: jersey or kit color, number if legible, and where they are on the court (e.g. \"player in the red jersey, number 7, left-side attacker\"). Describe appearance and position only; never guess a name.",
    "Set subject_check.marker_match to exactly one of these words, and nothing else:",
    "- \"confirmed\" when a gold ring marker marks the focus athlete in one frame and the person you analyzed is that athlete.",
    "- \"mismatch\" when a ring marker is present but you had to analyze someone else, for example because the marked athlete is out of frame, occluded, or never performs the skill. Say which person you analyzed instead in the analyzed field.",
    "- \"unmarked\" when no ring marker is present, so you chose the subject yourself from the frames.",
    "If a ring marker is present, the ringed athlete is the subject in EVERY frame, not only the marked one: follow that same individual across the whole sequence by kit, build, and position, and do not switch to a different person because they are more prominent or more skilled. If you cannot confidently identify the ringed athlete in a later frame, say so in the relevant note rather than guessing.",
    "",
    "PER-REP SCORES",
    "When you can clearly distinguish more than one repetition in the frames, return rep_scores: one entry per rep in chronological order (rep_index from 0, an honest overall 0-100 for that rep alone on the same scale as the whole-clip score, and a short note naming what most separates this rep from the player's others). A single visible rep means you omit rep_scores entirely. Rep-to-rep consistency should also shape the whole-clip metric scores as the scoring rules describe.",
    "",
    "CONTACT FRAME",
    video
      ? `Set contact_frame_index to WHEN ${CONTACT_MOMENT[skill].replace("the frame where", "")} occurs, in tenths of a second from clip start. Give your best estimate from the images you received; do not invent precision you do not have.`
      : `Set contact_frame_index to the frame index showing ${CONTACT_MOMENT[skill]}. If contact is not visible in any frame, choose the frame closest to it.`,
    "",
    "FOCUS",
    video
      ? "Set focus to the SINGLE moment this athlete should study first to improve, as tenths of a second from clip start, usually the contact or the moment the key flaw is clearest. Give a 2-4 word label and a one-sentence why, tied to what that moment shows."
      : "Set focus to the SINGLE frame this athlete should study first to improve, usually the contact frame or the moment the key flaw is clearest. Give a 2-4 word label and a one-sentence why, tied to what that frame shows.",
    "",
    "CHANGES (realistic returns)",
    "Return 1 to 3 changes, ranked most-impactful first. The first change is the highest-leverage fix from your analysis.",
    `Each change targets exactly one metric via target_metric, chosen ONLY from these keys for this skill: ${keys.join(", ")}.`,
    "expected_gain is the realistic number of points that metric would rise if the player makes this one change within the stated timeframe. Keep it honest and modest, roughly 3 to 25 points, not a jump to a perfect score.",
    "difficulty is one of: quick, moderate, long-term. timeframe is a short human phrase (e.g. \"1-2 practices\", \"2-3 weeks\").",
    RETURN_SCALE,
    "",
    "SUMMARY AND WHAT WAS NOT VISIBLE",
    "The summary is 2-4 sentences on what most defines this player's rep quality right now. If any pointers were not_visible, end the summary with one short sentence naming what the footage did not show (for example: \"Not visible in this clip: the landing and the follow-through.\"). Unseen mechanics are excluded from every number and never lower a score; that closing sentence is the only place they appear.",
    "",
    pointerSpec(skill),
    "",
    "Judge the marked athlete's MECHANICS only. Never characterize the setting, occasion, or seriousness of the play (practice, pickup, recreational, casual, competitive) in any field: the same swing earns the same words and the same number on a championship court or a backyard one.",
    video
      ? "Base every field on what you actually saw in the clip alone. Do not reference any tool, model, or provider."
      : "Base every field on the visible frames alone. Do not reference any tool, model, or provider.",
  ].join("\n");
}
