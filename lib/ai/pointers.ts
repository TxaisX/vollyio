import type { Skill } from "../skills.ts";

// The pointer catalog (D-039): every skill's score is a checklist of concrete,
// observable mechanical cues. The model judges each pointer met | partial |
// missed | not_visible; the NUMBER is derived here in code from those verdicts,
// never free-scored. Purely mechanics: a pointer the footage hides is excluded
// from the math instead of counting against the athlete.
//
// Kept dependency-light so routes, eval tooling, and scripts share one source
// of truth for both the catalog and the derivation.

export type Pointer = { key: string; cue: string };

export const POINTERS: Record<Skill, Record<string, Pointer[]>> = {
  serve: {
    toss_quality: [
      { key: "consistent_toss", cue: "Toss height and placement repeat rep to rep" },
      { key: "toss_in_front", cue: "Ball placed in front of the hitting shoulder" },
      { key: "lifted_no_spin", cue: "Ball lifted off the palm with little spin" },
      { key: "toss_arm_extends", cue: "Tossing arm extends fully on the release" },
    ],
    arm_swing: [
      { key: "high_elbow_load", cue: "Elbow drawn up and back above the shoulder" },
      { key: "bow_draw", cue: "Clear bow-and-arrow separation before the swing" },
      { key: "arm_accelerates", cue: "Arm accelerates through contact, a swing not a push" },
      { key: "wrist_snap", cue: "Wrist snaps through the top of the ball" },
    ],
    contact_point: [
      { key: "full_extension", cue: "Contact at full arm extension" },
      { key: "contact_in_front", cue: "Contact in front of the hitting shoulder" },
      { key: "firm_open_hand", cue: "Firm open hand square behind the ball" },
      { key: "repeatable_contact", cue: "Same contact point rep to rep" },
    ],
    follow_through: [
      { key: "finish_to_target", cue: "Swing finishes toward the target" },
      { key: "natural_deceleration", cue: "Arm decelerates naturally down and across" },
      { key: "balanced_finish", cue: "Body balanced after contact" },
      { key: "weight_transfers", cue: "Weight moves back-to-front through the serve" },
    ],
    body_alignment: [
      { key: "side_on_start", cue: "Hitting side loaded behind the ball at the start" },
      { key: "hips_rotate", cue: "Hips and shoulders rotate through contact" },
      { key: "stable_head", cue: "Head stable, eyes on the ball to contact" },
      { key: "square_finish", cue: "Body finishes facing the court, not falling away" },
    ],
  },
  pass: {
    platform_angle: [
      { key: "early_platform", cue: "Platform formed before the ball arrives" },
      { key: "angled_to_target", cue: "Platform angled so the rebound goes to target" },
      { key: "elbows_locked", cue: "Arms straight with elbows locked at contact" },
      { key: "level_wrists", cue: "Hands together, wrists level and even" },
    ],
    body_posture: [
      { key: "low_athletic_base", cue: "Knees bent in a low athletic stance at contact" },
      { key: "shoulders_forward", cue: "Shoulders ahead of the hips, leaning into the ball" },
      { key: "ball_played_in_front", cue: "Ball contacted in front of the body, arms away from torso" },
      { key: "quiet_upper_body", cue: "Upper body stays quiet, no swinging arms" },
    ],
    footwork_to_ball: [
      { key: "beats_ball", cue: "Feet arrive at the spot before the ball does" },
      { key: "centered_midline", cue: "Ball played on the midline of the body" },
      { key: "stopped_at_contact", cue: "Balanced and stopped at the moment of contact" },
      { key: "moves_not_reaches", cue: "Moves the feet to the ball instead of reaching" },
    ],
    angle_to_target: [
      { key: "faces_ball_angles_target", cue: "Body faces the ball while the platform faces the target" },
      { key: "inside_shoulder_drop", cue: "Outside shoulder drops to steer angled balls" },
      { key: "rebound_on_line", cue: "Rebound travels on the intended target line" },
      { key: "controlled_arc", cue: "Pass arcs high enough for the setter to run under" },
    ],
    contact_control: [
      { key: "forearm_contact", cue: "Ball contacts the forearms, not wrists or hands" },
      { key: "pace_matched", cue: "Energy matched to the serve: absorbs heat, adds to floats" },
      { key: "hittable_arc", cue: "Pass leaves with a controlled, hittable arc" },
      { key: "low_spin_off", cue: "Ball comes off the platform with minimal spin" },
    ],
  },
  set: {
    hand_shape: [
      { key: "ball_shaped_window", cue: "Hands form a ball-shaped window above the forehead" },
      { key: "fingerpad_contact", cue: "Contact on the finger pads, never the palms" },
      { key: "symmetric_hands", cue: "Both hands work symmetrically on the ball" },
      { key: "quiet_contact", cue: "Contact is quiet and clean, no slap or catch" },
    ],
    footwork: [
      { key: "beats_ball", cue: "Feet beat the ball to the spot" },
      { key: "square_stop", cue: "Stopped and squared before contact" },
      { key: "right_foot_lead", cue: "Weight settles with the lead foot slightly forward" },
      { key: "still_at_contact", cue: "Base is still through the release" },
    ],
    body_alignment: [
      { key: "under_the_ball", cue: "Forehead under the ball at contact" },
      { key: "hips_to_target", cue: "Hips and shoulders square to the target" },
      { key: "vertical_posture", cue: "Posture vertical, no arch-back push" },
      { key: "still_head", cue: "Head still, eyes tracking through the window" },
    ],
    release: [
      { key: "legs_through_hands", cue: "Leg drive flows up through the hands" },
      { key: "full_extension", cue: "Arms extend fully toward the target on release" },
      { key: "no_carry", cue: "Release is quick, no carry or double" },
      { key: "finish_to_target", cue: "Hands finish pointing at the target" },
    ],
    tempo_decision: [
      { key: "off_the_net", cue: "Ball placed a safe cushion off the net" },
      { key: "hitter_side_peak", cue: "Arc peaks on the hitter's side, in their attack window" },
      { key: "repeatable_arc", cue: "Same arc and location rep to rep" },
      { key: "gives_hitter_time", cue: "Tempo gives the hitter a full approach" },
    ],
  },
  attack: {
    approach_footwork: [
      { key: "accelerating_steps", cue: "Multi-step approach that accelerates into the plant" },
      { key: "long_penultimate", cue: "Long, low penultimate step" },
      { key: "double_foot_plant", cue: "Both feet plant heel-to-toe to convert speed upward" },
      { key: "arms_back_on_plant", cue: "Both arms drawn back behind the hips at the plant" },
    ],
    jump_timing: [
      { key: "takeoff_behind_ball", cue: "Takes off with the ball in front of the hitting shoulder" },
      { key: "meets_at_apex", cue: "Contact near the top of the jump" },
      { key: "synced_to_set", cue: "Takeoff timed to the set's arc, no stall or rush" },
      { key: "controlled_in_air", cue: "Body controlled in the air, no wild drift" },
    ],
    arm_swing: [
      { key: "high_elbow_draw", cue: "Hitting elbow drawn high and back" },
      { key: "bow_and_arrow", cue: "Clear bow-and-arrow separation before the swing" },
      { key: "guide_arm_up", cue: "Non-hitting arm points at the ball, held up until the swing" },
      { key: "fast_whip", cue: "Arm whips through fast with a wrist snap over the top" },
    ],
    contact_height: [
      { key: "full_extension", cue: "Contact at full arm extension" },
      { key: "in_front_of_shoulder", cue: "Contact in front of the hitting shoulder" },
      { key: "high_reach", cue: "Contact at the top of the athlete's reach" },
      { key: "repeatable_height", cue: "Same contact height rep to rep" },
    ],
    power_followthrough: [
      { key: "torso_snap", cue: "Torso folds through contact, core driving the swing" },
      { key: "topspin_snap", cue: "Wrist snap puts topspin on the ball" },
      { key: "relaxed_finish", cue: "Arm finishes relaxed down and across the body" },
      { key: "balanced_landing", cue: "Two-foot landing with soft knees, balanced" },
    ],
  },
  block: {
    read_timing: [
      { key: "eye_sequence", cue: "Eyes track setter, then ball, then hitter" },
      { key: "jumps_off_hitter", cue: "Times the jump off the hitter, just after their takeoff" },
      { key: "hands_at_peak", cue: "Hands cross the net as the attacker swings" },
      { key: "no_early_commit", cue: "Stays down on fakes instead of jumping early" },
    ],
    hand_penetration: [
      { key: "hands_over_net", cue: "Hands penetrate across the plane of the net" },
      { key: "fingers_spread_firm", cue: "Fingers spread wide and firm" },
      { key: "sealed_gap", cue: "Thumbs close the gap so nothing passes between the hands" },
      { key: "press_down", cue: "Wrists press down toward the attacker's court" },
    ],
    lateral_footwork: [
      { key: "clean_pattern", cue: "Clean shuffle or crossover along the net" },
      { key: "square_on_arrival", cue: "Shoulders square to the net on arrival" },
      { key: "off_the_net", cue: "Body stays an arm's length off the net while moving" },
      { key: "loaded_before_jump", cue: "Balanced and loaded before leaving the ground" },
    ],
    body_position: [
      { key: "vertical_jump", cue: "Straight vertical jump, no drift into the net" },
      { key: "tight_core", cue: "Core tight and body controlled in the air" },
      { key: "arms_length_spacing", cue: "Starts at arm's length from the net" },
      { key: "eyes_open_neutral", cue: "Head neutral, eyes open on the ball through contact" },
    ],
    landing_recovery: [
      { key: "soft_two_foot", cue: "Soft two-foot landing" },
      { key: "balanced_off_net", cue: "Lands balanced without touching the net" },
      { key: "immediate_reload", cue: "Turns or reloads immediately for the next play" },
      { key: "no_net_touch", cue: "No contact with the net at any point" },
    ],
  },
  dig: {
    ready_position: [
      { key: "low_wide_base", cue: "Low, wide athletic base before the attack" },
      { key: "weight_forward", cue: "Weight on the balls of the feet" },
      { key: "arms_ready_apart", cue: "Arms in front and apart, ready to build a platform" },
      { key: "stopped_at_swing", cue: "Still and balanced when the attacker swings" },
    ],
    read_anticipation: [
      { key: "reads_hitter_line", cue: "Positions off the hitter's approach and shoulder line" },
      { key: "early_position", cue: "In position before the attacker's swing starts" },
      { key: "in_the_lane", cue: "Stationed inside the team's defensive lane" },
      { key: "no_guess_drift", cue: "Holds position instead of guessing and drifting" },
    ],
    platform_control: [
      { key: "early_platform", cue: "Platform formed before the ball arrives" },
      { key: "angle_to_target", cue: "Platform angle sends the dig up and toward target" },
      { key: "absorbs_pace", cue: "Absorbs pace on hard-driven balls" },
      { key: "forearm_contact", cue: "Contact on the forearms, ball played in front" },
    ],
    movement_pursuit: [
      { key: "quick_first_step", cue: "Explosive first step toward the ball" },
      { key: "stays_low_moving", cue: "Stays low through the movement" },
      { key: "full_effort_extension", cue: "Extends fully for balls outside the frame" },
      { key: "controlled_emergency", cue: "Emergency technique (sprawl, pancake) is controlled" },
    ],
    recovery: [
      { key: "up_quickly", cue: "Back to the feet quickly after the dig" },
      { key: "eyes_stay_on_ball", cue: "Eyes stay on the ball after contact" },
      { key: "returns_to_base", cue: "Returns toward base position" },
      { key: "ready_for_next", cue: "Set for the next contact before it happens" },
    ],
  },
};

