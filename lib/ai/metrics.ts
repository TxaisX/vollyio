import type { Skill } from "@/lib/skills";

// The five-metric taxonomy per skill is intentionally shared across disciplines
// (indoor and beach) so that stored analyses and skill_ratings stay comparable.
// Only the 0-100 scoring anchors differ by discipline; that lives in RUBRIC, not here.
//
// weight is each metric's share of the overall (per skill the weights sum to 100,
// asserted in the tests). The overall is the weighted mean over OBSERVED metrics
// only (D-038/D-044-reconcile): a checkpoint that matters more to the skill moves
// the number more, and one that could not be seen is dropped and its weight taken
// out of the denominator. Weights are a code-side calibration knob (D-034), tuned
// against labeled cases, never through prompt wording.
export const METRICS: Record<Skill, { key: string; label: string; weight: number }[]> = {
  serve: [
    { key: "toss_quality", label: "Toss quality", weight: 22 },
    { key: "arm_swing", label: "Arm swing", weight: 22 },
    { key: "contact_point", label: "Contact point", weight: 24 },
    { key: "follow_through", label: "Follow-through", weight: 14 },
    { key: "body_alignment", label: "Body alignment", weight: 18 },
  ],
  pass: [
    { key: "platform_angle", label: "Platform angle", weight: 22 },
    { key: "body_posture", label: "Body posture", weight: 18 },
    { key: "footwork_to_ball", label: "Footwork to ball", weight: 22 },
    { key: "angle_to_target", label: "Angle to target", weight: 18 },
    { key: "contact_control", label: "Contact control", weight: 20 },
  ],
  set: [
    { key: "hand_shape", label: "Hand shape", weight: 24 },
    { key: "footwork", label: "Footwork", weight: 20 },
    { key: "body_alignment", label: "Body alignment", weight: 18 },
    { key: "release", label: "Release", weight: 18 },
    { key: "tempo_decision", label: "Tempo & decision", weight: 20 },
  ],
  attack: [
    { key: "approach_footwork", label: "Approach footwork", weight: 18 },
    { key: "jump_timing", label: "Jump timing", weight: 18 },
    { key: "arm_swing", label: "Arm swing", weight: 24 },
    { key: "contact_height", label: "Contact height", weight: 24 },
    { key: "power_followthrough", label: "Power & follow-through", weight: 16 },
  ],
  block: [
    { key: "read_timing", label: "Read & timing", weight: 24 },
    { key: "hand_penetration", label: "Hand penetration", weight: 24 },
    { key: "lateral_footwork", label: "Lateral footwork", weight: 20 },
    { key: "body_position", label: "Body position", weight: 18 },
    { key: "landing_recovery", label: "Landing & recovery", weight: 14 },
  ],
  dig: [
    { key: "ready_position", label: "Ready position", weight: 20 },
    { key: "read_anticipation", label: "Read & anticipation", weight: 24 },
    { key: "platform_control", label: "Platform control", weight: 22 },
    { key: "movement_pursuit", label: "Movement & pursuit", weight: 20 },
    { key: "recovery", label: "Recovery", weight: 14 },
  ],
};

export function metricKeys(skill: Skill): string[] {
  return METRICS[skill].map((m) => m.key);
}

export function metricLabel(skill: Skill, key: string): string {
  return METRICS[skill].find((m) => m.key === key)?.label ?? key;
}

export function metricWeight(skill: Skill, key: string): number {
  return METRICS[skill].find((m) => m.key === key)?.weight ?? 0;
}
