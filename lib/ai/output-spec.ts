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
  "Calibrate the number you assign to an advanced competitive-amateur and club ceiling, NOT a professional one. The rubric's prose describes WHAT to look at; its numeric anchors describe a professional scale and do NOT set your numbers. Remap the whole scale: execution the rubric prose would call developing (~40 on its scale) scores 58-68 here when the mechanics are present but flawed; what it calls solid (~60-70) scores 70-82 here; its ~90 elite prose is the top of this scale, not the middle of it.",
  "Score each checkpoint on its own evidence, independently. One fault must not bleed into every number: a genuinely strong jump still scores in the 70s even when the contact that follows it is late or out of position. Only the checkpoints the fault actually lives in carry it.",
  "- A checkpoint executed with sound, repeatable mechanics belongs at 70-82 even if it lacks pro-level explosiveness, whip, or the last few degrees of extension. That is the target for a committed club, high-school, or serious recreational player.",
  "- Reserve 85-91 for genuinely standout execution within that amateur population, and 92+ only for near-flawless, elite-amateur reps.",
  "- A checkpoint with a clear, repeated technical fault sits at 55-68 depending on what the fault costs; the athletic foundation underneath it still counts toward the number, and the note names the fault bluntly.",
  "- Reserve scores below 50 for a fundamental that is broken or absent outright (no approach at all, no arm draw, a push instead of a swing), not for a present-but-flawed one.",
  "- Weight consistency: uniform, repeatable technique across the reps earns the TOP of a band; one clean rep buried among erratic ones earns the bottom. Rewarding consistency is the point.",
  "The shape this produces: a rep with a real athletic foundation and one clear fault lands in the mid-to-high 60s overall, not the 40s. Keep the floor honest in the notes, price the fault against what works rather than instead of it, and never hand out a 70 for effort alone.",
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
export function outputSpec(skill: Skill): string {
  const keys = METRICS[skill].map((m) => m.key);
  return [
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
    RETURN_SCALE,
    "",
    "SUMMARY AND WHAT WAS NOT VISIBLE",
    "The summary is 2-4 sentences on what most defines this player's rep quality right now. If any pointers were not_visible, end the summary with one short sentence naming what the footage did not show (for example: \"Not visible in this clip: the landing and the follow-through.\"). Unseen mechanics are excluded from every number and never lower a score; that closing sentence is the only place they appear.",
    "",
    pointerSpec(skill),
    "",
    "Judge the marked athlete's MECHANICS only. Never characterize the setting, occasion, or seriousness of the play (practice, pickup, recreational, casual, competitive) in any field: the same swing earns the same words and the same number on a championship court or a backyard one.",
    "Base every field on the visible frames alone. Do not reference any tool, model, or provider.",
  ].join("\n");
}
