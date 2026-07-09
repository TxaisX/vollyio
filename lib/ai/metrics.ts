import type { Skill } from "@/lib/skills";

// The five-metric taxonomy per skill is intentionally shared across disciplines
// (indoor and beach) so that stored analyses and skill_ratings stay comparable.
// Only the 0-100 scoring anchors differ by discipline; that lives in RUBRIC, not here.
export const METRICS: Record<Skill, { key: string; label: string }[]> = {
  serve: [
    { key: "toss_quality", label: "Toss quality" },
    { key: "arm_swing", label: "Arm swing" },
    { key: "contact_point", label: "Contact point" },
    { key: "follow_through", label: "Follow-through" },
    { key: "body_alignment", label: "Body alignment" },
  ],
  pass: [
    { key: "platform_angle", label: "Platform angle" },
    { key: "body_posture", label: "Body posture" },
    { key: "footwork_to_ball", label: "Footwork to ball" },
    { key: "angle_to_target", label: "Angle to target" },
    { key: "contact_control", label: "Contact control" },
  ],
  set: [
    { key: "hand_shape", label: "Hand shape" },
    { key: "footwork", label: "Footwork" },
    { key: "body_alignment", label: "Body alignment" },
    { key: "release", label: "Release" },
    { key: "tempo_decision", label: "Tempo & decision" },
  ],
  attack: [
    { key: "approach_footwork", label: "Approach footwork" },
    { key: "jump_timing", label: "Jump timing" },
    { key: "arm_swing", label: "Arm swing" },
    { key: "contact_height", label: "Contact height" },
    { key: "power_followthrough", label: "Power & follow-through" },
  ],
  block: [
    { key: "read_timing", label: "Read & timing" },
    { key: "hand_penetration", label: "Hand penetration" },
    { key: "lateral_footwork", label: "Lateral footwork" },
    { key: "body_position", label: "Body position" },
    { key: "landing_recovery", label: "Landing & recovery" },
  ],
  dig: [
    { key: "ready_position", label: "Ready position" },
    { key: "read_anticipation", label: "Read & anticipation" },
    { key: "platform_control", label: "Platform control" },
    { key: "movement_pursuit", label: "Movement & pursuit" },
    { key: "recovery", label: "Recovery" },
  ],
};

export function metricKeys(skill: Skill): string[] {
  return METRICS[skill].map((m) => m.key);
}

export function metricLabel(skill: Skill, key: string): string {
  return METRICS[skill].find((m) => m.key === key)?.label ?? key;
}
