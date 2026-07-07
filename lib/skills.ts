export const SKILLS = ["serve", "pass", "set", "attack", "block", "dig"] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABEL: Record<Skill, string> = {
  serve: "Serving",
  pass: "Passing",
  set: "Setting",
  attack: "Attacking",
  block: "Blocking",
  dig: "Defense",
};

export const SKILL_BLURB: Record<Skill, string> = {
  serve: "Toss, arm swing, contact, follow-through",
  pass: "Platform, posture, footwork to the ball",
  set: "Hand shape, footwork, release, tempo",
  attack: "Approach, timing, arm swing, contact",
  block: "Read, penetration, footwork, landing",
  dig: "Ready position, reads, platform, pursuit",
};

export type Level = "beginner" | "intermediate" | "advanced" | "elite";

export function isSkill(value: string): value is Skill {
  return (SKILLS as readonly string[]).includes(value);
}

export const DISCIPLINES = ["indoor", "beach"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  indoor: "Indoor",
  beach: "Beach",
};

export function isDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}
