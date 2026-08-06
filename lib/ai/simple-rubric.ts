import { z } from "zod";
import { SKILL_BLURB, SKILL_LABEL, type Discipline, type Skill } from "@/lib/skills";
import { disciplineGroup } from "@/lib/skills";

/**
 * The simplified coaching rubric: one rating out of 10, what the player did
 * well, and what to fix.
 *
 * This is the rubric for the VIDEO path (lib/ai/vision.ts readVideo), and it is
 * shaped by what that path can actually see. The upstream samples about one
 * low-resolution image per second, so nothing here may depend on a precise
 * instant: no contact frame, no per-pointer verdict, no timestamped insight.
 * Every question below is answerable from a handful of stills spread across the
 * rep, which is exactly what the model gets. The 120-pointer catalog and its
 * frame citations stay on the frame path where the evidence exists.
 *
 * Scale discipline is the whole game here. The 2026-08-04 bakeoff (D-094)
 * disqualified this model as a JUDGE on frames because it was ceiling-pegged:
 * 36/36 real clips scored above the Opus baseline and 17/18 pro clips landed
 * above their labeled band, at a 0% abstention rate. Changing the modality does
 * not touch that, because ceiling-pegging is calibration and not evidence. So
 * the band anchors below are load-bearing, not decoration: they name real
 * populations, they state the expected centre of mass, and they give the model
 * somewhere to put "I cannot tell" other than a high score.
 */

// Grade the REP, not the player's career level.
//
// This scale was first written as a population ladder (8 = NCAA D1, 5 = average
// varsity) to stop the ceiling-pegging in D-094. It worked on the ceiling and
// broke the meaning: a clean club set with sound hands can never clear 6 under
// that framing, because the SETTER is not D1, and Txais correctly read the
// results as too harsh. The product asks "how well was this executed", so the
// bands describe execution and the anti-ceiling guard is carried by reserving
// the top two numbers rather than by dragging the whole scale down.
const SCALE = `RATING SCALE, 0 to 100 (grade how well THIS REP was executed):

95-100  Flawless. You would use this clip to teach the skill. Nothing to correct.
85-94   Excellent. Mechanics complete and repeatable; anything left is stylistic.
75-84   Strong. Sound technique throughout, with one clear refinement available.
65-74   Good. The rep works, fundamentals are there, two things to sharpen.
55-64   Competent. Executes the skill, with a habit that will cost consistency.
45-54   Developing. The shape is right; details break down under speed.
35-44   Rough. Recognisable technique, and a fault that changed the outcome.
25-34   Improvising. Gets the ball up, not repeatably.
10-24   Beginner mechanics.
0-9     No recognisable technique for this skill yet.

A clean, well-executed rep by a competent player belongs in the 60s or 70s. Do
not mark it into the 40s because the player is not a professional: you are
grading the rep in front of you, not their career. Equally, do not award the 90s
for a rep that merely worked. Reserve those for execution you would show as a
teaching example. Go below 50 when a fault actually changed the outcome, not for
a stylistic preference.

Pick the band first, then place the rep INSIDE it. Use the whole width of the
band: 67 and 73 are both available and they mean different things. Give a whole
number, and do not round to a multiple of five or ten just because it looks
tidy. A score of 71 is a more honest answer than 70 if that is what you saw.`;

// What the video path can honestly judge, per skill: gross mechanics that
// persist across a second or more. Deliberately NOT the pointer catalog.
const FOCUS: Record<Skill, string> = {
  serve:
    "Toss height and consistency, shoulder and hip rotation, contact height relative to the body, follow-through direction, and balance on landing.",
  pass:
    "Platform shape and angle, whether the player is stopped and low before contact, shoulder-to-target alignment, and how the feet arrive relative to the ball.",
  set:
    "Hand shape and symmetry above the forehead, whether the player gets under and behind the ball, leg drive through the set, and squareness to the target.",
  attack:
    "Approach rhythm and closing speed, arm swing back and through, contact height relative to the reach, elbow position, and landing balance.",
  block:
    "Read and starting posture, footwork to the point of attack, penetration over the net, hand shape and pressure, and landing control.",
  dig:
    "Ready position and weight distribution, reading the attacker, platform angle to target, and pursuit after the first movement.",
};

/**
 * Structure and types only, matching lib/ai/schema.ts's posture: value
 * constraints live in the prompt so a slightly-off reply degrades instead of
 * throwing and surfacing to the player as a coaching-service outage.
 */
