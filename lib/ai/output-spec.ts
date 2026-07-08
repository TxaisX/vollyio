import type { Level, Skill } from "@/lib/skills";
import { METRICS } from "@/lib/ai/metrics";

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
  advanced:
    "This player is advanced. Remaining gains are smaller and harder-won; be conservative and precise about the payoff.",
  elite:
    "This player is elite. Only marginal refinements remain; keep expected gains small and timeframes realistic for high-level habit change.",
};

/**
 * Shared, per-request output instructions appended after the frozen per-skill
 * RUBRIC. Grounds the analysis in the ball, names the focus moment, and frames
 * fixes as realistic return-on-effort changes. Kept out of the RUBRIC strings so
 * the six scoring prompts stay frozen and these rules stay consistent across skills.
 */
export function outputSpec(skill: Skill, level: Level): string {
  const keys = METRICS[skill].map((m) => m.key);
  return [
    "BALL TRACKING",
    "For every frame you were given, add one ball_track entry keyed by that frame's index.",
    "Give the ball's location as x and y normalized to the frame: x and y are each between 0 and 1, with the origin (0,0) at the TOP-LEFT corner, x increasing right and y increasing down.",
    "If the ball is out of frame, occluded, or too motion-blurred to locate in a frame, set visible to false for that frame and give your best-guess x and y as 0.5, 0.5 — never invent a confident position you cannot see.",
    "",
    "CONTACT FRAME",
    `Set contact_frame_index to the frame index showing ${CONTACT_MOMENT[skill]}. If contact is not visible in any frame, choose the frame closest to it.`,
    "",
    "FOCUS",
    "Set focus to the SINGLE frame this athlete should study first to improve — usually the contact frame or the moment the key flaw is clearest. Give a 2-4 word label and a one-sentence why, tied to what that frame shows.",
    "",
    "CHANGES (realistic returns)",
    "Return 1 to 3 changes, ranked most-impactful first. The first change is the highest-leverage fix from your analysis.",
    `Each change targets exactly one metric via target_metric, chosen ONLY from these keys for this skill: ${keys.join(", ")}.`,
    "expected_gain is the realistic number of points that metric would rise if the player makes this one change within the stated timeframe. Keep it honest and modest — roughly 3 to 25 points — not a jump to a perfect score.",
    "difficulty is one of: quick, moderate, long-term. timeframe is a short human phrase (e.g. \"1-2 practices\", \"2-3 weeks\").",
    RETURN_SCALE[level],
    "",
    "Base every field on the visible frames alone. Do not reference any tool, model, or provider.",
  ].join("\n");
}
