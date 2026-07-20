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

export type Level = "beginner" | "intermediate" | "expert" | "pro";

export function isSkill(value: string): value is Skill {
  return (SKILLS as readonly string[]).includes(value);
}

export const DISCIPLINES = ["indoor", "beach", "grass"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  indoor: "Indoor",
  beach: "Grass & sand",
  grass: "Grass & sand",
};

// One coach, two surfaces (D-035). Coaching resolves by GROUP: indoor stands
// alone; grass and sand are judged together as outdoor. All three wire values
// stay valid so stored rows and the database constraints are untouched;
// `beach` is a legacy capture value that new analyses no longer produce.
export type DisciplineGroup = "indoor" | "outdoor";

export function disciplineGroup(d: Discipline): DisciplineGroup {
  return d === "indoor" ? "indoor" : "outdoor";
}

// The stored wire values a group covers, for queries over historical rows.
export const GROUP_DISCIPLINES: Record<DisciplineGroup, readonly Discipline[]> = {
  indoor: ["indoor"],
  outdoor: ["beach", "grass"],
};

// What the capture and onboarding flows offer: one chip per group. `grass` is
// the stored value for the combined outdoor group.
export const ANALYZE_DISCIPLINES = ["indoor", "grass"] as const;

export function isDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}