export type PointerStatus = "met" | "partial" | "missed" | "not_visible";

// Tolerant parse: the schema keeps status as a plain string so a slightly-off
// reply cannot 502; anything unrecognized reads as not_visible, which excludes
// the pointer from the math rather than rewarding or punishing it.
export function parsePointerStatus(value: unknown): PointerStatus {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "met" || v === "yes") return "met";
  if (v === "partial" || v === "partially") return "partial";
  if (v === "missed" || v === "no" || v === "not_met") return "missed";
  return "not_visible";
}

// Scale mapping for a checkpoint from its visible pointers: all missed sits at
// a broken-fundamentals 30, all met at a flawless 100, linear between. This IS
// the product scale (D-040): no display curve sits on top of it. 40 developing,
// 70 solid, 90 advanced, earned pointer by pointer.
//
// The ceiling is 100, not a withheld 95 (D-056). Every visible pointer met means
// there is no correctable fault left to name, and the honest number for that is
// 100. The floor, the linearity, and the one-standard rule (D-037) are unchanged,
// so this raises the top of the scale without curving anything beneath it.
const RAW_FLOOR = 30;
const RAW_CEILING = 100;

export type DerivedMetric = {
  observed: boolean;
  // Raw (pre-curve) score. Meaningless when observed is false.
  raw: number;
  statuses: { key: string; status: PointerStatus }[];
};

