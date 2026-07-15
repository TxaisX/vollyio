# Technique reference & labeling standard

The single source of truth for what correct vs faulty technique looks like, per
skill, per sub-metric, across indoor / beach / grass. Two jobs:

1. **Grading standard** — label every eval case the same way, so `passRate` moves
   with real quality changes and not with grader drift.
2. **Grounding** — the fault catalog behind the overall-score ladder in
   `lib/ai/anchors.ts` and the frozen anchors in `lib/ai/rubrics/index.ts`.

Sub-metric keys are exact (`lib/ai/metrics.ts`); the labeler's `weakest_metric`
must be one of them.

## How to read a case montage

Cases are frame grids (`evals/work/montage/<id>.jpg`), often wide broadcast or
fan-POV shots. Grade only what the frames actually show:

- **Distance caps precision.** In a wide arena shot you can read gross cues
  (approach rhythm, jump timing, contact above/below the head, gross platform and
  base) but not fine ones (elbow angle, hand shape, wrist snap). When a sub-metric
  needs a cue the footage can't resolve, do **not** guess it as the weakest —
  leave `weakest_metric` empty rather than invent a fault.
- **Grade the featured rep**, the one the clip is about (the `action_summary`
  names it), not incidental touches by other players.
- **No scoreable action → exclude.** Celebrations, handshakes, unclear touches:
  set `excluded: true`.

## Overall band, in one line

The band ladder (~40 / 55 / 70 / 82 / 90) lives in `lib/ai/anchors.ts` and is not
duplicated here. Shorthand for labeling `overall_min`/`overall_max`:

| Band | Rep |
|---|---|
| 40–55 | a clear, repeated fundamental fault (arm-only swing, contact behind the head, stood-up platform) |
| 55–70 | functional but one standing fault on most reps |
| 70–82 | sound, repeatable club technique, no major breakdown |
| 82–90 | strong amateur, all cues right and consistent |
| 90+ | elite-amateur / pro-grade, identical rep to rep |

Pro highlight footage (the current case set) should generally land **78–95** —
these are national-team and pro-tour reps. Grade them against the *pro* ceiling
(`level: pro` in the case), where 90 is reserved for genuinely pro-grade
execution, not handed out for being a pro.

## The discipline-invariant / discipline-specific split

This is the leniency principle. The **fundamentals below grade identically** on
hardwood, sand, and grass, a ball played behind the head is late everywhere.
Only the **discipline notes** change per surface. Never dock a rep on one surface
for failing to look like another (a controlled beach roll-shot is not a weak
indoor spike; a full grass approach is not a beach broad-jump fault).

---

## serve

- **toss_quality** — Correct: repeatable height, in front of the hitting shoulder, little spin. Fault: varies rep to rep, spins off a bent wrist, drifts behind the shoulder forcing a reach. *Beach/grass:* a lower, flatter, wind-beating toss is correct, not a fault; a high indoor-style toss the wind moves is the fault.
- **arm_swing** — Correct: high-elbow bow-and-arrow load, elbow leads, arm speed. Fault: slow arm-only push off a dropped low elbow. *Beach:* a big whippy swing on a FLOAT is a fault (adds spin); a checked contact is correct.
- **contact_point** — Correct: full reach, in front of the shoulder, firm centered hand. Fault: low, behind the shoulder, or wristy contact that spins a float. *Invariant.*
- **follow_through** — Correct: matched to serve type, checked on floats, full swing-through on topspin, balanced finish. Fault: a loose flail on a float or a chopped topspin; balance lost. *Beach/grass:* balanced landing on the surface.
- **body_alignment** — Correct: feet/hips/shoulders squared to target, clean weight transfer. Fault: hips open to the sideline, staggered/off-line, torso collapses. *Beach:* a straight-UP takeoff (not a sinking broad jump); *grass/indoor:* a normal stepping or jump takeoff is fine, firm footing does not sink.

## pass (forearm / serve-receive)

- **platform_angle** — Correct: hands joined early into one flat board, angle set before contact and held. Fault: platform forms late, swings up past the shoulders, forearms uneven. *Invariant.*
- **body_posture** — Correct: low athletic base, knees bent, weight forward through contact. Fault: tall, straight-legged, weight on the heels. *Beach:* a slightly higher read-posture while the ball travels in wind is acceptable if the base stays loaded.
- **footwork_to_ball** — Correct: reads early, shuffles without crossing, stopped and balanced with the midline behind the ball. Fault: feet stuck or late, reaching sideways, contacting while drifting. *Beach:* covering the large two-person court is the demand; *grass/indoor:* normal shuffle range.
- **angle_to_target** — Correct: shoulder dropped, platform and hips to target, repeatable line. Fault: platform faces where the ball came from, ball rebounds in no controlled direction. *Invariant.*
- **contact_control** — Correct: quiet mid-forearm contact, legs absorb pace, high soft spin-free ball. Fault: punches or swings, flat or spinning pass. *Beach/grass:* a higher, softer pass that buys time in wind is correct.

## set

