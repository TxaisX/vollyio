// Human labels + display formatting for measured checkpoints. Pure and
// DOM-free so the breakdown page (server) and tests share one source of truth.
// Keys mirror the metric tables in lib/pose/metrics.ts.

import type { MeasurementValue } from "./types";

export const MEASUREMENT_LABELS: Record<string, string> = {
  // serve
  toss_release_height: "Toss release height",
  toss_drift: "Toss drift",
  contact_height: "Contact height",
  elbow_angle_at_contact: "Elbow angle at contact",
  arm_extension_at_contact: "Arm extension at contact",
  follow_through_direction: "Follow-through direction",
  body_rotation: "Body rotation",
  shoulder_hip_separation: "Shoulder-hip separation",
  // attack
  approach_tempo: "Approach tempo",
  penultimate_step_length: "Penultimate step",
  arms_back_on_plant: "Arms back on plant",
  jump_height: "Jump height",
  landing_knee_flexion: "Landing knee flexion",
  knee_flexion_at_plant: "Knee flexion at plant",
  // block
  hand_spacing: "Hand spacing",
  verticality_drift: "Verticality drift",
  hands_above_head_duration: "Hands above head",
  // platform family
  platform_angle: "Platform angle",
  platform_still_before_contact: "Platform still before contact",
  knee_flexion_at_contact: "Knee flexion at contact",
  footwork_pattern: "Footwork pattern",
  torso_lean: "Torso lean",
  hands_above_forehead: "Hands above forehead",
  elbow_extension_symmetry: "Elbow symmetry",
  leg_to_arm_sequence_lag: "Leg-to-arm lag",
  shoulder_squareness: "Shoulder squareness",
  lunge_depth: "Lunge depth",
  recovery_time: "Recovery time",
  base_width: "Base width",
};

export function measurementLabel(key: string): string {
  return MEASUREMENT_LABELS[key] ?? key.replaceAll("_", " ");
}

const dash = "–";

export function formatMeasurement(value: MeasurementValue, unit: string): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return `${value.map((v) => v.toFixed(2)).join(" · ")} s`;
  }
  if (typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  switch (unit) {
    case "deg":
      return `${Math.round(value)}°`;
    case "deg_delta":
      return `${Math.round(value)}° apart`;
    case "deg_from_vertical":
      return `${Math.round(value)}° off vertical`;
    case "deg_from_horizontal":
      return `${Math.round(value)}° from level`;
    case "body_heights":
      return `${value.toFixed(2)} body heights`;
    case "shoulder_widths":
      return `${value.toFixed(2)} shoulder widths`;
    case "s":
      return `${value.toFixed(2)}s`;
    case "s_between_steps":
      return `${value.toFixed(2)}s`;
    default:
      return `${value} ${unit.replaceAll("_", " ")}`;
  }
}

// "0:02" style clock stamp for rep boundaries.
export function clockStamp(seconds: number | null): string {
  if (seconds == null) return dash;
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(
    Math.floor((s % 1) * 10),
  )}`;
}
