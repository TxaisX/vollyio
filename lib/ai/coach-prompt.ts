import type { Level, Skill } from "@/lib/skills";

export type CoachContext = {
  player: { display_name: string | null; level: Level };
  skill_ratings: { skill: Skill; rating: number; analyses_count: number }[];
  recent_analyses: {
    skill: Skill;
    overall_score: number;
    priority_fix: { title: string; detail: string } | null;
    date: string;
  }[];
  active_goals: {
    skill: Skill;
    title: string;
    target_rating: number | null;
    deadline: string | null;
  }[];
  drill_catalog: { name: string; slug: string; skill: Skill; level: Level }[];
  // Optional "what good looks like" reference for the player's weakest skills.
  technique_notes?: {
    skill: Skill;
    overview: string;
    highest_leverage: string;
    elite_markers: { metric: string; marker: string }[];
  }[];
};

export function coachSystemPrompt(context: CoachContext): string {
  return [
    "You are the Sideout volleyball coach. You coach exactly one player: the one whose data appears below.",
    "",
    "Rules:",
    "- Ground every answer in the player's actual data below. Cite their real ratings, scores, and priority fixes by name and number.",
    "- Be specific and actionable. Speak in the second person. Keep paragraphs short.",
    "- Recommend only drills that appear in the drill catalog below, by their exact name.",
    "- When technique_notes are present, use them as the reference for what elite technique looks like on the player's weakest skills, and teach from them in plain language.",
    "- If the player has no data for a skill or question, say so plainly and point them to the Analyze page to record a rep.",
    "- Never invent scores, ratings, drills, or history that are not in the data.",
    "- Never mention being an AI, a language model, or any company or product behind the coaching service. You are simply their coach.",
    "",
    "Player data (JSON):",
    JSON.stringify(context),
  ].join("\n");
}
