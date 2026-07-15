import type { Skill, Discipline } from "@/lib/skills";

// Concrete "what a 40 vs a 90 looks like" exemplars, per skill, as a whole-rep
// overall-score ladder. The frozen RUBRIC scores each of five sub-metrics against
// ~40/~70/~90 anchors, and SCORING_STANDARD (output-spec.ts) says WHERE the amateur
// ceiling sits, but neither pins the OVERALL number to observable reps. Left to the
// abstract band prose the model drifts: two graders, same clip, different overall.
// This ladder grounds the single 0-100 in five described rungs the model can match
// a rep against, so "sound club rep" reliably lands ~70 and a repeated fundamental
// fault reliably lands ~50s. One skill's ladder is injected per request.
const SCORE_ANCHORS: Record<Skill, string> = {
  serve: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: Toss varies and spins rep to rep; an arm-only push off a low dropped elbow; contact behind or below the hitting shoulder with a bent elbow; the body opens to the sideline. The ball crosses, but the motion is a shove.",
    "- ~55: One cue is repeatable (often the toss) but a clear standing fault remains on most reps: slow arm speed, contact dropped below full reach, or a base and finish that drift. Lands in with no pace or command.",
    "- ~70: Repeatable toss in front of the hitting shoulder, a recognizable high-elbow load, contact at or near full extension out front, a square stable base. Sound and repeatable, short only of pro whip and the last degrees of reach.",
    "- ~82: All five cues right and consistent: near-identical toss, a fast high-elbow swing, firm centered full-reach contact, a finish matched to serve type, a stacked square line. Real command of type and placement.",
    "- ~90: Every cue elite for the amateur field and identical rep to rep: a whip-like sequenced swing, dead-centered contact at full reach, a deliberate matched finish, a tall square line, a toss so tight the rhythm comes from the body, not the toss.",
  ].join("\n"),
  pass: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: Tall and straight-legged with the weight back; the platform forms late and swings up past the shoulders; feet stuck or reaching sideways; the ball caroms with no target line.",
    "- ~55: A platform comes together but with one repeated fault: swinging at the ball, passing from a stood-up base, or arriving a beat late and contacting off-center. The ball goes up, but height and direction wander.",
    "- ~70: Hands joined early into a mostly flat board, a genuine athletic stance, shuffles behind most balls, drops the shoulder to target, quiet mid-forearm contact. Reliable if not perfectly consistent.",
    "- ~82: Low and balanced every rep, the platform set before contact and held, beats the ball to the spot, a repeatable on-target line off a soft absorbed contact. Strong, short of elite quietness and range.",
    "- ~90: A locked flat still platform every rep off a consistently low loaded base; reads and releases early to beat the ball; hips and platform to target; the legs absorb pace into a high, soft, spin-free ball on the same line rep after rep.",
  ].join("\n"),
  set: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: Palm or pancake contact with heavy spin; stationary or late, setting on the move; hips face away from target; a stiff arm-only push; placement predetermined regardless of the play.",
    "- ~55: A window forms but with a repeated fault: spin off the hands on most reps, no plant, or a flat arm-push release. The ball is catchable but telegraphed or inconsistent.",
    "- ~70: Fingerpad contact with a real window above the forehead, a plant on most reps into a squared base, a coordinated leg-to-hand extension, reasonable tempo for the situation.",
    "- ~82: Clean quiet hands every rep, gets stopped and squared, a smooth full release on a repeatable arc, a neutral posture that hides intent. Strong and consistent, short of elite disguise and tempo.",
    "- ~90: A spin-free symmetric fingerpad delivery every rep; beats the ball to the spot into a stable plant; a smooth leg-driven release on an identical trajectory; a disguised, decisive tempo matched to the hitter.",
  ].join("\n"),
  attack: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: Even-paced or wrong step pattern with no acceleration; a mistimed jump that contacts on the way down; a low chicken-wing elbow and an arm-only push; contact behind or beside the head with a bent arm; the swing stalls at contact into an off-balance landing.",
    "- ~55: A recognizable approach or a decent swing, but one clear standing fault on most reps: contact dropping to the hairline or behind the shoulder, an elbow that leads low, or a jump that broad-jumps forward. The ball is hit over without a real downward finish.",
    "- ~70: A left-right-left rhythm with a penultimate acceleration, a jump synced to meet the ball near peak, a high-elbow bow-and-arrow load, contact above and in front of the shoulder near full reach, a core-driven follow-through, a balanced landing.",
    "- ~82: An explosive spaced approach, contact at full extension above and in front every rep, a whip with a strong non-hitting-arm pull and wrist snap, a long follow-through driving the ball down, a controlled landing. Strong amateur, short of pro pace.",
    "- ~90: A fast slow-to-fast approach; apex contact at the highest, most-forward point every rep; a whip-like sequenced swing with heavy topspin; a full-body kinetic chain driving the ball sharply down; a balanced, repeatable landing.",
  ].join("\n"),
  block: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: Jumps on the set or a fixed cue, clearly early or late; hands stay on the blocker's own side or reach back and the seam splits; crosses the feet or drifts sideways; shoulders open and arms swung to jump; lands off-balance into the net.",
    "- ~55: Times some reps but keys the ball, not the hitter; hands reach the tape but do not angle over it; some lateral drift at takeoff. A block that gets up but channels nothing.",
    "- ~70: Keys the hitter and times most reps, hands cross the plane with firm wrists over the tape, an efficient shuffle or crossover mostly square on arrival, a balanced two-foot landing.",
    "- ~82: Reads the hitter to tempo, hands press well over and angle down, a squared vertical no-drift jump, a compact posture, a soft balanced landing with a quick peel. Strong, short of elite penetration and seal.",
    "- ~90: Focus transfers setter-to-hitter with a tempo-tuned takeoff; both hands well onto the hitter's side angled down-and-in with a sealed seam; the right pattern squared and vertical; a soft controlled landing then an instant reset, every rep.",
  ].join("\n"),
  dig: [
    "OVERALL SCORE LADDER (match the rep to the closest rung, interpolate between)",
    "- ~40: A tall or narrow stance with the weight back and no timed split; ball-watching, reacting late or moving the wrong way; swinging or punching off a broken platform; feet late, reaching and lunging; stuck down after contact.",
    "- ~55: A loaded base on some reps but reads the ball, not the arm; the platform is flat but contact is off-center or swung at; gets to easy balls, late on wide ones. Keeps some balls alive without control.",
    "- ~70: An athletic loaded base with a split near contact, tracks the hitting arm and generally commits to the right area, a flat platform angled up-and-forward, shuffles behind most balls, regains base after most reps.",
    "- ~82: A stopped loaded split just before contact, early correct reads, a firm still platform to target, an explosive first step and run-through, a quick recovery. Strong, short of elite range and control.",
    "- ~90: A timed stopped split every rep, ready to explode any direction; early correct reads of line, angle, and tip; a firm still platform driving a high controlled ball to target; explosive pursuit with committed extensions that keep the ball alive; an instant reset every rep.",
  ].join("\n"),
};

