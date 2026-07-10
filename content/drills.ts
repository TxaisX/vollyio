import type { Drill } from "./drills-types";
import type { Skill } from "@/lib/skills";

export const DRILLS: Drill[] = [
  {
    "slug": "serve-toss-and-freeze",
    "name": "Toss and Freeze",
    "skill": "serve",
    "level": "beginner",
    "duration_min": 10,
    "equipment": [
      "volleyball"
    ],
    "summary": "Isolate a repeatable serving toss by tossing to a fixed height and freezing to check placement before ever striking the ball.",
    "steps": [
      "Set your serving stance with the non-hitting foot forward (right-handers: left foot forward), ball resting on the open palm of your non-hitting hand at waist height.",
      "Lift the ball with a straight non-hitting arm and release near forehead height so it peaks roughly two feet above your extended hitting hand, slightly in front of your hitting shoulder.",
      "Do not swing: let the ball drop and catch it, freezing your hitting arm cocked high behind your ear to confirm the toss stayed in your hitting window.",
      "Repeat 10 tosses and mark the floor spot where each untouched ball lands, aiming to land all 10 inside a one-foot circle.",
      "Only once 8 of 10 tosses are consistent, add a slow swing to contact while keeping the same toss."
    ],
    "common_mistakes": [
      "Tossing off a bent, flicking wrist that puts spin on the ball and randomizes its height.",
      "Releasing too far in front of or behind the hitting shoulder, forcing a reach or a jammed swing.",
      "Tossing too high, giving the ball time to drift and rushing the swing."
    ],
    "focus_metrics": [
      "toss_quality",
      "body_alignment"
    ]
  },
  {
    "slug": "serve-wall-contact-snap",
    "name": "Wall Contact Snap",
    "skill": "serve",
    "level": "beginner",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "wall"
    ],
    "summary": "Groove firm, centered hand contact and a fast arm swing by serving into a wall from close range and reading the ball's flight.",
    "steps": [
      "Stand 8 to 10 feet from a solid wall in your serving stance with the ball on your non-hitting hand.",
      "Toss low and controlled, drive your hitting elbow high, and lead the swing with the heel of an open, stiff hand.",
      "For a float, contact the dead center of the ball with a firm wrist so it comes off the wall wobbling with no rotation.",
      "For topspin, snap the wrist and forearm over the top of the ball at contact so it rotates forward and drops.",
      "Do 15 float contacts, then 15 topspin contacts, reading the rebound each rep to confirm the intended flight."
    ],
    "common_mistakes": [
      "Slapping with a loose wrist, adding unwanted spin and dead pace.",
      "Contacting below center, popping the ball upward instead of driving it forward.",
      "Dropping the elbow and pushing the ball rather than swinging through it."
    ],
    "focus_metrics": [
      "arm_swing",
      "contact_point"
    ]
  },
  {
    "slug": "serve-standing-float-zones",
    "name": "Standing Float Zone Serve",
    "skill": "serve",
    "level": "intermediate",
    "duration_min": 20,
    "equipment": [
      "volleyball",
      "net",
      "cones"
    ],
    "summary": "Serve standing float serves over the net into called six-zone targets to link clean contact, a checked follow-through, and square alignment under aim pressure.",
    "steps": [
      "From the endline, set your feet square to the target with hips and shoulders facing your intended zone.",
      "Use a low, consistent toss in front of the hitting shoulder and step through toward the target as you swing.",
      "Contact the center of the ball with a firm hand and stop the hand abruptly at contact, keeping the ball floating with no spin.",
      "Call a zone (1 through 6) out loud before each serve and serve to cones placed in that zone.",
      "Score 1 point for any serve in and 2 for hitting the called zone, playing to 15 to finish the set."
    ],
    "common_mistakes": [
      "Opening the hips toward the sideline, pulling serves off-target.",
      "Following through long and low, adding topspin that kills the float movement.",
      "Inconsistent toss location that forces last-instant swing corrections."
    ],
    "focus_metrics": [
      "contact_point",
      "follow_through",
      "body_alignment"
    ]
  },
  {
    "slug": "serve-jump-float-approach",
    "name": "Jump Float Approach",
    "skill": "serve",
    "level": "advanced",
    "duration_min": 20,
    "equipment": [
      "volleyball",
      "net"
    ],
    "summary": "Build a rhythmic two- to three-step jump float approach that keeps a stable in-front toss and square body line while adding contact height and pace.",
    "steps": [
      "Start 12 to 15 feet behind the endline holding the ball in your non-hitting hand for a one-handed toss.",
      "Toss low and slightly in front on your first step, keeping toss height constant so the approach, not the toss, creates the rhythm.",
      "Attack with a left-right-left approach (right-handers), closing to the ball with shoulders square to the target.",
      "Broad-jump forward rather than straight up and contact a firm-handed float at full extension in front of your hitting shoulder.",
      "Serve 5 reps to each half of the court, keeping every toss inside a one-foot window and landing inbounds."
    ],
    "common_mistakes": [
      "Tossing too high or too far out, breaking approach timing.",
      "Jumping vertically instead of broad-jumping into the ball, losing pace.",
      "Letting the shoulders rotate open in the air, spraying the serve wide."
    ],
    "focus_metrics": [
      "toss_quality",
      "arm_swing",
      "body_alignment"
    ]
  },
  {
    "slug": "serve-jump-topspin-zone-attack",
    "name": "Jump Topspin Zone Attack",
    "skill": "serve",
    "level": "elite",
    "duration_min": 25,
    "equipment": [
      "volleyball",
      "net",
      "cones",
      "radar gun"
    ],
    "summary": "Serve full jump-topspin serves at 80-100% velocity into deep corner zones, snapping over the ball for heavy drop while holding placement and alignment under fatigue.",
    "steps": [
      "From well behind the endline, use a high in-front topspin toss released off the fingertips of the hitting hand for repeatability.",
      "Run a full spike approach (left-right-left for right-handers), loading the backswing into a bow-and-arrow position with the hitting elbow high.",
      "Jump vertically and contact just below and behind center at full reach, snapping the wrist and forearm hard over the top for aggressive topspin.",
      "Finish the swing across the body with a full follow-through and land balanced inside the court.",
      "Serve sets of 10 to alternating deep corners (zones 1 and 5), logging velocity and target percentage and resting between sets so late reps are served fatigued."
    ],
    "common_mistakes": [
      "Contacting too far under the ball, sending it long instead of dropping it in.",
      "Cutting the follow-through short, robbing the serve of topspin and drop.",
      "Letting the toss drift behind the head, forcing an arched back and loss of alignment and power.",
      "Chasing maximum velocity at the cost of zone accuracy."
    ],
    "focus_metrics": [
      "arm_swing",
      "follow_through",
      "contact_point"
    ]
  },
  {
    "slug": "pass-wall-platform-freeze",
    "name": "Wall Pass & Freeze",
    "skill": "pass",
    "level": "beginner",
    "duration_min": 10,
    "equipment": [
      "volleyball",
      "wall"
    ],
    "summary": "Controlled wall passing with a one-second platform freeze after each contact to groove a flat, quiet platform.",
    "steps": [
      "Stand 6-8 ft from a wall in an athletic base: feet wider than shoulders, knees bent, weight on the balls of your feet, one foot slightly forward.",
      "Build your platform before the ball arrives: join the hands (thumbs parallel and pressed together), roll the wrists down, and straighten the elbows so the forearms form one flat board angled up at the wall.",
      "Toss the ball underhand to the wall and pass it back off the mid-forearm, letting the platform angle do the work instead of swinging the arms.",
      "Freeze the platform for a full second after every contact and self-check: forearms flat and level, arms below shoulder height, ball rebounding straight back.",
      "Complete 25 controlled contacts, keeping each rebound below an ~8 ft mark on the wall so you stay soft and low."
    ],
    "common_mistakes": [
      "Swinging the arms up past the shoulders instead of letting the angled platform rebound the ball.",
      "Clasping the hands or straightening the elbows late, so the platform is uneven at contact.",
      "Standing tall with straight legs instead of holding a low, loaded athletic base."
    ],
    "focus_metrics": [
      "platform_angle",
      "body_posture",
      "contact_control"
    ]
  },
  {
    "slug": "pass-partner-target-redirect",
    "name": "Partner Redirect to Target",
    "skill": "pass",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "cones"
    ],
    "summary": "Redirect a partner's toss to an off-set target by angling the platform, training directional passing to the setter.",
    "steps": [
      "Partners stand ~15 ft apart; place a cone or towel off to one side to mark the setter's target at the net.",
      "Partner A tosses a medium arc to Partner B, who must send the pass to the target, not straight back at the tosser.",
      "To change direction, keep your midline behind the ball and angle the platform toward the target by dropping the shoulder nearest the target; let the ball rebound off the tilted platform on the new line instead of swinging your arms at it.",
      "Aim for a high, soft pass that peaks 2-3 ft above your head and drops into the target zone.",
      "Take 10 reps tracking how many land within one step of the target, then switch roles."
    ],
    "common_mistakes": [
      "Passing the ball straight back to the tosser instead of angling the platform to the target.",
      "Driving the ball flat and fast so it overshoots the target instead of lifting a soft, high pass.",
      "Over-tilting or dropping the wrong shoulder, sending the ball off line."
    ],
    "focus_metrics": [
      "angle_to_target",
      "platform_angle",
      "contact_control"
    ]
  },
  {
    "slug": "pass-shuffle-triangle",
    "name": "Shuffle Triangle",
    "skill": "pass",
    "level": "advanced",
    "duration_min": 15,
    "equipment": [
      "volleyball",
      "cones"
    ],
    "summary": "Shuffle to spots around a cone triangle and pass from a planted base, building footwork and balanced contacts to a fixed target.",
    "steps": [
      "Set three cones in a triangle 8-10 ft apart and start at the base cone in a low athletic posture.",
      "A coach or feeder tosses to a different cone each rep; shuffle (never cross your feet) to arrive behind and beneath the ball before it drops.",
      "Beat the ball to the spot, present the platform out early, and contact only from a stopped, balanced base, weight forward, no passing on the move.",
      "Angle the platform back to one fixed target (setter position) on every rep no matter which cone you started from.",
      "Recover to the base cone between reps; complete 12-15 passes with every contact from a planted, balanced stance."
    ],
    "common_mistakes": [
      "Crossing the feet or reaching sideways instead of shuffling to get the midline behind the ball.",
      "Passing while still drifting, which makes the platform swing and the ball sail.",
      "Standing upright between reps and arriving late and high on the ball."
    ],
    "focus_metrics": [
      "footwork_to_ball",
      "body_posture",
      "angle_to_target"
    ]
  },
  {
    "slug": "pass-live-serve-receive-read",
    "name": "Live Serve-Receive Read",
    "skill": "pass",
    "level": "elite",
    "duration_min": 20,
    "equipment": [
      "volleyball",
      "net"
    ],
    "summary": "Read live float and topspin serves, move to the ball, and deliver a high, on-target pass to the setter.",
    "steps": [
      "Set up in your serve-receive zone with a staggered stance, arms loose and apart, eyes on the server's toss and arm swing.",
      "Read contact early: pick up the serve's line and depth off the server's hand, then release and move to get your midline behind the ball.",
      "Present a still, angled platform early and absorb a hard serve by giving slightly at contact, keeping the swing minimal.",
      "Deliver a high pass, peaking around 10-12 ft, to the right-front setter target so it drops two to three feet off the net, never tight to it.",
      "Take 20 live serves mixing float and topspin, calling the serve's depth and direction out loud (for example 'short cross' or 'deep line') before each contact to train the read."
    ],
    "common_mistakes": [
      "Reading late because the eyes drop to the ball instead of tracking the server's toss and arm.",
      "Swinging at a hard serve instead of absorbing it with a quiet, angled platform.",
      "Passing too tight over the net or too flat for the setter to handle."
    ],
    "focus_metrics": [
      "footwork_to_ball",
      "angle_to_target",
      "contact_control"
    ]
  },
  {
    "slug": "pass-hoop-target-streak",
    "name": "Ten in the Hoop",
    "skill": "pass",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "hula hoop"
    ],
    "summary": "Pass feeds into a hoop at the setter's spot, chasing a streak of accurate reps to groove consistent contact and arc.",
    "steps": [
      "Place a hoop (or rope ring) at the setter's target spot; a feeder stands 15-20 ft away and tosses or down-balls to you.",
      "Pass each ball so it lands inside the hoop, contacting the same mid-forearm point every rep.",
      "Control the pace by absorbing harder feeds with a giving platform and lifting softer feeds with a slight leg extension, not an arm swing.",
      "Keep the peak height consistent at 10-12 ft so the tempo to the target repeats rep to rep.",
      "Count consecutive passes that land in the hoop, reset to zero on a miss, and chase a streak of 10."
    ],
    "common_mistakes": [
      "Using the arms to punch the ball instead of legs plus a quiet platform, spraying the pass.",
      "Contacting an inconsistent point (near the wrists one rep, near the elbows the next), causing erratic height.",
      "Letting the arc vary wildly rep to rep so tempo to the setter is never repeatable."
    ],
    "focus_metrics": [
      "contact_control",
      "angle_to_target",
      "platform_angle"
    ]
  },
  {
    "slug": "set-wall-rhythm-sets",
    "name": "Wall Rhythm Sets",
    "skill": "set",
    "level": "beginner",
    "duration_min": 10,
    "equipment": [
      "volleyball",
      "wall"
    ],
    "summary": "Repeated overhead sets against a wall to groove clean hand shape and a quiet, symmetric release.",
    "steps": [
      "Stand about three feet from a wall, feet shoulder-width with the right foot slightly forward and knees soft.",
      "Form a window with your thumbs and index fingers so the ball contacts the pads of all ten fingers above your forehead, thumbs pointing back toward your eyebrows.",
      "Set the ball into a spot on the wall slightly above your head, letting it load into the fingers and then extend fully through wrists, elbows, and knees.",
      "On the first few reps, freeze at contact to confirm the ball sits on the fingerpads and not the palms, then progress to continuous sets.",
      "Build to 25-30 consecutive contacts with no palm slap and no sideways spin."
    ],
    "common_mistakes": [
      "Contacting with the palms so the ball slaps off with heavy spin.",
      "Setting below the forehead so the hands push flat instead of extending up and through.",
      "Locking the wrists, which kills the soft load-and-release and turns the set into a stiff punch."
    ],
    "focus_metrics": [
      "hand_shape",
      "release"
    ]
  },
  {
    "slug": "set-move-square-footwork",
    "name": "Move-and-Square Footwork",
    "skill": "set",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "2 cones",
      "feeder"
    ],
    "summary": "Move-and-square footwork pattern where the setter travels to a spot and plants before every set.",
    "steps": [
      "Place two cones about ten feet apart to mark two release spots near the net.",
      "Start in the middle in a low athletic ready posture with your hands up at forehead height.",
      "On the feed, step toward the cone with the outside foot first, then close with a right-left plant so the right foot lands slightly ahead and you finish squared to the target.",
      "Set the ball only after your feet are set and your hips face the target, then shuffle back through the middle to the opposite cone for the next rep.",
      "Alternate cones for 20 reps, prioritizing beating the ball to the spot over rushing your hands."
    ],
    "common_mistakes": [
      "Arriving late and setting on the move, so your base drifts and the set sails long.",
      "Planting with the wrong foot forward instead of finishing right-left with the right foot slightly ahead.",
      "Standing tall between reps instead of staying in a loaded athletic base."
    ],
    "focus_metrics": [
      "footwork",
      "body_alignment"
    ]
  },
  {
    "slug": "set-back-set-symmetry",
    "name": "Back-Set Symmetry",
    "skill": "set",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "feeder"
    ],
    "summary": "Alternating front and back sets from the same neutral posture so blockers can't read direction off the body.",
    "steps": [
      "Set up facing a front-set target with a partner positioned behind you as the back-set target.",
      "Receive every feed with identical hand shape and contact point over the forehead, hips square and shoulders level.",
      "For the front set, extend up and through toward the target; for the back set, keep the same contact point over the forehead, press your hips forward under the ball, arch the upper back, and extend up and back without leaning back early.",
      "Have the feeder call 'front' or 'back' just before contact so your setup stays neutral until release.",
      "Complete 10 front and 10 back sets, checking that your pre-contact posture looks the same on both."
    ],
    "common_mistakes": [
      "Leaning or arching before contact, which telegraphs the back set.",
      "Letting the contact point drift behind the head on back sets and losing accuracy.",
      "Uneven shoulders that push the front set off its intended line."
    ],
    "focus_metrics": [
      "body_alignment",
      "hand_shape",
      "release"
    ]
  },
  {
    "slug": "set-jump-set-quick-release",
    "name": "Jump-Set Quick Release",
    "skill": "set",
    "level": "advanced",
    "duration_min": 15,
    "equipment": [
      "volleyball",
      "net",
      "feeder"
    ],
    "summary": "Jump sets delivered at the top of the jump to sharpen a fast, compact release under a quicker tempo.",
    "steps": [
      "Start two steps off the net, take a controlled two-foot gather, and jump straight up without drifting into the net.",
      "Meet the ball at the peak with your hands already at the forehead, contacting early so the ball leaves before you descend.",
      "Keep the release compact: no cocking the hands back, quick finger extension, and a firm, quiet follow-through toward the antenna.",
      "Deliver a front set to the pin, land balanced, and reset, then repeat to the same spot for consistency.",
      "Run 15 clean reps, then add a random front/back call at the gather to train decision speed."
    ],
    "common_mistakes": [
      "Contacting on the way down, which flattens the set and slows the tempo.",
      "Drifting forward into the net on the jump.",
      "Using a big windup that telegraphs the set and delays the release."
    ],
    "focus_metrics": [
      "release",
      "tempo_decision",
      "body_alignment"
    ]
  },
  {
    "slug": "set-read-block-tempo-call",
    "name": "Read-the-Block Tempo Call",
    "skill": "set",
    "level": "elite",
    "duration_min": 18,
    "equipment": [
      "volleyball",
      "net",
      "feeder",
      "hitters",
      "blocker"
    ],
    "summary": "Live-read reps where the setter chooses set location and tempo based on the block's movement before contact.",
    "steps": [
      "Position hitters at multiple tempo options (quick in the middle, gap, and pin) and station a blocker or a coach flashing block-position cards.",
      "Take an imperfect feed off the net so you must adjust your footwork and still square up under pressure.",
      "Read the middle blocker during your approach: if they commit, deliver to a pin away from them; if they hesitate, feed the quick.",
      "Call and deliver the set in rhythm, matching tempo to the hitter's approach and the open seam in the block.",
      "Score each rep on correct decision plus accurate delivery, run 20 reps, and track your decision accuracy."
    ],
    "common_mistakes": [
      "Locking into a predetermined set instead of reading the block.",
      "Making the correct read but delivering it late or inaccurately so the hitter can't use it.",
      "Breaking clean footwork under off-net pressure and setting flat-footed."
    ],
    "focus_metrics": [
      "tempo_decision",
      "footwork"
    ]
  },
  {
    "slug": "attack-approach-shadow-3step",
    "name": "Shadow 3-Step Approach",
    "skill": "attack",
    "level": "beginner",
    "duration_min": 15,
    "equipment": [],
    "summary": "A ball-free footwork drill that grooves the left-right-left (right-left-right for lefties) plant-and-load rhythm of a 3-step attack approach.",
    "steps": [
      "Set up a step behind the 10-foot line in a low athletic stance, weight on the balls of both feet, ready to lead with your left foot (mirror for lefties).",
      "Take a small, quick directional step onto the left foot to aim your approach, then drive a long, low, accelerating step onto the right foot, planting it heel-first to brake your forward momentum.",
      "Snap the left foot down beside the right to finish the quick 'right-left' plant, braking heel-to-toe so momentum redirects straight up while your hips stay open to the court.",
      "As the feet plant, swing both arms back behind your hips to load, then throw them up as you leave the ground: non-hitting arm reaching to the ball, hitting arm loading into the bow-and-arrow.",
      "Freeze at the top of the imaginary jump and check that your chest is up, hips square to the target, and hitting arm loaded high, then reset and repeat."
    ],
    "common_mistakes": [
      "Reversing the step pattern: a right-handed hitter should go left-right-left and finish with a right-left plant, so leading with the right foot flips the footwork and kills the load.",
      "Floating or coasting through the last two steps instead of accelerating into a quick, heel-first plant, which kills upward drive.",
      "Leaving the arms in front instead of swinging them back behind the hips to load before the plant."
    ],
    "focus_metrics": [
      "approach_footwork",
      "jump_timing"
    ]
  },
  {
    "slug": "attack-self-toss-line-swing",
    "name": "Self-Toss Line Swing",
    "skill": "attack",
    "level": "beginner",
    "duration_min": 20,
    "equipment": [
      "volleyball",
      "wall"
    ],
    "summary": "A controlled self-toss hitting drill that builds a clean high-elbow arm swing and full contact extension against a wall.",
    "steps": [
      "Stand 8-10 feet from a wall with a ball in your non-hitting hand.",
      "Toss the ball 2-3 feet above and slightly in front of your hitting shoulder.",
      "Draw the hitting elbow high and back into a bow-and-arrow load while the non-hitting arm points up at the ball.",
      "Snap the swing with a high, straight-armed contact above and just in front of your hitting shoulder, wrapping the wrist over the top of the ball to drive topspin into the wall.",
      "Catch the rebound and repeat, keeping the contact point consistently above and in front of the hitting shoulder."
    ],
    "common_mistakes": [
      "Contacting the ball behind the head, which forces the ball up and long and removes any downward angle.",
      "Leading with a low or 'chicken-wing' elbow instead of a high elbow load.",
      "Pushing the ball with a stiff wrist instead of snapping over the top for topspin."
    ],
    "focus_metrics": [
      "arm_swing",
      "contact_height"
    ]
  },
  {
    "slug": "attack-tossed-approach-timing",
    "name": "Tossed-Ball Approach & Hit",
    "skill": "attack",
    "level": "intermediate",
    "duration_min": 25,
    "equipment": [
      "volleyball",
      "net",
      "partner"
    ],
    "summary": "A full-approach hitting drill off a partner's toss that syncs the footwork start with the ball's peak to nail jump timing and contact height.",
    "steps": [
      "Wait behind the 10-foot line while a partner stands near the setter position (zone 2-3) with a ball.",
      "Read the toss and trigger your first step as the ball reaches the top of its arc, so your approach and the ball's descent line up.",
      "Drive through the left-right-left approach so your right-left plant lands just as the ball begins its descent, converting horizontal speed into vertical lift.",
      "Load the hitting arm back during the jump and reach to full extension, contacting the ball at the top of your reach and in front of your hitting shoulder.",
      "Swing hard with a wrist snap over the top, then land balanced on two feet inside the court.",
      "Reset and repeat, adjusting your start timing until you consistently contact at peak height."
    ],
    "common_mistakes": [
      "Starting the approach too early and drifting under the ball, forcing a low contact.",
      "Jumping straight up before the ball descends and hitting it on the way down.",
      "Broad-jumping forward into the net instead of jumping up and landing near the takeoff spot."
    ],
    "focus_metrics": [
      "jump_timing",
      "approach_footwork",
      "contact_height"
    ]
  },
  {
    "slug": "attack-high-set-line-cross",
    "name": "Live High-Set Line & Cross Reps",
    "skill": "attack",
    "level": "advanced",
    "duration_min": 30,
    "equipment": [
      "volleyball",
      "net",
      "setter",
      "shag cart"
    ],
    "summary": "Full-speed live sets from a setter where the hitter alternates line and cross-court swings to develop powerful, directional finishes.",
    "steps": [
      "Take a full approach on a live set to the outside (pin) from a setter running normal tempo.",
      "Time the approach so you contact at maximum reach as the set drops into the antenna window.",
      "On 'line' reps, keep the hitting shoulder square and contact slightly on the inside of the ball to drive it down the sideline.",
      "On 'cross' reps, open the hips and hitting shoulder and pull across the outside of the ball to angle it sharply into the court.",
      "Finish every swing with a full follow-through across the body and land balanced, then rotate out and repeat.",
      "Alternate line and cross calls each rep so shot selection stays reactive."
    ],
    "common_mistakes": [
      "Telegraphing the shot by changing approach angle instead of disguising it until contact.",
      "Decelerating the arm on cross-court to steer the ball rather than swinging full speed.",
      "Dropping the elbow on line shots and burying the ball into the net."
    ],
    "focus_metrics": [
      "arm_swing",
      "power_followthrough",
      "contact_height"
    ]
  },
  {
    "slug": "attack-transition-bounce-finish",
    "name": "Transition Bounce Finisher",
    "skill": "attack",
    "level": "elite",
    "duration_min": 30,
    "equipment": [
      "volleyball",
      "net",
      "setter",
      "target mat"
    ],
    "summary": "A high-rep transition drill from a defensive touch to a full-speed swing that trains explosive load and maximal downward power on the finish.",
    "steps": [
      "Start in base defense, execute a controlled dig or block-cover touch, then immediately retreat off the net past the 10-foot line.",
      "Explode into a full transition approach as the setter delivers a live set, closing the last two steps hard to load for an explosive jump and swing.",
      "Reach peak contact height with a full bow-and-arrow load, hips and core coiled behind the swing.",
      "Attack the top of the ball with a violent wrist snap, aiming to bounce it off a target mat deep in the court.",
      "Drive the follow-through fully through the ball and down across the opposite hip, using core flexion to add downward force.",
      "Land balanced, sprint back to base, and repeat for continuous transition reps."
    ],
    "common_mistakes": [
      "Rushing the transition footwork and arriving without a loaded final plant, sapping power.",
      "Arm-only swinging without engaging the core snap, so the ball carries long instead of bouncing.",
      "Contacting slightly behind the ball, which lifts the finish instead of driving it down.",
      "Failing to fully retreat off the net, leaving no room for an explosive approach."
    ],
    "focus_metrics": [
      "power_followthrough",
      "jump_timing",
      "approach_footwork"
    ]
  },
  {
    "slug": "block-wall-press-holds",
    "name": "Wall Press & Hold",
    "skill": "block",
    "level": "beginner",
    "duration_min": 10,
    "equipment": [],
    "summary": "A stationary wall drill that grooves the overhead press and a firm, sealed hand shape without a net or partner.",
    "steps": [
      "Stand an arm's length from a flat wall, feet shoulder-width, hips loaded in a quarter-squat, and hands up near your eyes in 'ready hands.'",
      "Jump straight up without swinging your arms down; keep the pre-loaded hands high the whole way up.",
      "At the peak, press both palms flat and high against the wall: shrug your shoulders to your ears and flex your wrists so the fingers point up and the heels of the palms drive into the wall, mimicking the reach over the net.",
      "Spread your fingers wide and stiff, thumbs up and in, hands closer together than the width of a ball so nothing can split the seam.",
      "Freeze the pressed shape for a beat, then land softly on the balls of both feet with knees bent."
    ],
    "common_mistakes": [
      "Reaching straight up instead of pressing over and forward, so there is no penetration.",
      "Swinging the arms down to generate the jump instead of keeping the hands pre-loaded high.",
      "Loose wrists or fingers held together so the shape is soft and porous.",
      "Landing stiff-legged instead of absorbing with the knees."
    ],
    "focus_metrics": [
      "hand_penetration",
      "body_position"
    ]
  },
  {
    "slug": "block-shuffle-seal",
    "name": "Three-Step Shuffle to Seal",
    "skill": "block",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "net",
      "cones"
    ],
    "summary": "A moving drill that trains a balanced lateral slide to the pin followed by a square, vertical, sealing block jump.",
    "steps": [
      "Start at the middle of the net in block-ready: hands up, weight on the balls of your feet, shoulders square to the tape.",
      "Travel toward a cone at the pin using a shuffle for a short gap or a crossover (drop-step, cross, plant) for the full slide, never crossing your feet on the final step.",
      "Decelerate and square your hips and shoulders back to the net so the last step plants both feet under your body.",
      "Jump straight up with no sideways drift and press over the tape, turning your outside hand in to seal the line.",
      "Land balanced on both feet in the same spot you took off from and immediately reset your hands to ready."
    ],
    "common_mistakes": [
      "Drifting sideways in the air instead of jumping vertically after the slide.",
      "Arriving with shoulders open to the net so the block deflects the ball out of bounds.",
      "Crossing the feet on the last step and leaving the ground off-balance.",
      "Failing to reset the hands and eyes after landing."
    ],
    "focus_metrics": [
      "lateral_footwork",
      "body_position",
      "landing_recovery"
    ]
  },
  {
    "slug": "block-mirror-read",
    "name": "Mirror the Hitter",
    "skill": "block",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "net",
      "volleyball"
    ],
    "summary": "A no-jump-to-jump reading drill where the blocker keys the hitter's arm instead of the set to time the block.",
    "steps": [
      "Set up across the net from a partner who acts as the hitter holding a ball.",
      "Track the play with your eyes in sequence: ball to the setter, then snap your focus to the hitter's approach and hitting arm.",
      "Load your legs as the hitter plants the last step of the approach; do not jump on the set, jump on the arm.",
      "Time takeoff so your hands reach full penetration just as the hitter's hand would contact the ball (together on a fast set, a beat later on a high set).",
      "Match your hands to the hitter's arm-and-shoulder line to take away their strongest angle, then reset."
    ],
    "common_mistakes": [
      "Jumping with the set and already descending as the ball is contacted.",
      "Ball-watching the whole rally and losing sight of the hitter.",
      "Committing the feet before reading the attack tempo."
    ],
    "focus_metrics": [
      "read_timing",
      "body_position"
    ]
  },
  {
    "slug": "block-read-close-live",
    "name": "Read & Close vs. Live Hitter",
    "skill": "block",
    "level": "advanced",
    "duration_min": 15,
    "equipment": [
      "net",
      "volleyballs",
      "hitting box"
    ],
    "summary": "A live-hitter rep that pairs reading the attack with an aggressive over-the-net press and a clean transition off the block.",
    "steps": [
      "Begin as the pin blocker in ready position while a setter delivers live sets to a hitter attacking off a box or a full approach.",
      "Read the setter's hands and ball path, then transfer your eyes to the hitter and delay until the approach commits.",
      "Press aggressively over the tape onto the hitter's side, hands over-and-in to channel the ball down into the court rather than off your hands out of bounds.",
      "Absorb contact with firm wrists and a stable, shrugged shoulder line so the ball rebounds straight down.",
      "Land in balance without contacting the net, then peel off two feet into transition with your eyes back to the ball."
    ],
    "common_mistakes": [
      "Reaching up and back so blocked balls deflect out of bounds instead of penetrating down.",
      "Soft wrists at contact that let the hitter tool the ball high off the hands.",
      "Drifting forward and touching the net or landing across the centerline into the opponent's court, a net or centerline fault.",
      "Freezing after the block instead of releasing into transition."
    ],
    "focus_metrics": [
      "read_timing",
      "hand_penetration",
      "landing_recovery"
    ]
  },
  {
    "slug": "block-double-seam-close",
    "name": "Double-Block Seam Close",
    "skill": "block",
    "level": "elite",
    "duration_min": 15,
    "equipment": [
      "net",
      "volleyballs"
    ],
    "summary": "A two-blocker drill that closes the middle-to-pin double and eliminates the seam between four penetrating hands.",
    "steps": [
      "The pin blocker sets the outside edge and takes away the line as the anchor; the middle blocker starts in the middle and reads the set direction.",
      "The middle closes to the pin with an efficient crossover, arriving with shoulders square and feet planted under the hips while the pin blocker holds position and does not chase.",
      "Both blockers time takeoff off the hitter's arm and press over the net together with firm wrists and shrugged shoulders.",
      "Close the seam by bringing the pin blocker's inside hand and the middle blocker's near hand together. Angle all four hands down so the ball rebounds into the middle of the court.",
      "Both land square without collision, peel off the net, and transition to defense."
    ],
    "common_mistakes": [
      "Leaving a seam between the two blockers for the hitter to score through.",
      "The middle arriving late or still moving sideways at takeoff, creating a drifting block.",
      "The two blockers jumping at different times so the wall is uneven and porous.",
      "The pin blocker chasing inside and opening up the line."
    ],
    "focus_metrics": [
      "lateral_footwork",
      "hand_penetration",
      "body_position"
    ]
  },
  {
    "slug": "dig-wall-platform-reps",
    "name": "Wall Platform Reps",
    "skill": "dig",
    "level": "beginner",
    "duration_min": 10,
    "equipment": [
      "volleyball",
      "wall"
    ],
    "summary": "Repeatedly dig a ball into a wall from a low, balanced stance to groove a stable, flat passing platform.",
    "steps": [
      "Set your feet slightly wider than shoulder-width, sink into a low athletic stance with your knees bent and your chest over your knees, and keep your weight forward on the balls of your feet with light heels.",
      "Stand a few feet from a wall and toss the ball underhand into the wall at knee-to-waist height.",
      "Join your hands into one flat platform (thumbs down and pressed together, elbows locked) and let the ball rebound off your forearms without swinging your arms.",
      "Angle your shoulders and platform so the ball returns to the same spot on the wall each time; keep your head still and eyes on the contact point.",
      "String together 20-30 unbroken reps, resetting your stance after any miss."
    ],
    "common_mistakes": [
      "Swinging or 'punching' at the ball instead of letting a firm platform rebound it.",
      "Standing too tall so contact happens up around the chest instead of in front of the waist.",
      "Breaking the wrists or clasping the hands late so the platform is not flat and level."
    ],
    "focus_metrics": [
      "ready_position",
      "platform_control"
    ]
  },
  {
    "slug": "dig-shuffle-triangle",
    "name": "Shuffle Triangle Digs",
    "skill": "dig",
    "level": "intermediate",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "cones"
    ],
    "summary": "Shuffle between three cones and dig a partner's tosses without crossing your feet, staying stopped and square on every contact.",
    "steps": [
      "Place three cones in a shallow triangle about three to four feet apart in the back row and start in a low ready stance at the center cone facing a partner tosser.",
      "On each toss, shuffle (never cross-step) to the cone nearest the ball and stop your feet completely before you contact.",
      "Set a flat platform angled back toward your partner and dig with a still upper body, moving your body behind the ball rather than reaching.",
      "After each dig, shuffle back to the center cone and re-load your stance.",
      "Have your partner mix left, right, and short tosses; complete 8-10 controlled digs to each direction."
    ],
    "common_mistakes": [
      "Cross-stepping instead of shuffling, which leaves you arriving off-balance and turned.",
      "Contacting the ball while still drifting instead of stopping the feet first.",
      "Swinging the platform to 'reach' a ball rather than getting the body behind it."
    ],
    "focus_metrics": [
      "movement_pursuit",
      "platform_control"
    ]
  },
  {
    "slug": "dig-read-the-arm",
    "name": "Read-the-Arm Reaction Digs",
    "skill": "dig",
    "level": "advanced",
    "duration_min": 12,
    "equipment": [
      "volleyball"
    ],
    "summary": "Key on a live hitter's approach and hitting arm to break toward the ball only after reading the shot, holding a low load until contact.",
    "steps": [
      "Set up in defensive base position behind the block while a partner attacks from a box on the other side of the net.",
      "Track the hitter's approach and shoulders, then land a stopped, low split-step just as their arm reaches the top of the swing so you are still and loaded at contact.",
      "Read the hitting arm and hand angle to predict line versus angle versus tip before the ball is struck.",
      "React off that read, move to the predicted spot, and dig on a firm platform, angling the ball high toward the middle-front setter target.",
      "Recover to base and repeat as the hitter randomly mixes line, angle, and tip."
    ],
    "common_mistakes": [
      "Leaning or committing early before contact instead of holding the loaded split-step.",
      "Ball-watching only and ignoring the cues in the hitter's arm and shoulders.",
      "Being caught with the feet still moving at the moment the hitter contacts the ball."
    ],
    "focus_metrics": [
      "read_anticipation",
      "ready_position"
    ]
  },
  {
    "slug": "dig-pursuit-roll-recovery",
    "name": "Pursuit-and-Roll Recovery",
    "skill": "dig",
    "level": "advanced",
    "duration_min": 12,
    "equipment": [
      "volleyball",
      "knee pads"
    ],
    "summary": "Sprint to a ball tossed into open space, keep it alive with an extension or roll, then pop straight back to a balanced ready stance.",
    "steps": [
      "Start in a low ready stance while a partner tosses balls short and wide into open space to either side.",
      "Explode out of your stance and run through the ball, taking a big, low last step to get your hips down behind it.",
      "Play the ball up toward the middle-front of the court with an extended platform, dropping into a controlled shoulder roll on the balls you cannot reach on your feet.",
      "Push off the floor immediately and recover to a balanced ready position facing the net.",
      "Alternate sides and alternate extension digs with rolls for the full set."
    ],
    "common_mistakes": [
      "Reaching with the arms before the feet arrive, so the platform is low and the ball drops short.",
      "Landing flat and hard instead of rolling through the hip and shoulder to protect the body.",
      "Staying down on the floor to admire the dig instead of recovering quickly to base."
    ],
    "focus_metrics": [
      "movement_pursuit",
      "recovery"
    ]
  },
  {
    "slug": "dig-live-random-defense",
    "name": "Live Random Defense Rotation",
    "skill": "dig",
    "level": "elite",
    "duration_min": 15,
    "equipment": [
      "volleyball"
    ],
    "summary": "Defend a continuous, unpredictable mix of hard swings, tips, and off-speed shots, reading each attack and recovering to base between every contact.",
    "steps": [
      "Defend from a single base position while a coach or partner delivers a random, unscripted sequence of hard-driven swings, tips, and roll shots.",
      "Split-step and land loaded just before the attacker contacts the ball, keying on the attacker's arm to read shot type and direction.",
      "Select the right tool for each ball: a stationary dig, a pursuit run-through, an extension, or a roll.",
      "Direct every dig high and toward the middle-front target (the setter zone), not flat or backward.",
      "Recover to a balanced base immediately after each contact with no reset pause, defending 10-15 continuous balls."
    ],
    "common_mistakes": [
      "Anticipating one shot and getting frozen or wrong-footed when the off-speed ball comes.",
      "Digging the ball flat or behind you instead of high toward the setter target.",
      "Failing to fully recover to base between reps and arriving late on the next attack.",
      "Over-running tips by standing tall instead of staying low and forward-weighted."
    ],
    "focus_metrics": [
      "read_anticipation",
      "movement_pursuit",
      "recovery"
    ]
  }
];

export function drillsForSkill(skill: Skill): Drill[] {
  return DRILLS.filter((d) => d.skill === skill);
}

export function drillBySlug(slug: string): Drill | undefined {
  return DRILLS.find((d) => d.slug === slug);
}

export function drillSlugs(skill: Skill): string[] {
  return drillsForSkill(skill).map((d) => d.slug);
}