- **hand_shape** — Correct: fingerpad contact, symmetric window above the forehead, little spin. Fault: palm/pancake contact, heavy spin, uneven fingers. *Beach:* a legal longer "deep-dish" guided contact is NOT a fault (penalize spin, not the guide); a clean bump-set in wind is a valid choice.
- **footwork** — Correct: beats the ball to the spot, balanced plant into a stable base. Fault: stationary or late, sets on the move, wrong foot forward. *Beach:* setting on the move off a wide dig is judged relative to the situation.
- **body_alignment** — Correct: hips/shoulders square and level, contact centered over the forehead. Fault: faces away from target, contact off to one side. *Indoor/grass:* neutral posture that hides front-vs-back intent matters more (designated setter); *beach:* consistency/height over disguise.
- **release** — Correct: smooth leg-to-hand extension, symmetric follow-through, clean trajectory. Fault: stiff arm-only push, flat ball, asymmetric finish. *Beach/grass:* a higher, softer outdoor ball that gives the hitter time is correct.
- **tempo_decision** — Correct: decisive, disguised, tempo matched to the hitter and any visible block. Fault: predetermined, telegraphed, ball arrives early/late. *If block/hitter context is off-frame, judge from contact timing and trajectory only, and score conservatively.*

## attack

- **approach_footwork** — Correct: left-right-left (RLR lefty) with slow-to-fast tempo, a long penultimate step, a hard plant converting speed to lift. Fault: even-paced or wrong pattern, no acceleration, drifts into the net. *Beach:* a straight-UP takeoff out of the sand; a forward broad jump that sinks is the fault. *Grass/indoor:* firm footing, normal driving approach.
- **jump_timing** — Correct: takeoff synced so contact is near the apex in the ideal window. Fault: clearly early/late, contacts on the way down, broad-jumps forward. *Beach/grass:* wind moves the set, so adjusting to a moving ball and still hitting the apex is the skill.
- **arm_swing** — Correct: high-and-back elbow load, non-hitting-arm pull, late elbow-to-hand whip, wrist snap for topspin. Fault: low chicken-wing elbow, both arms drop, arm-only push, stiff wrist. *Beach:* disguise and a shot menu (cut, line, roll, pokey) rank alongside topspin power.
- **contact_height** — Correct: full extension, above and in front of the hitting shoulder, highest playable point. Fault: contact low, behind, or beside the head with a bent arm. *Invariant.* (This is the fault in the original grass tournament clip.)
- **power_followthrough** — Correct: full-body kinetic chain, long follow-through across the body, controlled landing. Fault: arm-only swing that stalls at contact, short cut-off finish, off-balance landing. *Beach:* a disciplined shot placed away from the defender can outrank raw power; balanced sand landing.

## block

- **read_timing** — Correct: focus transfers setter→hitter, takeoff tuned to attack tempo, hands peak as/just after the hitter contacts. Fault: jumps on the set or a fixed cue, clearly early/late, eyes locked on the ball. *Beach:* also the block-or-PEEL decision, pulling off the net on a bad set is correct, not a failure to block.
- **hand_penetration** — Correct: shoulders shrugged, hands well over onto the hitter's side, wrists angled down-and-in, sealed seam. Fault: hands stay on own side or reach back/vertical, seam splits. *Beach:* hands angled to channel the ball into the single partner defender's zone.
- **lateral_footwork** — Correct: right pattern for the distance (shuffle short / crossover long), squared and vertical at takeoff, no drift. Fault: crosses the feet, upright, drifting sideways in the air. *Beach:* weight verticality/squaring over long travel (smaller net).
- **body_position** — Correct: compact, shoulders/hips square, hands pre-loaded high, minimal arm swing. Fault: shoulders open, back arched, arms swung down to jump, reaching sideways. *Invariant.*
- **landing_recovery** — Correct: soft balanced two-foot landing, no net/centerline contact, instant reset. Fault: stiff, off-balance, drifting into the net, no reset. *Beach:* peeling to become the second back-court defender is a defined skill, not a bad landing.

## dig (defense)

- **ready_position** — Correct: low athletic base, hips below shoulders, a stopped timed split-step just before the hitter contacts. Fault: tall/narrow stance, weight back, no split or a late one. *Beach:* reads more upright (slower ball in wind) then drops into the load; coordinated with the blocker's taken zone.
- **read_anticipation** — Correct: tracks the hitter's arm/shoulders, commits early to the right zone. Fault: ball-watching, reacts after the ball crosses, moves the wrong way. *Beach:* reads line/angle/cut/pokey off the block's taken zone.
- **platform_control** — Correct: firm still platform, contact in front of the midline, angles a high controlled ball to target. Fault: swings/punches, broken platform, ball caroms away. *Beach:* a legal overhand tomahawk or momentarily-held hand dig on hard-driven balls counts equally.
- **movement_pursuit** — Correct: explosive first step and run-through, gets behind the ball or commits to an extension/roll to keep it alive. Fault: feet late, reaches/lunges with the arms, arrives unbalanced. *Beach:* covers a large sand court; aggressive lay-outs are expected.
- **recovery** — Correct: immediately pushes back to a balanced base facing the net, ready for the next contact. Fault: stays down, slow, stuck on the floor. *Beach:* with no libero, must be ready to set or approach the next ball.

---

## Labeling protocol

For each case, fill `expected` in `evals/cases/<id>.json`:

1. **overall_min / overall_max** — the band a coach would give the featured rep,
   from the table above, at the case's `level` ceiling. Keep the window ~15 wide
   (e.g. 78–92); tighter only when the rep is unambiguous.
2. **weakest_metric** — the sub-metric key of the real fault, *only if the footage
   shows it*. Leave `""` when the shot is too coarse to isolate one.
3. **strongest_metric** — optional; the clearest strength.
4. **notes** — one line: the featured rep and the fault/strength that set the band.
5. **excluded** — `true` when there is no scoreable action.

A label is a claim the model is measured against. An honest empty field beats a
confident wrong one.