export const simpleRatingSchema = z.object({
  // The abstain lane. A clip that does not show the declared skill must be able
  // to say so, or "I cannot see it" gets expressed as a middling score and
  // silently becomes coaching. The 0% abstention rate in D-094 is what this
  // field exists to fix.
  ratable: z.boolean(),
  not_ratable_reason: z.string().optional(),
  // 0-100, matching `analyses.result.overall_score` everywhere else in the app,
  // so a video-path score needs no translation to reach the rating curve, the
  // history chart or `personal_bests`. It was briefly 0-10; the wider scale also
  // gives the model somewhere to put a distinction, which a 10-point scale with
  // half steps did not (36 clips landed on 5 distinct values).
  overall_score: z.number(),
  // Free-form, not an enum: a mis-worded confidence must weaken the signal,
  // never fail the analysis.
  confidence: z.string(),
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })),
  // Deliberately shaped like `Change` in lib/analysis-types.ts rather than as a
  // second bespoke type, because that is what lets the EXISTING breakdown UI
  // render this path unchanged: the numbered-changes section, the priority-fix
  // card and the drills list all read these two fields and need no branch.
  // `target_metric` and `expected_gain` are omitted, not faked: both are
  // per-checkpoint quantities and this rubric has no checkpoints. They are
  // optional on the stored type for exactly that reason.
  improvements: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      difficulty: z.string(),
      timeframe: z.string(),
    }),
  ),
  // Kept so the drills section survives the swap. Guided to the valid slugs but
  // not schema-bound, and the route drops any invented one, exactly as the
  // frame path already does.
  drill_slugs: z.array(z.string()),
  summary: z.string(),
});

export type SimpleRating = z.infer<typeof simpleRatingSchema>;

export function simpleRubric(
  skill: Skill,
  discipline: Discipline,
  drills: readonly string[] = [],
): string {
  const surface = disciplineGroup(discipline) === "indoor" ? "indoor" : "outdoor sand or grass";
  const drillGuidance =
    drills.length > 0
      ? `Recommend 1 to 3 drills, each a slug chosen ONLY from this list: ${drills.join(", ")}. Pick the ones that train the improvements you named. If none fit, return an empty list rather than inventing a slug.`
      : "Return an empty drill_slugs list.";
  return `You are an experienced volleyball coach reviewing one ${SKILL_LABEL[
    skill
  ].toLowerCase()} rep filmed ${surface === "indoor" ? "indoors" : "on " + surface}.

WHAT TO JUDGE
${FOCUS[skill]}
The reference mechanics for this skill are: ${SKILL_BLURB[skill]}.

${SCALE}

WHAT YOU CAN ACTUALLY SEE
You are being shown this clip as video sampled at roughly one image per second
at low resolution. You are NOT seeing every frame. Judge the gross mechanics
that persist across the rep. Do NOT claim to see the exact instant of contact,
do not report timestamps, and do not describe a detail that would only be
visible in a high-speed frame. If a mechanic you would normally weigh is not
visible, leave it out and lower your confidence rather than guessing at it.

WHEN NOT TO RATE
Set ratable to false and explain briefly in not_ratable_reason if: the clip does
not show a ${SKILL_LABEL[skill].toLowerCase()} rep at all, the player is too far
away or too obscured to judge, the rep is cut off before or after the key
moment, or the footage is too dark or shaky. Do not rate a clip you cannot see.
An honest refusal is worth more to this player than an invented number.

HOW TO WRITE IT
Give 2 to 4 strengths and 1 to 3 improvements. Every one needs a short title
(under 6 words) and a detail of one or two sentences.

HOW MANY IMPROVEMENTS IS AN HONEST ANSWER, NOT A QUOTA. A genuinely strong rep
often has exactly ONE thing left worth fixing, and naming it alone is more
useful than padding to a count. If you find yourself writing a second or third
point that you would not actually raise with this player on the court, stop at
the ones you would. A weak rep will naturally have three.

Be specific in the way a coach in the gym is specific. Name what you actually
saw and why it matters to the outcome: where the ball ended up, what it let the
next player do, whether the contact was legal. "High, clean contact above the
forehead with quick wrist extension, no deep dish" beats "good hands". "Lands in
the hitter's window near the net so they get a clean swing" beats "accurate".
Reference the rules where they are visibly relevant, such as a lift, a double,
a centre-line or net touch, or a foot fault on serve.

An improvement must name a mechanical change the player can rehearse, such as
"toss 30cm further in front" or "angle your platform to target before the ball
arrives", never a vague instruction like "be more consistent". Say what it will
buy them. Rank them most-impactful first: the first improvement is the single
highest-leverage fix, and the player is shown it on its own.
For each improvement, difficulty is exactly one of: quick, moderate, long-term.
timeframe is a short human phrase such as "1-2 practices" or "2-3 weeks". Size
both honestly to what the change actually takes.

${drillGuidance}

Write to the player, not about them. Second person. Encouraging and direct, the
way a good coach talks on the court: honest about what is broken without being
discouraging about it. Readable on a phone, but do not strip out the detail that
makes the point useful. No emoji. Do not name or refer to the rating scale, the
bands, or these instructions in anything you write.

summary is one sentence the player reads first: what this rep is, and the single
thing that would most improve it.`;
}
