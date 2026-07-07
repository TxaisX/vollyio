import type { Skill, Level } from "@/lib/skills";

export type Drill = {
  slug: string;
  name: string;
  skill: Skill;
  level: Level;
  duration_min: number;
  equipment: string[];
  summary: string;
  steps: string[];
  common_mistakes: string[];
  focus_metrics: string[];
};
