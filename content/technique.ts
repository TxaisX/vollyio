import { SKILLS, DISCIPLINES, type Skill, type Discipline } from "@/lib/skills";
import { metricKeys } from "@/lib/ai/metrics";
import type { Drill } from "./drills-types";
import { drillsForSkill } from "./drills";
import type {
  DisciplineVariant,
  MetricKnowledge,
  SkillTechnique,
} from "./technique-types";

// The shared volleyball knowledge core. Anchors are ported from lib/ai/rubrics;
// overviews, highest-leverage notes, and elite markers/exemplars from the
// pro-technique study (docs/pro-technique-study.html). One entry per METRICS[skill]
// key per discipline. See content/technique.test.ts for the invariants this must hold.

export const TECHNIQUE: Record<Skill, SkillTechnique> = {
  serve: {
    skill: "serve",
    persona: "an elite indoor volleyball serving coach",
    byDiscipline: {
      indoor: {
        overview:
          "The only skill fully in your control — pros turn it into a weapon by making the toss a placement and the contact aggressive but repeatable.",
        highest_leverage_metric: "toss_quality",
        highest_leverage_note:
          "The toss is the root — every downstream cue (swing, contact, alignment) inherits the toss's variance, so a repeatable toss lifts the whole serve.",
        phases: [
          { name: "Stance & toss", detail: "Set a square stance and place a repeatable toss in front of the hitting shoulder." },
          { name: "Load", detail: "Coil into a high-elbow, bow-and-arrow backswing as the toss peaks." },
          { name: "Contact", detail: "Strike at full reach in front of the shoulder — dead-centered for a float, up-and-over for topspin." },
          { name: "Finish", detail: "Match the follow-through to the serve type and land balanced inside the court." },
        ],
        metrics: {
          toss_quality: {
            key: "toss_quality",
            what: "How repeatable and well-placed your toss is.",
            why: "The toss sets up everything after it — a toss that varies forces the swing to adjust, so a wild toss caps every other metric.",
            elite_marker:
              "Released off a near-straight arm or the fingertips with almost no spin, at the same peak height and window in front of the hitting shoulder every rep — the approach creates the rhythm, not the toss.",
            common_faults: [
              "Flicking the toss off a bent wrist so it spins and varies",
              "Releasing behind, or too far in front of, the hitting shoulder",
            ],
            anchors: {
              developing:
                "Toss height and location vary noticeably rep to rep; the ball is flicked off a bent wrist and visibly spins; it drifts and forces a reach or a jam.",
              solid:
                "Toss is generally repeatable and placed in front of the hitting shoulder with little spin and only small height variation; occasional drift that the server recovers from.",
              advanced:
                "Toss is near-identical every rep, released off a straight arm or the fingertips with little to no spin, landing in a tight window in front of the hitting shoulder.",
            },
            exemplars: ["Wilfredo León", "Ivan Zaytsev"],
          },
          arm_swing: {
            key: "arm_swing",
            what: "The speed and sequencing of the hitting arm.",
            why: "A sequenced whip — not an arm-only push — is where pace and topspin come from.",
            elite_marker:
              "A fast, whip-like swing: a high-and-back elbow load, the shoulder firing before the elbow and wrist, and hips and shoulders sequencing into the arm at the same tempo every rep.",
            common_faults: [
              "A dropped, low elbow and an arm-only push",
              "No backswing or load, so the ball is slapped",
            ],
            anchors: {
              developing:
                "A slow, arm-only swing with a dropped, low elbow; the server pushes or slaps at the ball with no clear high-elbow load or backswing.",
              solid:
                "A recognizable high-elbow, bow-and-arrow load with a full backswing that leads with the elbow; reasonable arm speed, though elbow height or timing varies.",
              advanced:
                "A fast, whip-like swing with a clearly high elbow, a distinct load-and-fire sequence, hips and shoulders sequencing into the arm; fluid and consistent across reps.",
            },
            exemplars: ["Wilfredo León"],
          },
          contact_point: {
            key: "contact_point",
            what: "Where and how you strike the ball.",
            why: "Contact height and hand shape decide the serve's speed, movement, and control.",
            elite_marker:
              "Contact at full extension, clearly in front of the hitting shoulder — a stiff, dead-centered hand for a float; a hand behind-and-below center snapping up-and-over for topspin.",
            common_faults: [
              "Contacting low or behind the head",
              "A loose, wrapping hand that spins the ball",
            ],
            anchors: {
              developing:
                "Contact is low, behind the hitting shoulder, or off-center; the hand wraps or slaps and adds unintended spin; the contact frame shows a bent elbow.",
              solid:
                "Contact is at or near full extension in front of the hitting shoulder with a mostly firm hand near the center of the ball; repeatable but not perfectly consistent.",
              advanced:
                "Contact at full reach, clearly in front of the hitting shoulder, with a firm, centered hand matched to the serve type, consistent across reps.",
            },
            exemplars: ["Wilfredo León"],
          },
          follow_through: {
            key: "follow_through",
            what: "What the hand does after contact.",
            why: "It must match the serve type — a long finish spins a float; a checked hand kills a topspin's drop.",
            elite_marker:
              "Deliberate and matched to intent every rep — crisply checked and short on floats (no added spin), a full swing across the body on topspin — finishing balanced inside the court.",
            common_faults: [
              "A long, loose flail that adds spin to a float",
              "Losing balance after contact",
            ],
            anchors: {
              developing:
                "Follow-through is absent or contradicts the serve type — a long loose flail on a float, or a chopped hand on a topspin — and balance is lost after contact.",
              solid:
                "Follow-through mostly matches intent (short checked on floats, swing-through on topspin) with a generally balanced finish, slightly inconsistent rep to rep.",
              advanced:
                "Deliberate and matched to serve type every rep, checked for floats or a full swing across the body for topspin, finishing balanced inside the court.",
            },
          },
          body_alignment: {
            key: "body_alignment",
            what: "How squared and balanced your body is to the target.",
            why: "A square, stable base points the serve at the target and keeps it repeatable.",
            elite_marker:
              "Feet, hips, and shoulders stacked and squared to the target throughout, weight transferring cleanly back-to-front (or up into a balanced jump), tall and stable at contact every rep.",
            common_faults: [
              "Hips opening toward the sideline",
              "Over-arching the back and collapsing the torso at contact",
            ],
            anchors: {
              developing:
                "Feet, hips, and shoulders are not squared to the target; hips open toward the sideline, the stance is staggered, or the back over-arches and the torso collapses at contact.",
              solid:
                "Stance and shoulders are generally square with a stable base and reasonable posture through contact; minor opening or lean.",
              advanced:
                "Feet, hips, and shoulders stacked and squared to the target throughout, with clean weight transfer or a balanced jump and a tall, stable posture every rep.",
            },
          },
        },
      },
      beach: {
        overview:
          "In wind, control beats raw pace. Elite servers flatten the toss and pick the serve — jump-float or jump-topspin — to the conditions.",
        highest_leverage_metric: "toss_quality",
        highest_leverage_note:
          "Wind-management through the toss and serve selection is the root; a great indoor toss can be a bad beach toss.",
        context_note:
          "Beach: wind and sand reward control and serve selection (jump-float vs jump-topspin) over indoor power, and the toss must be lower and tighter than indoors.",
        phases: [
          { name: "Read the wind & pick the serve", detail: "Choose jump-float or jump-topspin for the conditions and flatten the toss." },
          { name: "Toss & load", detail: "Place a low, tight, spin-free toss and load a high elbow." },
          { name: "Contact", detail: "Strike a centered, controlled ball — dead-hand float or up-and-over topspin — as high as control allows." },
          { name: "Finish", detail: "Check the finish on floats and land balanced in the sand, not drifting into the court." },
        ],
        metrics: {
          toss_quality: {
            key: "toss_quality",
            what: "How repeatable and wind-proof your toss is.",
            why: "In wind a high or spinning toss moves unpredictably, so a low, tight toss is what keeps the serve controllable.",
            elite_marker:
              "A lower, tighter toss to fight the wind — jump-float servers toss just above shoulder height (often two-handed) for a dead, spin-free ball they can control.",
            common_faults: [
              "A high, indoor-style toss the wind pushes around",
              "Spin off a bent wrist that the wind exaggerates",
            ],
            anchors: {
              developing: "A high, indoor-style or spinning toss the wind moves, varying rep to rep.",
              solid: "A low, mostly repeatable toss in front of the hitting shoulder with little spin.",
              advanced:
                "A low, tight, spin-free toss (often two-handed on a jump-float) at a consistent height and window every rep, deliberately flattened to beat the wind.",
            },
            exemplars: ["Anders Mol"],
          },
          arm_swing: {
            key: "arm_swing",
            what: "The mechanics of the hitting arm, matched to the serve.",
            why: "A float wants a compact, checked swing; a beach jump-topspin wants a sequenced while jumping straight up.",
            elite_marker:
              "On a jump-float, a compact and checked swing with no whip; on a beach jump-topspin, indoor whip mechanics but jumping straight up.",
            common_faults: [
              "A big whippy swing on a float that adds spin",
              "An arm-only push on the topspin",
            ],
            anchors: {
              developing: "On a float, a long whippy or slappy swing that adds spin; on a topspin, an arm-only push.",
              solid: "A compact checked swing on floats or a recognizable high-elbow load on topspin, mostly consistent.",
              advanced:
                "A controlled, checked contact on floats (no whip) or a fast, sequenced high-elbow whip on beach jump-topspin, repeated every rep.",
            },
          },
          contact_point: {
            key: "contact_point",
            what: "Where and how you strike the ball, prioritizing control.",
            why: "In wind a slightly lower but centered, controlled contact beats a reaching, spinning one.",
            elite_marker:
              "As high as possible, but the priority is a centered, controlled contact in wind — the float hand dead-centered and firm.",
            common_faults: [
              "A wristy hand that spins the float",
              "Reaching for height at the cost of control",
            ],
            anchors: {
              developing: "Low or off-center contact, or a wristy hand that spins a float.",
              solid: "Contact near full reach in front of the hitting shoulder with a mostly firm, centered hand.",
              advanced:
                "High, centered, controlled contact matched to the serve type, prioritizing control in wind and consistent across reps.",
            },
          },
          follow_through: {
            key: "follow_through",
            what: "What the hand does after contact, tuned for wind.",
            why: "On a beach float a long finish adds spin the wind runs with; a checked finish keeps the ball dead.",
            elite_marker:
              "On floats, a minimal follow-through that keeps the ball dead in the wind, with balance held on the sand landing.",
            common_faults: [
              "A long flail that spins a float",
              "Losing balance on the sand finish",
            ],
            anchors: {
              developing: "A long flail on a float (adds spin), a chopped finish on topspin, or balance lost on the sand landing.",
              solid: "A follow-through mostly matched to intent with a generally balanced sand finish.",
              advanced:
                "A deliberately checked, short finish on floats or a full swing-through on topspin, landing balanced on the sand every rep.",
            },
          },
          body_alignment: {
            key: "body_alignment",
            what: "How square and balanced you are, jumping straight up.",
            why: "On sand a broad jump sinks and drifts, so a straight-up takeoff and a balanced landing matter more.",
            elite_marker:
              "A square base with a straight-up takeoff (not a broad jump) and a balanced sand landing that does not drift into the court.",
            common_faults: [
              "A broad-jump takeoff that drifts into the court",
              "An off-balance sand landing",
            ],
            anchors: {
              developing: "Hips and shoulders open to the sideline, or a broad-jump takeoff that drifts into an off-balance sand landing.",
              solid: "A generally square base with a reasonably balanced straight-up jump and landing.",
              advanced:
                "Feet, hips and shoulders squared to the target, a straight-up takeoff, tall posture at contact, and a balanced sand landing that does not drift, every rep.",
            },
          },
        },
      },
    },
  },

  pass: {
    skill: "pass",
    persona: "an elite indoor volleyball passing coach",
    byDiscipline: {
      indoor: {
        overview:
          "Serve-receive is a footwork skill disguised as an arm skill. Pros win it by beating the ball to the spot and holding a still, angled platform.",
        highest_leverage_metric: "footwork_to_ball",
        highest_leverage_note:
          "Being stopped and balanced behind the ball before contact is what makes every other passing cue possible.",
        phases: [
          { name: "Read & set the platform", detail: "Read the server's contact and form a flat platform early." },
          { name: "Move to the ball", detail: "Shuffle to get the midline behind the ball, then stop, balanced." },
          { name: "Contact", detail: "Absorb the ball off a quiet mid-forearm platform." },
          { name: "Deliver", detail: "Angle the platform to send a high, on-target ball to the setter." },
        ],
        metrics: {
          platform_angle: {
            key: "platform_angle",
            what: "The flatness and angle of the two-forearm platform.",
            why: "One flat, early-set board is what redirects the ball accurately instead of spraying it.",
            elite_marker:
              "Hands locked and wrists pressed down early, forearms flat and level forming one stable board, the angle set before contact and held with almost no swing.",
            common_faults: [
              "Forming the platform late, after the ball has arrived",
              "Swinging the arms up past the shoulders",
            ],
            anchors: {
              developing:
                "Forearms uneven or the platform forms late; elbows still bent or the hands clasp only after the ball arrives; the platform swings up past shoulder height.",
              solid:
                "Hands joined early into a mostly flat, connected platform, forearms roughly level with limited swing; the angle is generally right but tilts on some reps.",
              advanced:
                "Hands locked and wrists pressed down early every rep, forearms flat and level as one board, almost no swing, the angle set before contact and held.",
            },
            exemplars: ["Erik Shoji", "Jenia Grebennikov"],
          },
          body_posture: {
            key: "body_posture",
            what: "How low and loaded your base is.",
            why: "Staying low with weight forward lets the legs, not the arms, control the ball.",
            elite_marker:
              "Consistently low and balanced — knees bent, hips loaded, back flat, shoulders over or ahead of the knees, weight moving forward through contact.",
            common_faults: ["Standing tall with straight legs", "Weight on the heels, rocking backward"],
            anchors: {
              developing: "Upright and tall with straight legs; weight on the heels or rocking backward; hips high, little knee bend.",
              solid:
                "A genuine athletic stance with bent knees and a forward lean, weight over the balls of the feet, though posture pops upright on some reps.",
              advanced:
                "Consistently low and balanced — knees bent, hips loaded, back flat, shoulders over or ahead of the knees, weight moving forward through contact.",
            },
          },
          footwork_to_ball: {
            key: "footwork_to_ball",
            what: "How you move to get behind the ball.",
            why: "Getting stopped behind the ball before contact is what makes every other cue possible.",
            elite_marker:
              "Reads and releases early, shuffles without crossing the feet, beats the ball to the spot, and is stopped and balanced with the midline behind the ball before contact.",
            common_faults: ["Reaching or lunging instead of moving the feet", "Crossing the feet and arriving off-balance"],
            anchors: {
              developing: "Feet stuck or late; reaching or lunging sideways; crossing the feet; contacting off to the side or while falling away.",
              solid:
                "Moves to the ball with shuffle steps and generally gets the body behind it, but occasionally arrives a beat late and contacts while drifting.",
              advanced:
                "Reads and releases early, shuffles without crossing the feet, beats the ball to the spot, and is stopped and balanced with the midline behind the ball before contact.",
            },
            exemplars: ["Erik Shoji"],
          },
          angle_to_target: {
            key: "angle_to_target",
            what: "How you aim the pass at the setter.",
            why: "Angling the platform (not swinging) sends the ball on a repeatable line to the target.",
            elite_marker:
              "Platform and hips oriented to the target with the shoulder dropped appropriately, the ball delivered on a repeatable line into the setter's zone rep after rep.",
            common_faults: ["Facing the platform back at the server", "Swinging the arms to steer instead of angling"],
            anchors: {
              developing: "The platform faces wherever the ball came from; the ball rebounds straight back or in no controlled direction.",
              solid: "Generally drops the shoulder and angles the platform toward the target, but the line varies.",
              advanced:
                "Platform and hips clearly oriented to the target with the shoulder dropped, delivering the ball on a repeatable line into the setter's zone rep after rep.",
            },
          },
          contact_control: {
            key: "contact_control",
            what: "The quality of the moment of contact.",
            why: "A quiet platform that absorbs pace produces a soft, high, spin-free ball the setter can use.",
            elite_marker:
              "Clean mid-forearm contact off a quiet platform that absorbs pace by giving slightly, driven by the legs; a high, soft, spin-free ball with a repeatable arc.",
            common_faults: ["Punching or swinging at the ball", "Contacting near the wrists or elbows"],
            anchors: {
              developing: "Contacts up near the wrists or back by the elbows; swings or punches at the ball; the pass is flat, spinning, or wildly variable in height.",
              solid: "Contacts the mid-forearm with a mostly quiet platform; reasonable height and pace with some variation.",
              advanced:
                "Clean mid-forearm contact off a quiet platform that absorbs pace by giving slightly, driven by the legs; a high, soft, spin-free ball with a repeatable arc.",
            },
          },
        },
      },
      beach: {
        overview:
          "Two passers cover the whole court against wind-blown serves — range, early reads, and a soft high pass define elite beach receiving.",
        highest_leverage_metric: "footwork_to_ball",
        highest_leverage_note:
          "With only two passers, the early read and first step cover ground a six-person receive never has to.",
        context_note:
          "Beach: only two passers cover the whole sand court against wind-blown serves; an overhand hand-receive is legal on non-hard-driven serves.",
        phases: [
          { name: "Read early", detail: "Key the server's contact early and release toward the ball's line." },
          { name: "Cover ground", detail: "Beat the ball across the wide sand court and stop, balanced." },
          { name: "Contact", detail: "Cushion the ball off a quiet platform (or a legal hand-receive on soft serves)." },
          { name: "Deliver", detail: "Send a high, soft, on-target ball that gives the setter time in wind." },
        ],
        metrics: {
          platform_angle: {
            key: "platform_angle",
            what: "The flatness and angle of the platform against wind serves.",
            why: "A still, early-set board is what controls a wind-affected serve toward a two-person target.",
            elite_marker:
              "The same locked, still board as indoors, but against harder wind-affected serves, aimed at a two-person target and kept quiet.",
            common_faults: ["A platform that forms late in the wind", "Swinging up at a knuckling serve"],
            anchors: {
              developing: "The platform forms late or swings up past the shoulders; uneven forearms.",
              solid: "Hands joined early into a mostly flat board with a roughly correct angle and limited swing.",
              advanced:
                "Hands locked and wrists pressed down early into one flat, still board, the angle set before contact and held, every rep, against a wind-affected serve.",
            },
          },
          body_posture: {
            key: "body_posture",
            what: "How loaded your base is while reading the wind.",
            why: "The ball travels slower in wind, so you can read a touch longer, but the base must stay loaded.",
            elite_marker:
              "Loaded but a touch more patient — reading longer before committing the platform because the ball travels slower in wind.",
            common_faults: ["Standing tall to watch the ball", "Committing the platform too early"],
            anchors: {
              developing: "Tall, straight-legged, weight on the heels.",
              solid: "A genuine loaded athletic stance with weight forward, popping upright on some reps.",
              advanced:
                "Consistently loaded and balanced with weight forward through contact; a slightly higher read-posture is acceptable while the ball travels, but the base stays loaded.",
            },
          },
          footwork_to_ball: {
            key: "footwork_to_ball",
            what: "How you cover the wide sand court to the ball.",
            why: "With two passers over a huge court, first-step explosiveness and an early read decide the pass.",
            elite_marker:
              "Reads and releases early, covers the wide sand court, and is stopped and balanced with the midline behind the ball before contact.",
            common_faults: ["Releasing late over the big court", "Contacting while still drifting"],
            anchors: {
              developing: "Feet late or stuck; reaching, or contacting while drifting.",
              solid: "Shuffles to get mostly behind the ball, occasionally a beat late over the large court.",
              advanced:
                "Reads and releases early, covers the wide sand court, and is stopped and balanced with the midline behind the ball before contact.",
            },
          },
          angle_to_target: {
            key: "angle_to_target",
            what: "How you aim a high pass at the partner setter.",
            why: "A higher, softer ball gives the lone setter time to move to it in the wind.",
            elite_marker:
              "Platform and hips oriented to the partner's spot, delivering a high, on-target ball on a repeatable line that gives the setter time in the wind.",
            common_faults: ["Passing flat so the setter can't chase it", "Leaking the ball off the target side"],
            anchors: {
              developing: "The platform faces where the ball came from; the ball rebounds in no controlled direction.",
              solid: "Drops the shoulder and generally sends the ball toward the partner setter, with the line varying.",
              advanced:
                "Platform and hips oriented to the partner's spot, delivering a high, on-target ball on a repeatable line that gives the setter time in the wind.",
            },
          },
          contact_control: {
            key: "contact_control",
            what: "The touch on the ball in wind.",
            why: "A flat or spinning pass gets punished by the wind, so elite passers cushion higher and softer.",
            elite_marker:
              "Clean mid-forearm contact off a quiet platform that absorbs pace with the legs, producing a high, soft, spin-free ball with an arc tuned for the wind.",
            common_faults: ["A flat, fast pass the wind pushes off target", "Adding spin that the wind runs with"],
            anchors: {
              developing: "Punches or swings at the ball; a flat or spinning pass the wind punishes.",
              solid: "A mostly quiet platform with reasonable height and some variation.",
              advanced:
                "Clean mid-forearm contact off a quiet platform that absorbs pace with the legs, producing a high, soft, spin-free ball with a repeatable arc tuned for the wind.",
            },
          },
        },
      },
    },
  },

  set: {
    skill: "set",
    persona: "a world-class volleyball setting coach",
    byDiscipline: {
      indoor: {
        overview:
          "The offense's steering wheel. Elite setters arrive early, hide their intent, and deliver a spin-free ball on a repeatable line.",
        highest_leverage_metric: "hand_shape",
        highest_leverage_note:
          "Clean, spin-free hands are the foundation and the thing referees and hitters feel first.",
        phases: [
          { name: "Move & square", detail: "Beat the ball to the spot and square the hips to the target." },
          { name: "Hands to the ball", detail: "Take the ball on the fingerpads in a window above the forehead." },
          { name: "Release", detail: "Extend legs-to-hands into a quiet, symmetric follow-through." },
          { name: "Recover", detail: "Land balanced and reset for the next play." },
        ],
        metrics: {
          hand_shape: {
            key: "hand_shape",
            what: "How the ball sits and leaves your hands.",
            why: "Clean fingerpad contact with no spin is legal, accurate, and what a hitter can trust.",
            elite_marker:
              "Clean fingerpad contact every rep, a symmetric ten-finger load, thumbs back toward the brow, the ball leaving with little or no spin from an identical window.",
            common_faults: ["Contacting on the palms so the ball slaps and spins", "Uneven or stiff fingers"],
            anchors: {
              developing: "The ball contacts the palms or a flat 'pancake'; fingers stiff or spread unevenly; an audible slap and heavy spin off the hands.",
              solid: "The ball is caught on the fingerpads with a recognizable triangle window above the forehead; some palm involvement or uneven load, minor spin.",
              advanced:
                "Clean fingerpad contact every rep, a symmetric ten-finger load, thumbs back toward the brow, the ball leaving with little or no spin from an identical window.",
            },
            exemplars: ["Simone Giannelli", "Micah Christenson", "Bruno Rezende"],
          },
          footwork: {
            key: "footwork",
            what: "How you get to the ball and plant.",
            why: "Arriving early and squared before contact is what makes an accurate set repeatable.",
            elite_marker:
              "Beats the ball to the spot early, a balanced right-left plant into a stable base, weight controlled through contact, and a clean recovery step.",
            common_faults: ["Arriving late and setting on the move", "Wrong foot forward or an unstable base"],
            anchors: {
              developing: "Stationary or arrives late and sets on the move; no plant, wrong foot forward, or feet still drifting through contact.",
              solid: "Moves to the ball and plants on most reps into a squared base, though timing is a touch late or the base too narrow or wide.",
              advanced:
                "Beats the ball to the spot early, a balanced right-left plant into a stable base, weight controlled through contact, and a clean recovery step.",
            },
          },
          body_alignment: {
            key: "body_alignment",
            what: "How square and neutral your body is at contact.",
            why: "A square, neutral posture aims the set and hides whether it is going front or back.",
            elite_marker:
              "Hips and shoulders consistently square and level, contact centered over the forehead, and a neutral posture that hides front-versus-back intent until the release.",
            common_faults: ["Leaning or arching that telegraphs the set", "Contact drifting to one side of the head"],
            anchors: {
              developing: "Hips and shoulders face away from the target; leaning or arching before contact telegraphs direction; contact off to one side of the head.",
              solid: "Generally squared to the target with contact over the forehead; occasional uneven shoulders or a slight pre-contact lean.",
              advanced:
                "Hips and shoulders consistently square and level, contact centered over the forehead, and a neutral posture that hides intent until the release.",
            },
            exemplars: ["Micah Christenson"],
          },
          release: {
            key: "release",
            what: "How the ball is pushed out of the hands.",
            why: "A quiet, leg-driven release delivers a clean, repeatable ball instead of a flat push.",
            elite_marker:
              "A smooth load-and-extend through knees, elbows, and wrists into a full, symmetric follow-through — compact, quiet, on a clean repeatable trajectory.",
            common_faults: ["A stiff, arm-only punch with no leg drive", "Locked wrists producing a flat, fluttering ball"],
            anchors: {
              developing: "A stiff punch or arm-only push with no leg drive; wrists locked; the ball flutters or comes out flat; follow-through absent or asymmetric.",
              solid: "A coordinated leg-to-hand extension with a reasonably quiet release; a catchable arc; minor push or a slightly late finish on some reps.",
              advanced:
                "A smooth load-and-extend through knees, elbows, and wrists into a full, symmetric follow-through — compact, quiet, on a clean repeatable trajectory.",
            },
          },
          tempo_decision: {
            key: "tempo_decision",
            what: "The set you choose and its timing.",
            why: "Matching tempo and location to the hitter (and the block) is what turns a set into a kill.",
            elite_marker:
              "A decisive, well-disguised choice that matches tempo to the hitter and reads the block; contact timing places the ball in the hitter's window, and the reads repeat.",
            common_faults: ["A predetermined set that ignores the play", "Tempo that arrives early or late for the hitter"],
            anchors: {
              developing: "No apparent read; the set looks predetermined; tempo mismatches the hitter; the jump-versus-standing choice looks arbitrary.",
              solid: "Reasonable set selection and tempo; contact timing generally supports the hitter; reads a beat slow or slightly telegraphed on some reps.",
              advanced:
                "A decisive, well-disguised choice that matches tempo to the hitter and any visible block movement; contact timing places the ball in the hitter's window, and the reads repeat.",
            },
            exemplars: ["Simone Giannelli"],
          },
        },
      },
      beach: {
        overview:
          "One setter, stricter ball-handling, and wind — the beach set is higher, softer, and often a bump-set, and legality is part of the skill.",
        highest_leverage_metric: "release",
        highest_leverage_note:
          "A stable, legal, high ball that gives the lone hitter time beats speed on sand.",
        context_note:
          "Beach: one setter often sets on the move; hand-sets are judged strictly for spin/double-contact, but a longer legal 'deep dish' or a bump-set is a valid choice in wind.",
        phases: [
          { name: "Chase the dig", detail: "Cover the court off the dig and get to the ball however the play allows." },
          { name: "Choose hands or bump", detail: "Hand-set when balanced; bump-set in wind or off a hard dig to stay legal." },
          { name: "Deliver high & soft", detail: "Give the lone hitter a high, stable ball with room from the block." },
          { name: "Transition", detail: "Recover to help cover the hitter." },
        ],
        metrics: {
          hand_shape: {
            key: "hand_shape",
            what: "How clean and legal the ball leaves your hands.",
            why: "Beach referees judge spin and double-contact strictly, so a clean or bump-set delivery is what avoids a fault.",
            elite_marker:
              "Beach hand-sets are judged strictly for spin and doubles — but a legal set can have a longer, guided contact ('deep dish') and be played lower, and many top teams bump-set in wind to avoid a call.",
            common_faults: ["Visible spin a referee would whistle", "A double-contact on an off-balance set"],
            anchors: {
              developing: "Palm contact or heavy spin on release (a beach lift or double a referee would call).",
              solid: "Fingerpad contact with a recognizable window and only minor spin, or a clean bump-set.",
              advanced:
                "Clean, spin-free delivery every rep — either a symmetric fingerpad hand-set with a longer legal guide, or a controlled, accurate bump-set chosen for the wind.",
            },
          },
          footwork: {
            key: "footwork",
            what: "How you get to the ball off a dig, often on the move.",
            why: "One setter covers the whole court, so stability is judged relative to how far the dig pulled you.",
            elite_marker:
              "One setter covering the whole court off a dig — footwork is more improvised, often setting from a run or slightly off-balance, but stopped and squared when possible.",
            common_faults: ["Setting flat-footed and late", "Badly off-balance when it could have been stopped"],
            anchors: {
              developing: "Sets flat-footed and late, or badly off-balance.",
              solid: "Gets to the ball and sets from a mostly stable base when the dig allows.",
              advanced:
                "Gets stopped and squared when possible, and stays balanced and accurate even when forced to set on the move off a wide dig.",
            },
          },
          body_alignment: {
            key: "body_alignment",
            what: "How square and stable your delivery is.",
            why: "Against one blocker, consistency and height matter more than the disguise prized indoors.",
            elite_marker:
              "A stable, square, level delivery with centered contact; on the beach, consistency and height matter more than disguise.",
            common_faults: ["Facing away from the hitter", "An unstable, leaning delivery"],
            anchors: {
              developing: "Hips and shoulders face away from the target; contact off to one side.",
              solid: "Generally square with contact over the forehead.",
              advanced:
                "A stable, square, level delivery with centered contact; on the beach, consistency and height matter more than the disguise prized indoors.",
            },
          },
          release: {
            key: "release",
            what: "How the ball is delivered — high and soft for the lone hitter.",
            why: "A high, soft, stable ball gives the single hitter time to attack against wind and the block.",
            elite_marker:
              "A smooth, leg-driven release delivering a high, soft, stable ball (a legally guided, longer contact is desirable) that gives the lone hitter time in wind.",
            common_faults: ["A fast flat set that's risky in wind", "An arm-only push"],
            anchors: {
              developing: "A stiff arm-only push, a flat ball, or an asymmetric finish.",
              solid: "A coordinated leg-to-hand extension, a catchable arc, minor push on some reps.",
              advanced:
                "A smooth, leg-driven release delivering a high, soft, stable ball that gives the lone hitter time in wind, on a repeatable trajectory.",
            },
          },
          tempo_decision: {
            key: "tempo_decision",
            what: "Where you place the set for one hitter versus one blocker.",
            why: "With a single hitter, the decision is placement — on/off the net, in/out, and room from the block and wind.",
            elite_marker:
              "Decisive placement for the single partner-hitter versus the one blocker and the wind — on or off the net, in or out, giving the hitter room.",
            common_faults: ["Placement that ignores the block and wind", "A ball the hitter can't use"],
            anchors: {
              developing: "Predetermined placement that ignores the block and wind; the ball arrives where the hitter cannot use it.",
              solid: "A reasonable location and height for the situation, slightly telegraphed or off on some reps.",
              advanced:
                "Decisive placement for the single partner-hitter versus the one blocker and the wind — on or off the net, in or out, giving the hitter room.",
            },
          },
        },
      },
    },
  },

  attack: {
    skill: "attack",
    persona: "an elite volleyball attacking coach",
    byDiscipline: {
      indoor: {
        overview:
          "Where the kinetic chain is most visible. Pros convert a fast, well-spaced approach into apex contact and a whip-fast, sequenced swing.",
        highest_leverage_metric: "approach_footwork",
        highest_leverage_note:
          "The slow-to-fast approach and apex timing are what unlock contact height and power.",
        phases: [
          { name: "Approach", detail: "Accelerate through a slow-to-fast approach with a long penultimate step." },
          { name: "Load & jump", detail: "Convert the plant into an explosive vertical jump and a high-elbow load." },
          { name: "Contact", detail: "Meet the ball at the top of the reach, in front of the hitting shoulder." },
          { name: "Finish", detail: "Snap through the ball and land balanced, ready to transition." },
        ],
        metrics: {
          approach_footwork: {
            key: "approach_footwork",
            what: "The step pattern and rhythm of your approach.",
            why: "A slow-to-fast approach with a hard final plant is what converts run-up speed into a vertical jump.",
            elite_marker:
              "An explosive, well-spaced approach with a distinct slow-to-fast tempo — a long penultimate step and a quick, hard heel-to-toe plant converting speed into lift.",
            common_faults: ["Even-paced steps with no acceleration", "Drifting or broad-jumping into the net"],
            anchors: {
              developing: "A wrong or inconsistent step pattern; even-paced steps with no acceleration; feet plant flat, or the hitter drifts into the net.",
              solid: "A recognizable left-right-left rhythm with a directional first step and a clear penultimate-to-last acceleration and a heel-first plant.",
              advanced:
                "An explosive, well-spaced approach with a slow-to-fast tempo, a long penultimate step, and a quick, hard heel-to-toe plant converting speed into lift, consistent every rep.",
            },
            exemplars: ["Yūji Nishida", "Wilfredo León"],
          },
          jump_timing: {
            key: "jump_timing",
            what: "When you jump relative to the set.",
            why: "Jumping so you contact at the apex lets you hit the ball at its highest, most attackable point.",
            elite_marker:
              "Takeoff precisely timed to the set so contact is at the apex in the ideal window, attacking the ball at its highest playable point every rep.",
            common_faults: ["Jumping too early and hitting on the way down", "Broad-jumping forward instead of up"],
            anchors: {
              developing: "Clearly mistimed — jumps well before or after the set; contacts on the way down or broad-jumps forward rather than up.",
              solid: "Takeoff roughly synced so the hitter meets the ball near the top of the jump; contact near peak with slight early or late error.",
              advanced:
                "Takeoff precisely timed so contact is at the apex in the ideal window, attacking the ball at its highest playable point; timing holds across reps.",
            },
          },
          arm_swing: {
            key: "arm_swing",
            what: "The mechanics of the hitting arm.",
            why: "A sequenced whip with a wrist snap is where power and topspin come from.",
            elite_marker:
              "A fast, whip-like swing with a high-and-back elbow load, a strong non-hitting-arm pull, a late elbow-to-hand acceleration, and a crisp wrist snap for heavy topspin.",
            common_faults: ["A low 'chicken-wing' elbow", "Pushing with a stiff wrist and no non-hitting-arm pull"],
            anchors: {
              developing: "A low or 'chicken-wing' elbow; both arms drop together; pushes or slaps with a stiff wrist and no topspin snap; the non-hitting arm unused.",
              solid: "A high elbow with a recognizable bow-and-arrow load; the non-hitting arm helps track and pull the chest through; a wrist snap over the top.",
              advanced:
                "A fast, whip-like swing with a high-and-back elbow load, a strong non-hitting-arm pull, a late elbow-to-hand acceleration, and a crisp wrist snap, repeated cleanly.",
            },
            exemplars: ["Wilfredo León", "Paola Egonu", "Yūji Nishida"],
          },
          contact_height: {
            key: "contact_height",
            what: "How high and how far in front you contact.",
            why: "Higher, more-forward contact gives a steeper downward angle and more of the court to hit.",
            elite_marker:
              "Contact at full arm extension, clearly above and in front of the hitting shoulder at the top of the reach — the highest, most forward playable point.",
            common_faults: ["Contacting behind or beside the head", "A bent arm at contact, below full reach"],
            anchors: {
              developing: "Contacts the ball low, behind, or beside the head; the arm is bent at contact; the ball is played below full reach.",
              solid: "Contact above the head and roughly in front of the hitting shoulder with a mostly extended arm, near full reach.",
              advanced:
                "Contact at full arm extension, clearly above and in front of the hitting shoulder at the top of the reach, for maximum downward angle.",
            },
          },
          power_followthrough: {
            key: "power_followthrough",
            what: "How the whole body drives through the swing and lands.",
            why: "The legs-hips-core chain and a full follow-through drive the ball down; a balanced landing keeps you in the play.",
            elite_marker:
              "An explosive full-body kinetic chain — legs, hips, and core snapping into the swing — with a long follow-through across the body driving the ball down and a controlled, balanced landing.",
            common_faults: ["An arm-only swing that stalls at contact", "A short follow-through or an off-balance landing"],
            anchors: {
              developing: "An arm-only swing that decelerates or stops at contact; no core or hip engagement; a short, cut-off follow-through; an off-balance landing.",
              solid: "Visible core and hip engagement adding to the swing; the follow-through continues past contact toward the opposite hip; a balanced two-foot landing.",
              advanced:
                "An explosive full-body kinetic chain with a long follow-through across the body driving the ball down and a controlled, balanced landing.",
            },
            exemplars: ["Wilfredo León", "Paola Egonu"],
          },
        },
      },
      beach: {
        overview:
          "On sand you jump straight up and win with shot-making — cut, line, roll, and pokey — as much as with power.",
        highest_leverage_metric: "approach_footwork",
        highest_leverage_note:
          "Sand punishes the broad jump and rewards a straight-up takeoff plus shot versatility.",
        context_note:
          "Beach: on sand you must jump straight up (a forward broad jump sinks), sets are higher/slower in wind, and shot-making (cut, line, roll, pokey) matters as much as power.",
        phases: [
          { name: "Approach", detail: "Take as many steps as the sand needs with an accelerating finish." },
          { name: "Jump straight up", detail: "Drive straight up out of the sand with an aggressive arm swing for lift." },
          { name: "Read & choose the shot", detail: "Adjust to the wind-moved set and pick a swing, cut, line, roll, or pokey." },
          { name: "Land balanced", detail: "Finish under control so you're ready for the next ball." },
        ],
        metrics: {
          approach_footwork: {
            key: "approach_footwork",
            what: "The approach and takeoff on sand.",
            why: "A forward broad jump sinks and stalls in sand, so a straight-up takeoff is what preserves your jump.",
            elite_marker:
              "An efficient approach (as many steps as the sand needs) with a slow-to-fast finish and a straight-up takeoff, arms swung aggressively behind and up to drive lift out of the sand.",
            common_faults: ["A forward broad-jump takeoff that sinks", "Even-paced steps with no acceleration"],
            anchors: {
              developing: "A wrong or even-paced step pattern, or a forward broad-jump takeoff that sinks into the sand.",
              solid: "A recognizable accelerating approach with a roughly straight-up takeoff, some sink or drift.",
              advanced:
                "An efficient approach with a slow-to-fast finish and a straight-up takeoff, arms swung aggressively behind and up to drive lift out of the sand, repeatable.",
            },
          },
          jump_timing: {
            key: "jump_timing",
            what: "Timing the jump to a wind-moved set.",
            why: "Higher, slower sets in wind mean the timing is about waiting on and adjusting to a moving ball.",
            elite_marker:
              "Waits on and adjusts to the wind-affected set and still contacts at the apex in the ideal window, consistently.",
            common_faults: ["Mistiming a wind-moved set", "Contacting on the way down"],
            anchors: {
              developing: "Clearly mistimed to a wind-moved set; contacts on the way down.",
              solid: "Meets the ball near the top of the jump with slight error while adjusting to the set.",
              advanced: "Waits on and adjusts to the wind-affected set and still contacts at the apex in the ideal window, consistently.",
            },
          },
          arm_swing: {
            key: "arm_swing",
            what: "The hitting arm, built for disguise and shots.",
            why: "Elite beach hitters disguise the swing so it can become a swing, cut, line, roll, or pokey at the last instant.",
            elite_marker:
              "A fast, high-elbow load whose contact is disguised until the last instant and can become a hard swing, cut, line, roll, or pokey; clean and versatile across reps.",
            common_faults: ["An arm-only push with one option", "Telegraphing the shot early"],
            anchors: {
              developing: "An arm-only push or a low elbow; no disguise and one option.",
              solid: "A high-elbow load with a recognizable swing and one or two shot options.",
              advanced:
                "A fast, high-elbow load whose contact is disguised until the last instant and can become a hard swing, cut, line, roll, or pokey; clean and versatile across reps.",
            },
          },
          contact_height: {
            key: "contact_height",
            what: "How high you contact, preserving shot options.",
            why: "Height keeps the downball and the full shot menu available even when a big swing isn't on.",
            elite_marker:
              "Full-extension contact above and in front of the hitting shoulder, preserving both the downball and the full shot menu even when a big swing is not on.",
            common_faults: ["Low or behind-the-head contact", "Letting the wind pull contact down"],
            anchors: {
              developing: "Low or behind-the-head contact.",
              solid: "Contact above the head with the arm mostly extended.",
              advanced:
                "Full-extension contact above and in front of the hitting shoulder, preserving both the downball and the full shot menu even when a big swing is not on.",
            },
          },
          power_followthrough: {
            key: "power_followthrough",
            what: "The finish and the sand landing.",
            why: "On sand a balanced landing keeps you in the play, and control or placement often beats raw power.",
            elite_marker:
              "A controlled full-body finish that drives the ball down, or a disciplined shot placed away from the defender, with a balanced sand landing that leaves the player ready.",
            common_faults: ["A stumbling, sinking sand landing", "Swinging for power and hitting it out"],
            anchors: {
              developing: "An arm-only swing that stalls, or a stumbling, sinking sand landing.",
              solid: "Visible core and hip engagement, a follow-through past contact, and a mostly balanced sand landing.",
              advanced:
                "A controlled full-body finish that drives the ball down or a disciplined shot placed away from the defender, with a balanced sand landing that leaves the player ready.",
            },
          },
        },
      },
    },
  },

  block: {
    skill: "block",
    persona: "an elite indoor volleyball blocking coach",
    byDiscipline: {
      indoor: {
        overview:
          "A reading skill first, an athletic one second. Pros sequence their eyes setter to hitter and press their hands into the opponent's air.",
        highest_leverage_metric: "read_timing",
        highest_leverage_note:
          "Jumping on the right count off the hitter is what makes the press and footwork pay off.",
        phases: [
          { name: "Read", detail: "Sequence the eyes setter, then ball, then the hitter's arm." },
          { name: "Move & square", detail: "Travel to the attack with the right footwork and square to the net." },
          { name: "Penetrate", detail: "Jump on the hitter's count and press the hands over the net." },
          { name: "Land & transition", detail: "Land balanced off the net and reset for the next play." },
        ],
        metrics: {
          read_timing: {
            key: "read_timing",
            what: "Where you look and when you jump.",
            why: "Reading the hitter (not the set) and jumping on the right count is what puts your hands where the ball is.",
            elite_marker:
              "Transfers focus setter-to-hitter and tunes takeoff to attack tempo so the hands reach maximum penetration exactly as, or just after, the hitter contacts.",
            common_faults: ["Jumping with the set instead of the hitter", "Ball-watching and losing the hitter"],
            anchors: {
              developing: "Jumps on the set or on a fixed cue rather than the attacker; leaves the ground too early or late; eyes locked on the ball.",
              solid: "Keys the hitter's approach and generally times takeoff so the hands reach the top of the net near contact; slightly early or late on faster sets.",
              advanced:
                "Clearly transfers focus setter-to-hitter and tunes takeoff to attack tempo so the hands reach maximum penetration exactly as, or just after, the hitter contacts, consistently.",
            },
            exemplars: ["Srećko Lisinac", "Max Holt"],
          },
          hand_penetration: {
            key: "hand_penetration",
            what: "How far your hands reach over the net and how they're angled.",
            why: "Pressing over and angling the hands down turns a touch into a straight-down block.",
            elite_marker:
              "Shoulders shrugged and both hands reaching well onto the hitter's side, wrists firmly flexed and angled down-and-in, fingers wide and stiff, nothing splitting the seam.",
            common_faults: ["Reaching vertically or backward, not over the net", "Loose wrists or a gap that splits the seam"],
            anchors: {
              developing: "Hands stay on the blocker's own side or reach vertically or backward; loose wrists or fingers together; a gap under or between the hands.",
              solid: "Hands cross the plane of the net with firm wrists and spread fingers and press over the tape, but are not fully angled downward.",
              advanced:
                "Shoulders shrugged, both hands reaching well onto the hitter's side, wrists firmly flexed and angled down-and-in, fingers wide and stiff, nothing splitting the seam.",
            },
            exemplars: ["Robertlandy Simón"],
          },
          lateral_footwork: {
            key: "lateral_footwork",
            what: "How you move along the net and square up.",
            why: "Arriving squared and planted lets you jump straight up instead of drifting into a useless block.",
            elite_marker:
              "Selects the right pattern for the distance, decelerates and squares hips and shoulders to the net before takeoff, plants both feet under the body, and jumps vertically with no drift.",
            common_faults: ["Crossing the feet on the last step", "Drifting sideways in the air"],
            anchors: {
              developing: "Moves upright with poor rhythm, crosses the feet on the final step, or drifts sideways through the air; arrives off-balance.",
              solid: "Uses an efficient shuffle or crossover and is mostly square on arrival with the last step planted under the hips; some residual drift.",
              advanced:
                "Selects the right pattern for the distance, squares hips and shoulders before takeoff, plants both feet under the body, and jumps vertically with no drift.",
            },
          },
          body_position: {
            key: "body_position",
            what: "Your posture and hand position at the net.",
            why: "Pre-loaded high hands and a square, angled block face channel the ball down into the court.",
            elite_marker:
              "A compact athletic posture with shoulders and hips square to the net, minimal arm swing because the hands are pre-loaded high, and a block face angled to channel the ball to the middle of the court.",
            common_faults: ["Open shoulders that deflect the ball out", "Swinging the arms down to jump"],
            anchors: {
              developing: "Shoulders open or angled to the net, the back arched, arms swung down to generate the jump; the block face points off-court.",
              solid: "Reasonably square and balanced, hands near ready height, the block face generally directed into the court, though there is some arch or arm swing.",
              advanced:
                "A compact posture with shoulders and hips square to the net, minimal arm swing because the hands are pre-loaded high, and a block face angled to the court's middle.",
            },
          },
          landing_recovery: {
            key: "landing_recovery",
            what: "How you land and reset.",
            why: "A soft, balanced landing off the net lets you transition into the next play instead of being stuck.",
            elite_marker:
              "Lands softly on the balls of both feet under control in the same spot with no net or centerline contact, then immediately peels off the net and resets hands and eyes.",
            common_faults: ["Landing into the net or over the center line", "A slow reset that misses the next play"],
            anchors: {
              developing: "Lands stiff-legged, off-balance, drifting into the net, or crumpling; no reset for the next play.",
              solid: "Lands on two feet in balance near the takeoff spot and absorbs with bent knees, but the release into transition is slow.",
              advanced:
                "Lands softly on the balls of both feet under control in the same spot with no net or centerline contact, then immediately peels off and resets hands and eyes.",
            },
          },
        },
      },
      beach: {
        overview:
          "A one-on-one chess match: take a zone, press to channel the ball to your partner, or peel off the net entirely when the set is bad.",
        highest_leverage_metric: "read_timing",
        highest_leverage_note:
          "Committing to a zone or peeling correctly is the whole beach blocking skill.",
        context_note:
          "Beach: blocking is one-on-one; the blocker takes a zone and channels to the single defender, or peels off the net to become the second defender when the set is bad.",
        phases: [
          { name: "Read the hitter", detail: "Line the head up with the ball and read a single hitter." },
          { name: "Decide block or pull", detail: "Commit to a zone (line or angle) or peel off the net on a bad set." },
          { name: "Penetrate & channel", detail: "Press over and angle the hands to channel the ball to your partner." },
          { name: "Land & transition", detail: "Land balanced on sand and transition to the next role." },
        ],
        metrics: {
          read_timing: {
            key: "read_timing",
            what: "Reading one hitter and choosing to block or peel.",
            why: "In a one-on-one, deciding pre-contact to take a zone or pull off the net is the core skill.",
            elite_marker:
              "One-on-one: reads a single hitter, lines the head up with the ball, and decides pre-contact to take a zone (line or angle) — or peels off the net when the set is off.",
            common_faults: ["Staying at the net on a bad set that should be peeled", "Jumping on the set"],
            anchors: {
              developing: "Jumps on the set or on a fixed cue, or stays at the net on a bad set that should be peeled.",
              solid: "Reads the hitter and generally times the jump, occasionally late to decide block-versus-pull.",
              advanced:
                "Transfers focus setter-to-hitter, lines the head up with the ball, decides block-or-pull correctly before contact, and peels cleanly when the set is off.",
            },
            exemplars: ["Phil Dalhausser", "Anders Mol"],
          },
          hand_penetration: {
            key: "hand_penetration",
            what: "The press, angled to channel the ball to the defender.",
            why: "On beach the hands take one shot and steer the ball into the partner defender's zone.",
            elite_marker:
              "The same press as indoors, but the hands are angled to take a specific shot and channel the ball into the partner defender's zone — huge-reach blockers dominate.",
            common_faults: ["Reaching vertically or splitting the seam", "Not channeling to the partner's zone"],
            anchors: {
              developing: "Hands stay on the blocker's side, reach vertically or backward, or split the seam.",
              solid: "Hands cross the net with firm wrists and press over the tape.",
              advanced:
                "Shoulders shrugged, hands well onto the hitter's side, wrists angled down-and-in, fingers wide and stiff, deliberately angled to channel the ball into the partner's zone.",
            },
            exemplars: ["Phil Dalhausser", "Anders Mol"],
          },
          lateral_footwork: {
            key: "lateral_footwork",
            what: "Small adjustment steps and a vertical jump on the smaller net.",
            why: "Beach blocking has less lateral travel, so verticality and squaring beat long slides.",
            elite_marker:
              "Efficient footwork over the smaller net with a squared, vertical, no-drift jump; weight jump verticality and squaring over long lateral travel.",
            common_faults: ["Crossing the feet", "Drifting sideways in the air"],
            anchors: {
              developing: "Upright, crossing the feet, or drifting sideways in the air.",
              solid: "Efficient small adjustment steps, mostly square on takeoff.",
              advanced:
                "Efficient footwork over the smaller net with a squared, vertical, no-drift jump; verticality and squaring over long lateral travel.",
            },
          },
          body_position: {
            key: "body_position",
            what: "Posture and a block face angled to a called shot.",
            why: "Pre-loaded high hands and an intentional block-face angle take one shot and leave the rest for the defender.",
            elite_marker:
              "A compact posture, shoulders and hips square, hands pre-loaded high, and a block face intentionally angled to take the called shot and leave the rest for the defender.",
            common_faults: ["Open shoulders", "Swinging the arms down to jump"],
            anchors: {
              developing: "Shoulders open, arms swung down to jump, reaching sideways.",
              solid: "Reasonably square and balanced with the hands near ready height.",
              advanced:
                "A compact posture with shoulders and hips square, hands pre-loaded high, and a block face intentionally angled to take the called shot and leave the rest for the defender.",
            },
          },
          landing_recovery: {
            key: "landing_recovery",
            what: "Landing on sand and transitioning to the next role.",
            why: "After the block the beach player must instantly become a defender or attacker.",
            elite_marker:
              "Lands softly and balanced on the sand, then instantly transitions — to defense, or peels to become the second back-court defender, a defined beach skill.",
            common_faults: ["Landing off-balance in the sand", "A slow transition off the net"],
            anchors: {
              developing: "Lands stiff or off-balance, into the net, or unable to make a next play.",
              solid: "Lands balanced on two feet and absorbs with the knees, but transitions slowly.",
              advanced:
                "Lands softly and balanced on the sand, then instantly transitions — to defense, or peels to become the second back-court defender.",
            },
          },
        },
      },
    },
  },

  dig: {
    skill: "dig",
    persona: "an elite volleyball defensive coach",
    byDiscipline: {
      indoor: {
        overview:
          "Defense is anticipation wearing a platform. Pros time a stopped split-step to the attacker's contact and are already reading line versus angle.",
        highest_leverage_metric: "read_anticipation",
        highest_leverage_note:
          "Reading the hitter's arm (not the ball) is what turns a great athlete into a great digger.",
        phases: [
          { name: "Read & load", detail: "Read the hitter's arm and land a stopped split-step at contact." },
          { name: "Move to the ball", detail: "Break to the ball's line and get the body behind it." },
          { name: "Contact", detail: "Play a firm, still platform up toward the target." },
          { name: "Recover", detail: "Push back to a balanced base for the next contact." },
        ],
        metrics: {
          ready_position: {
            key: "ready_position",
            what: "Your loaded stance and split-step timing.",
            why: "A stopped, loaded split-step at the hitter's contact lets you explode in any direction.",
            elite_marker:
              "A low, loaded base — hips below shoulders, weight forward on light heels — with a well-timed, stopped split-step landing an instant before every attacker contact.",
            common_faults: ["A tall stance with weight on the heels", "No split-step, or one that lands after contact"],
            anchors: {
              developing: "Stance tall or narrow; weight on the heels or flat-footed; hands low or clasped rigid; little or no split-step, or the split lands after contact.",
              solid: "Feet shoulder-width or wider, knees bent, hips loaded, weight forward, hands out in front; a recognizable split-step around contact, though timing varies.",
              advanced:
                "Consistently low and loaded, hips below shoulders, a well-timed stopped split-step landing an instant before every attacker contact, ready to explode.",
            },
            exemplars: ["Jenia Grebennikov", "Erik Shoji"],
          },
          read_anticipation: {
            key: "read_anticipation",
            what: "How early and how well you read the attack.",
            why: "Reading the hitter's arm before contact is what lets you move to the ball instead of chasing it.",
            elite_marker:
              "Early, correct reads every rep — eyes tracking setter, ball, then the hitter's arm; the first step commits to the right zone as or just before contact; as ready for a tip as a hard swing.",
            common_faults: ["Ball-watching instead of reading the arm", "Committing the wrong direction"],
            anchors: {
              developing: "Eyes fixed on the ball only; reacts after the ball crosses the net, moves the wrong direction, or is caught flat and late.",
              solid: "Head and eyes track the attacker and hitting arm; first movement initiates near contact and generally toward the correct area, with occasional late reads.",
              advanced:
                "Early, correct reads every rep; posture and first step commit to the right zone as or just before contact; adjusts to tips and off-speed as readily as hard swings.",
            },
            exemplars: ["Jenia Grebennikov"],
          },
          platform_control: {
            key: "platform_control",
            what: "The quality of the dig contact.",
            why: "A firm, still platform angled to target turns a hard-driven ball into a playable one.",
            elite_marker:
              "A firm, flat, still platform with contact centered between the wrists in front of the midline; the shoulders angle the ball to target with minimal swing, producing a high, controlled ball.",
            common_faults: ["Swinging or punching at a hard-driven ball", "A broken platform with bent elbows"],
            anchors: {
              developing: "Hands swing or punch at the ball; the platform is broken (bent elbows, misaligned wrists); contact off-center and the ball caroms with no control.",
              solid: "Two joined, mostly flat forearms with locked elbows contact the ball in front of the body, angled toward target with limited swing; the dig generally goes up and forward.",
              advanced:
                "A firm, flat, still platform with contact centered between the wrists in front of the midline, shoulders angling the ball to target with minimal swing, rep after rep.",
            },
          },
          movement_pursuit: {
            key: "movement_pursuit",
            what: "How you cover ground to the ball.",
            why: "Efficient pursuit and all-out emergency moves keep balls alive that a step-late defender loses.",
            elite_marker:
              "An explosive, efficient first step and run-through; consistently gets behind the ball or commits to an extension, dive, or roll that keeps it alive.",
            common_faults: ["Reaching with the arms before the feet arrive", "Cross-stepping and arriving unbalanced"],
            anchors: {
              developing: "Feet arrive late or not at all; reaching or lunging with the arms instead of moving the feet; cross-steps and arrives unbalanced.",
              solid: "Shuffle and step footwork gets behind most balls and generally stops the feet before contact; honest pursuit on wide balls even when position is imperfect.",
              advanced:
                "An explosive, efficient first step and run-through; consistently gets behind the ball or commits to an extension, dive, or roll; squares and stops the feet whenever the play allows.",
            },
          },
          recovery: {
            key: "recovery",
            what: "How fast you reset after the dig.",
            why: "Getting back to a balanced base keeps you in the rally for the next contact.",
            elite_marker:
              "Immediately pushes back to a balanced base facing the net after every rep, including after rolls and extensions, transitioning cleanly with no wasted floor time.",
            common_faults: ["Staying down to admire the dig", "Slow to reset after a roll or extension"],
            anchors: {
              developing: "After contact the player stays down, watches the dig, or is slow and off-balance and unable to make a next play.",
              solid: "Regains a ready stance after most reps and re-orients, though recovery may be slow after emergency touches.",
              advanced:
                "Immediately pushes back to a balanced base facing the net after every rep, including after rolls and extensions, transitioning cleanly with no wasted floor time.",
            },
          },
        },
      },
      beach: {
        overview:
          "Two players, a huge sand court, and legal overhand digs — elite beach defense is all-out reading, coverage, and lay-outs.",
        highest_leverage_metric: "read_anticipation",
        highest_leverage_note:
          "Reading cut, line, and pokey and playing what the block leaves is what defines beach defense.",
        context_note:
          "Beach: two players cover a huge court with no libero; reading (line/angle/cut/pokey) is everything, and a legal overhand 'tomahawk' or momentarily-held hand dig is allowed on hard-driven balls.",
        phases: [
          { name: "Read with the blocker", detail: "Start upright to read, coordinated with the blocker's taken zone." },
          { name: "Load late", detail: "Drop into a stopped, loaded base as the hitter swings." },
          { name: "Contact", detail: "Play a firm platform or a legal hand dig high to the middle." },
          { name: "Transition", detail: "Instantly move to set the partner or approach to attack." },
        ],
        metrics: {
          ready_position: {
            key: "ready_position",
            what: "Reading upright, then loading late with the blocker.",
            why: "The slower beach ball lets you read longer, but you must drop into a load just before the hitter swings.",
            elite_marker:
              "Reads more upright (the ball is slower in wind), then drops into a stopped, loaded base just before the hitter contacts, coordinated with the blocker's taken zone.",
            common_faults: ["Weight back with no timed load", "Loading too early or too late"],
            anchors: {
              developing: "A tall or narrow stance, weight back, no timed load.",
              solid: "A loaded athletic base with a read-then-load around attacker contact, timing varying.",
              advanced:
                "Reads more upright, then drops into a stopped, loaded base just before the hitter contacts, coordinated with the blocker's taken zone, ready to explode any direction.",
            },
          },
          read_anticipation: {
            key: "read_anticipation",
            what: "Reading the full beach shot menu off the hitter.",
            why: "Beach defense is won by picking line, angle, cut, or pokey early and playing what the block leaves.",
            elite_marker:
              "Early, correct reads of line, angle, cut, and pokey off the hitter's arm and shoulders, committing to the zone the block does not take and moving to the ball rather than chasing it.",
            common_faults: ["Ball-watching", "Not playing the zone the block leaves open"],
            anchors: {
              developing: "Ball-watching; reacts late or moves the wrong way.",
              solid: "Tracks the hitter's arm and generally commits to the right area, with late or wrong reads on some shots.",
              advanced:
                "Early, correct reads of line, angle, cut, and pokey off the hitter's arm and shoulders, committing to the zone the block does not take and moving to the ball rather than chasing it.",
            },
          },
          platform_control: {
            key: "platform_control",
            what: "The dig contact, including legal hand techniques.",
            why: "A high, controlled dig to the middle buys the setter time, and beach rules allow overhand and hand digs on hard-driven balls.",
            elite_marker:
              "A firm, still platform driving a high controlled ball to the middle to buy setting time in wind; on hard-driven balls, a clean legal overhand or tomahawk (or a momentarily-held hand dig) counts equally.",
            common_faults: ["Punching at a hard ball", "Digging flat instead of high to the middle"],
            anchors: {
              developing: "Swings or punches; an off-center or broken platform; the ball caroms away.",
              solid: "A mostly flat, still platform angled up and forward with reasonable control.",
              advanced:
                "A firm, still platform driving a high controlled ball to the middle to buy setting time; on hard-driven balls, a clean legal overhand, tomahawk, or held hand dig counts equally.",
            },
          },
          movement_pursuit: {
            key: "movement_pursuit",
            what: "Covering the huge sand court and committing to lay-outs.",
            why: "Two players cover an enormous court, so pursuit and all-out lay-out defense define elite beach digging.",
            elite_marker:
              "An explosive first step and run-through covering the large sand court, committing to extensions and lay-out digs to keep the ball alive, squaring the feet when the play allows.",
            common_faults: ["Reaching before the feet arrive", "Not committing to the lay-out"],
            anchors: {
              developing: "Feet late; reaching or lunging; arriving unbalanced.",
              solid: "Shuffle-and-step footwork that gets behind most balls, with honest pursuit on wide ones.",
              advanced:
                "An explosive first step and run-through covering the large sand court, committing to extensions and lay-out digs to keep the ball alive, squaring the feet when the play allows.",
            },
          },
          recovery: {
            key: "recovery",
            what: "Transitioning off the dig with no libero to cover.",
            why: "In a two-person game the digger must instantly become the setter or attacker.",
            elite_marker:
              "Instantly transitions after the dig — with no libero to cover, the defender must be ready to set the partner or approach to attack — pushing back to a balanced base every rep.",
            common_faults: ["Staying down after a lay-out", "Slow to transition to the next contact"],
            anchors: {
              developing: "Stays down or is slow, unable to make the next play.",
              solid: "Regains a base after most reps, slow after emergency touches.",
              advanced:
                "Instantly transitions after the dig — ready to set the partner or approach to attack — pushing back to a balanced base every rep, including after lay-outs.",
            },
          },
        },
      },
    },
  },
};