export function deriveMetric(
  skill: Skill,
  metricKey: string,
  reported: { key: string; status: string }[] | undefined,
): DerivedMetric {
  const catalog = POINTERS[skill][metricKey] ?? [];
  const byKey = new Map((reported ?? []).map((p) => [p.key, p.status]));
  const statuses = catalog.map((p) => ({
    key: p.key,
    status: parsePointerStatus(byKey.get(p.key)),
  }));
  const visible = statuses.filter((s) => s.status !== "not_visible");
  if (visible.length === 0) return { observed: false, raw: RAW_FLOOR, statuses };
  const met = visible.filter((s) => s.status === "met").length;
  const partial = visible.filter((s) => s.status === "partial").length;
  const fraction = (met + 0.5 * partial) / visible.length;
  return {
    observed: true,
    raw: Math.round(RAW_FLOOR + (RAW_CEILING - RAW_FLOOR) * fraction),
    statuses,
  };
}

// The pointer checklist for one skill, rendered for the prompt.
export function pointerSpec(skill: Skill): string {
  const lines: string[] = [
    "POINTERS (the checklist the score is computed from)",
    "For every checkpoint below, judge each pointer strictly from the frames:",
    '- "met": the mechanic is clearly there.',
    '- "partial": the mechanic is clearly VISIBLE and it is present but flawed or inconsistent across reps. partial is a verdict about visible flaws, never about unclear footage.',
    '- "missed": the phase is on camera and the athlete visibly does not do the mechanic.',
    '- "not_visible": the footage does not let you judge it: occluded, cropped, cut, blurred, too distant, or the phase never on camera. Never use not_visible for a mechanic you can see; never use missed for one you cannot.',
    "When the evidence is too unclear to judge a pointer with confidence, mark it not_visible rather than hedging with partial or missed: uncertainty must never lower a score. not_visible pointers are excluded from the number entirely and are named once in the summary instead, so a clean rep scores 90+ on what the camera actually shows.",
    "Judge each pointer against the PHASE of the skill it belongs to. If the frames never capture that phase at all (the approach happens between frames, contact is never shown, the landing is cut off), every pointer of that phase is not_visible, NOT missed. missed is reserved for a phase that is on camera where the athlete visibly does not do the mechanic. Frames of the athlete standing, walking, or waiting are not evidence about a phase they are not performing.",
    "Return each checkpoint's pointers with these EXACT keys. The score is computed from your verdicts; the note explains the missed and partial pointers in plain words.",
    "",
  ];
  for (const [metricKey, pointers] of Object.entries(POINTERS[skill])) {
    lines.push(`${metricKey}:`);
    for (const p of pointers) lines.push(`- ${p.key}: ${p.cue}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function pointerCue(skill: Skill, metricKey: string, key: string): string | null {
  return POINTERS[skill][metricKey]?.find((p) => p.key === key)?.cue ?? null;
}
