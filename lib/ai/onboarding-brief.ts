import { z } from "zod";
import { SKILL_LABEL, type Skill } from "../skills.ts";

// Turns the seven funnel answers into a goal a player recognises as theirs.
//
// The generic version this replaces was `${SKILL_LABEL[skill]} to ${target}` -
// "Attacking to 75" - which is accurate, unreadable as a motivation, and
// identical for every player who picked the same two dropdowns. This asks for
// the same fact in the player's own terms plus one line saying why that focus
// suits them specifically.
//
// WHAT THIS MUST NEVER DO, and the prompt is built around it: at the moment
// this runs the player has **zero analyses**. Nothing has been measured, no
// film has been seen. Any sentence implying otherwise is a fabricated
// observation dressed as coaching, which is the exact failure D-094 and D-099
// were written to prevent on the analysis side. The rules below are load
// bearing, not decoration.

export const onboardingBriefSchema = z.object({
  // The goal the player sees at the top of /goals. Bounded because it renders
  // on one line on a phone.
  goal_title: z.string().min(4).max(70),
  // One sentence on why this focus fits THEM, drawn only from what they told
  // the funnel. Bounded for the same reason.
  focus_note: z.string().min(20).max(220),
});

export type OnboardingBrief = z.infer<typeof onboardingBriefSchema>;

export const ONBOARDING_BRIEF_SYSTEM = [
  "You write the opening goal for a volleyball player who has just signed up.",
  "You have never seen them play. No footage, no measurements, no scores exist yet.",
  "",
  "Rules, all of them absolute:",
  "- Use ONLY the facts in the brief. Never state or imply anything about how they currently move, hit, jump or perform.",
  "- Never invent a number. The only number you may use is the target they chose.",
  "- Never say you have watched, analysed, reviewed or noticed anything about them.",
  "- Write to the player as 'you'. No greeting, no sign-off, no emoji, no long dashes.",
  "- The audience starts at 13. Plain words, nothing patronising, nothing hype.",
  "",
  "goal_title: what they are chasing, in their words, on one line. No score notation.",
  "focus_note: one sentence on why this focus makes sense for someone at their level, in their position, training at their frequency. It is a reason, not a promise.",
].join("\n");

export type BriefSeed = {
  skill: Skill;
  level: string;
  discipline: string;
  position?: string | null;
  playFrequency?: string | null;
  targetRating?: number | null;
  timeframeDays: number;
};

/**
 * The user turn. Every line is a fact the player supplied; nothing is derived,
 * because a derived "fact" is the first step toward an invented one.
 */
export function onboardingBriefPrompt(seed: BriefSeed): string {
  const lines = [
    `Skill they want to work on: ${SKILL_LABEL[seed.skill]}`,
    `Self-reported level: ${seed.level}`,
    `Discipline: ${seed.discipline}`,
  ];
  if (seed.position) lines.push(`Position: ${seed.position}`);
  if (seed.playFrequency) lines.push(`Plays: ${seed.playFrequency}`);
  if (seed.targetRating) {
    lines.push(
      `Target they set: ${seed.targetRating} out of 100 on ${SKILL_LABEL[seed.skill]}, within ${seed.timeframeDays} days`,
    );
  } else {
    lines.push(`No numeric target chosen. Timeframe: ${seed.timeframeDays} days.`);
  }
  lines.push(
    "",
    "They have run zero analyses. You know nothing about their technique.",
    "Write their opening goal and the one-line reason for it.",
  );
  return lines.join("\n");
}

// The deterministic fallback, and the reason the whole thing can fail open.
// This is exactly what shipped before personalization existed, so a model that
// times out, refuses or returns junk leaves the account no worse than it was.
export function fallbackGoalTitle(skill: Skill, targetRating?: number | null): string {
  return targetRating
    ? `${SKILL_LABEL[skill]} to ${targetRating}`
    : `Work on ${SKILL_LABEL[skill].toLowerCase()}`;
}