export function techniqueFor(
  skill: Skill,
  discipline: Discipline = "indoor",
): DisciplineVariant {
  return TECHNIQUE[skill].byDiscipline[discipline];
}

export function metricKnowledge(
  skill: Skill,
  discipline: Discipline,
  key: string,
): MetricKnowledge | undefined {
  return techniqueFor(skill, discipline).metrics[key];
}

/** Drills that train a given metric — derived from each drill's focus_metrics. */
export function drillsForMetric(skill: Skill, key: string): Drill[] {
  return drillsForSkill(skill).filter((d) => d.focus_metrics.includes(key));
}

/**
 * Content invariants that TypeScript can't express. Returns a list of problems
 * (empty = healthy). Run as a fail-fast dev guard below so authoring mistakes
 * surface immediately instead of shipping a broken Learn page or coach note.
 */
export function techniqueProblems(): string[] {
  const problems: string[] = [];
  for (const skill of SKILLS) {
    const keys = metricKeys(skill);
    for (const discipline of DISCIPLINES) {
      const v = techniqueFor(skill, discipline);
      const expected = keys.slice().sort().join(",");
      const actual = Object.keys(v.metrics).slice().sort().join(",");
      if (expected !== actual) {
        problems.push(
          `${skill}/${discipline}: metric keys [${actual}] != METRICS [${expected}]`,
        );
      }
      if (!keys.includes(v.highest_leverage_metric)) {
        problems.push(
          `${skill}/${discipline}: highest_leverage_metric "${v.highest_leverage_metric}" is not a metric key`,
        );
      }
      for (const key of keys) {
        if (v.metrics[key]?.key !== key) {
          problems.push(`${skill}/${discipline}: metric "${key}" has a mismatched key field`);
        }
        if (drillsForMetric(skill, key).length === 0) {
          problems.push(`${skill}/${discipline}: metric "${key}" resolves no drills`);
        }
      }
    }
  }
  return problems;
}

if (process.env.NODE_ENV !== "production") {
  const problems = techniqueProblems();
  if (problems.length > 0) {
    throw new Error("Volleyball knowledge core failed its invariants:\n" + problems.join("\n"));
  }
}