// The ladder above describes discipline-INVARIANT fundamentals: contact in front of
// the shoulder, a real load, a flat quiet platform, an athletic base. These grade the
// same on hardwood, sand, and grass. The discipline-SPECIFIC expectations already live
// in the RUBRIC; this note keeps the model from double-counting them or inventing a
// penalty the rubric never named — the leniency-across-variations requirement.
const DISCIPLINE_NOTE: Record<Discipline, string> = {
  indoor:
    "These fundamentals are the indoor baseline; apply the ladder directly.",
  beach:
    "Grade these fundamentals, then apply the beach adjustments the rubric already names (a straight-up sand takeoff, a wind-flattened toss, shot-making and the peel as legitimate skills). Do NOT dock a rep for lacking indoor power when control is the beach-correct choice, and do NOT add a sand penalty the rubric does not name.",
  grass:
    "Firm grass footing means these indoor fundamentals apply almost unchanged — full approaches and jump serves do not sink, so never penalize a normal takeoff. Apply ONLY the wind and sun adjustments the rubric names. Do NOT dock a rep for not looking like beach or for outdoor conditions the rubric already accounts for.",
};

/**
 * The overall-score anchor block for one skill and discipline, appended after the
 * SCORING_STANDARD in outputSpec. Turns the abstract amateur bands into five
 * observable rungs so the single 0-100 stays consistent grader-to-grader, and
 * carries the discipline leniency note so variations are not double-penalized.
 */
export function scoreAnchors(skill: Skill, discipline: Discipline): string {
  return [
    SCORE_ANCHORS[skill],
    "DISCIPLINE: " + DISCIPLINE_NOTE[discipline],
  ].join("\n");
}
