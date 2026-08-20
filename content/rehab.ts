// The volleyball injury library. AUTHORED SOURCE OF TRUTH.
//
// `scripts/seed-rehab.mjs` reconciles this into the `rehab_entries` table
// (migration 039), which is what the app reads. Git holds the authoring and
// the review history; the table is the queryable projection. Edit here, then
// run the seed, or the two drift.
//
// This is EDUCATION, not treatment. `phases` describe what a recovery
// typically looks like so a player can tell where they are and have a better
// conversation with a clinician. `prevention` is the one section that
// prescribes, because prehab is ordinary training. No drug, dose or
// supplement appears anywhere, and every entry carries at least two red
// flags, which migration 039 enforces as a check constraint rather than
// leaving to review.
//
// Drafted by eight domain passes (one per body region) and then run through a
// clinical safety review that raised two blocking problems, both fixed here:
// one-sided extension back pain was filed self-manage when it is also the
// presentation of a pars stress reaction, and its copy asserted "nothing is
// torn or broken", which is a negative diagnosis this product cannot make and
// which talks a growing player out of getting imaged.
import type { RehabEntry } from "./rehab-types";

export const REHAB: RehabEntry[] = [
  {
    "slug": "ac-joint-sprain",
    "name": "AC joint sprain (shoulder separation)",
    "also_called": [
      "shoulder separation",
      "AC separation",
      "separated shoulder",
      "AC joint injury"
    ],
    "region": "shoulder",
    "triage": "get_assessed",
    "summary": "A sprain of the small joint where the collarbone meets the shoulder blade, usually from landing on the point of the shoulder.",
    "what_it_is": "The collarbone meets the shoulder blade at a small joint on the top of the shoulder, the acromioclavicular or AC joint, held together by a capsule and two sets of ligaments. A sprain stretches or tears those ligaments. Mild ones are painful but the joint stays lined up. More severe ones let the collarbone ride up, which is the visible bump people call a separated shoulder. This is a different injury from a dislocated shoulder, which is the ball leaving the socket.",
    "how_it_happens": "Almost always a direct landing on the point of the shoulder. Indoors that is a dive where the shoulder hits the floor before the chest, a collision with a teammate chasing the same ball in the seam, or an awkward landing off a block under the net. Sand is kinder, but beach players still get it by committing to a full extension dig and driving the shoulder into the sand at a bad angle. There is also a slower version in players who press a lot, where the joint surfaces themselves get irritated by repeated compression at the top of the block and in the weight room.",
    "signs": [
      "Pain you can cover with one fingertip, right on top of the shoulder where the collarbone ends",
      "A step or bump on the top of the shoulder compared with the other side",
      "Reaching across your body towards the opposite shoulder hurts sharply",
      "Pain lying on that side, and pain at the top of the block press or at overhead contact",
      "It hurts when someone presses directly on the joint and not when they press anywhere else",
      "Bruising and swelling over the top of the shoulder in the first few days"
    ],
    "red_flags": [
      "An obvious deformity with the collarbone tenting or threatening the skin, or an arm that hangs and cannot be lifted. That is a high grade separation or a fracture.",
      "Numbness, pins and needles, coldness, or a weak pulse in the arm, which means nerves or blood vessels may be involved.",
      "Point tenderness along the shaft of the collarbone or in the neck rather than on the joint itself, which suggests a broken bone.",
      "Broken skin over the joint, or fever and spreading redness in the days afterwards.",
      "Chest pain or difficulty breathing after the same fall, which needs assessment for a rib or lung injury."
    ],
    "phases": [
      {
        "name": "Acute settling",
        "goal": "Protect the joint and control swelling while the ligaments start healing, keeping the elbow, wrist and the rest of the body training",
        "typical_window": "3 days to 3 weeks depending on how severe the sprain is",
        "markers": [
          "Resting pain fading",
          "The arm can be raised in front of you without severe pain",
          "Swelling and bruising settling",
          "Sleeping is comfortable on the back or the other side"
        ]
      },
      {
        "name": "Range and strength",
        "goal": "Get the arm overhead again and rebuild the blade and cuff muscles that pain shut down",
        "typical_window": "2 to 8 weeks",
        "markers": [
          "Full overhead reach without a catch of pain",
          "Cross body reach comfortable",
          "Pressing and pulling loaded without pain at the joint",
          "Any residual bump is stable and no longer sore to touch"
        ]
      },
      {
        "name": "Back to contact and overhead",
        "goal": "Reintroduce blocking, then hitting, and last of all diving onto that shoulder",
        "typical_window": "2 to 10 weeks, and considerably longer for high grade injuries",
        "markers": [
          "Blocking press with no pain at the top of the reach",
          "Full swings tolerated",
          "Confident to dive and land on that side in practice",
          "No pain the day after a full session"
        ]
      }
    ],
    "prevention": [
      "Drill diving and the shoulder roll properly, starting on mats. Most AC injuries are a landing skill problem, and landing chest first with the arms extended keeps the point of the shoulder off the floor.",
      "Build the upper back and blade with rows, face pulls and prone Y raises so the shoulder is not sitting forward and exposed when you land.",
      "Call the ball loudly. Teammate collisions in the seam account for a real share of these.",
      "Balance heavy horizontal pressing with pulling, and change grip width or bar path if the top of the shoulder aches after benching, since repeated compression irritates this joint over time.",
      "Land block jumps under your own body with control rather than drifting into the net or into a teammate."
    ],
    "return_markers": [
      "Full overhead range and full cross body reach without pain",
      "Pain free pressing and blocking at the top of the reach",
      "Willing and able to land on that shoulder in a controlled dive",
      "Pressing and pulling strength matched side to side",
      "Any remaining bump is painless and stable, which is common and does not by itself mean you are not ready"
    ],
    "loads": [
      "block",
      "dig",
      "pass",
      "attack"
    ]
  },
  {
    "slug": "glenohumeral-internal-rotation-deficit",
    "name": "Glenohumeral internal rotation deficit (GIRD)",
    "also_called": [
      "GIRD",
      "tight hitting shoulder",
      "loss of internal rotation"
    ],
    "region": "shoulder",
    "triage": "self_manage",
    "summary": "The hitting shoulder slowly loses inward rotation compared with the other side, which crowds the joint at the top of the swing.",
    "what_it_is": "Measured lying on your back with the elbow bent to a right angle and the upper arm out to the side, the hitting shoulder rotates inwards less far than the other one. Part of that is bone: in players who started overhead sport young, the upper arm bone itself twists slightly as it grows, trading inward rotation for outward rotation, which is an adaptation rather than a fault. The rest is soft tissue, a thickened capsule at the back of the joint and a stiff, overworked posterior cuff. The soft tissue part is the part that can change and the part that matters.",
    "how_it_happens": "Every swing finishes with the back of the shoulder braking a very fast moving arm. Those tissues respond to repeated eccentric load by getting stiffer, and in season the arm never gets a long enough break for that to reverse, so the deficit builds across a season and jumps after tournament weekends. It matters because losing inward rotation changes where the ball sits in the socket at the top of the swing, crowding the cuff and the labrum against the back rim. GIRD is not an injury by itself. It is a measurable risk state sitting underneath internal impingement, labral tears and cuff problems in hitters.",
    "signs": [
      "Lying on your back with the elbow bent, the hitting arm rotates noticeably less far towards the floor than the other arm",
      "You cannot reach as far up your back with the hitting hand as with the other hand",
      "The shoulder feels blocked or tight through the follow through rather than painful",
      "Tightness that is worse in season and much worse in the days after a tournament",
      "The back of the shoulder feels permanently tight and tender to press",
      "Often no pain at all, which is why this is usually found by measuring rather than by symptoms"
    ],
    "red_flags": [
      "Loss of rotation together with pain, catching, or a sense of the joint slipping, which suggests a labral problem rather than simple stiffness.",
      "Stiffness developing in every direction over weeks, including outward rotation and lifting the arm. That pattern fits a frozen shoulder or joint disease and stretching is not the answer.",
      "Stiffness alongside a visible hollow in the muscle behind the shoulder blade, or with clear weakness, which points at a nerve problem.",
      "A sudden loss of range after one specific incident rather than a gradual drift."
    ],
    "phases": [
      {
        "name": "Getting the range back",
        "goal": "Restore the soft tissue portion of the deficit with regular posterior shoulder work, accepting that the bony portion will not change and does not need to",
        "typical_window": "2 to 8 weeks",
        "markers": [
          "The gap between sides shrinking on a repeated measurement",
          "Total rotation arc, inward plus outward, closer to matched between shoulders",
          "Follow through feels less blocked",
          "Back of the shoulder less tender to press"
        ]
      },
      {
        "name": "Holding it through a season",
        "goal": "Maintain the range against the daily stiffening effect of hitting, which means measuring it rather than assuming it",
        "typical_window": "Ongoing, rechecked every few weeks in season",
        "markers": [
          "Range holds steady after heavy hitting weeks",
          "No creeping back of shoulder pain during full effort swings",
          "Stretching feels like maintenance rather than chasing lost ground"
        ]
      }
    ],
    "prevention": [
      "Cross body stretch with the shoulder blade held down, plus the sleeper stretch, done after hitting while the tissue is warm rather than cold before play.",
      "Get measured. Lying on your back with the elbow at a right angle, compare how far each arm rotates. A gap of more than roughly 15 to 20 degrees, or a total arc clearly smaller on the hitting side, is the number people act on.",
      "Strengthen the posterior cuff with side lying external rotation and prone horizontal abduction so it decelerates the arm without living in a permanent state of guard.",
      "Soft tissue work on the back of the shoulder, such as a ball against a wall on the posterior cuff, before stretching it.",
      "Ramp hitting volume gradually. Range drops fastest in the weeks where volume jumps hardest."
    ],
    "return_markers": [
      "Internal rotation gap between sides down to a level that stays stable week to week",
      "Total rotation arc close to matched between the two shoulders",
      "Full follow through with no blocked or pinching sensation",
      "No back of shoulder pain during full effort hitting"
    ],
    "loads": [
      "serve",
      "attack",
      "block"
    ]
  },
  {
    "slug": "internal-impingement",
    "name": "Internal impingement (posterosuperior impingement)",
    "also_called": [
      "internal impingement",
      "posterior shoulder pain in hitters",
      "cocking phase pain",
      "posterosuperior glenoid impingement"
    ],
    "region": "shoulder",
    "triage": "get_assessed",
    "summary": "A deep pinch at the back of the shoulder in the arm back cocking position, where the cuff meets the rim of the socket.",
    "what_it_is": "With the arm up and rotated fully back, the underside of the rotator cuff makes contact with the back and top rim of the socket and the labrum sitting on it. That contact happens in everyone and is normal. It becomes a problem when it happens too often, too hard, or with the ball sitting slightly out of position in the socket, and the underside of the cuff and the labrum start to fray. This is the most common source of back of shoulder pain in volleyball hitters.",
    "how_it_happens": "The cocking phase of the spike approach puts the shoulder in maximal external rotation with the arm abducted, and the jump serve does the same with an even longer arm path. In that exact position the cuff is trapped between the ball and the back rim. Two things make it worse: a tight posterior shoulder that shifts the ball backwards and upwards in the socket, and a shoulder blade that stops tilting back properly once it fatigues late in a session. Hitters who drive the elbow behind the line of the body, often to get around a low or tight set, spend more time in the worst position and collect this faster.",
    "signs": [
      "A sharp, deep pinch at the back of the shoulder exactly when the arm is furthest back",
      "It only hurts at high effort. Warm up swings and passing are fine, full swings and jump serves are not",
      "Nothing in the gym reproduces it. Pressing, rowing and daily life feel normal",
      "The arm feels heavy or dead late in a long session and the swing shortens",
      "Tender when you press deep into the back of the shoulder joint line",
      "Usually paired with an obvious loss of inward rotation on the hitting side"
    ],
    "red_flags": [
      "A feeling that the shoulder slips, shifts, or nearly comes out in the cocking position. That is instability and it changes the whole picture.",
      "Catching, locking, or a clunk that stops the arm mid movement.",
      "A dead, numb, or tingling arm that persists after you stop playing instead of clearing within minutes.",
      "Sudden weakness lifting the arm or rotating it outwards after one specific swing."
    ],
    "phases": [
      {
        "name": "Unloading the cocking position",
        "goal": "Keep the shoulder out of end range hitting long enough for the irritated tissue to settle, while the rest of training continues",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "No pain at the top of the reach in everyday movement",
          "Standing float serve or controlled tosses without symptoms",
          "Back of the shoulder no longer tender to press",
          "Able to reach overhead and rotate through range without the pinch"
        ]
      },
      {
        "name": "Fixing what put you there",
        "goal": "Regain internal rotation, posterior cuff strength, mid back mobility and blade control, because this is a mechanical setup problem more than a tissue problem",
        "typical_window": "4 to 10 weeks",
        "markers": [
          "The internal rotation gap between sides is shrinking on repeat measurement",
          "The blade holds position while slowly lowering the arm from overhead",
          "Overhead loading tolerated without provoking the pinch",
          "Can reach the cocking position slowly with no symptoms"
        ]
      },
      {
        "name": "Rebuilding the swing",
        "goal": "Return to end range at speed, often with a slightly changed arm path, with a coach watching the reach back",
        "typical_window": "4 to 10 weeks",
        "markers": [
          "Full speed swings on a good set without the pinch",
          "No return of symptoms across consecutive hitting days",
          "Jump serve tolerated at full effort",
          "Late session swings still look like early session swings on video"
        ]
      }
    ],
    "prevention": [
      "Cross body stretch and sleeper stretch daily on the hitting side. Loss of internal rotation is the single most changeable thing feeding this injury.",
      "Mid back mobility work, for example foam roller extensions and open book rotations, so the reach back comes partly from the upper spine instead of entirely from the shoulder.",
      "Prone Y and T raises plus side lying external rotation for the posterior cuff and lower trapezius, which control where the ball sits in the socket at end range.",
      "Serratus anterior work such as bear crawls and landmine presses, because a blade that stops tilting back closes down the space at the top of the swing.",
      "Ask a coach to watch whether your elbow drives behind your body line at cocking, especially on tight sets. Better sets and a cleaner arm path fix more shoulders than any exercise."
    ],
    "return_markers": [
      "Full speed hitting with no pinch at the reach back position",
      "No symptoms 24 hours after a full hitting session, on two or three sessions in a row",
      "Internal rotation on the hitting side back to a normal range for you and stable week to week",
      "Jump serve at competitive effort without protecting the arm"
    ],
    "loads": [
      "serve",
      "attack"
    ]
  },
  {
    "slug": "rotator-cuff-tendinopathy",
    "name": "Rotator cuff tendinopathy",
    "also_called": [
      "hitter's shoulder",
      "cuff tendinitis",
      "rotator cuff strain",
      "swimmer's shoulder"
    ],
    "region": "shoulder",
    "triage": "get_assessed",
    "summary": "The cuff muscles that brake your arm after contact get overloaded and sore, usually from swing volume rather than one bad swing.",
    "what_it_is": "Four small muscles wrap the ball of the shoulder and hold it centred in the socket while the big muscles move the arm. Their tendons, mostly supraspinatus on top and infraspinatus behind, get overworked and their structure changes. Tendinopathy is a capacity problem more than damage from one moment: the tendon has been asked for more than it can currently handle, over and over, and has become painful and less efficient. Older labels like tendinitis suggest inflammation, which is only a small part of the picture.",
    "how_it_happens": "The swing is a whip. The arm goes back into full external rotation, the internal rotators fire, and after contact the posterior cuff has to brake an arm moving at close to the fastest joint speed in sport. That braking is eccentric and it is where the tendon takes its heaviest load, and a hitter takes anywhere from 100 to 300 of those in a hard session, plus jump serves, plus the overhead press against the net when blocking. It almost always shows up after a jump in workload: preseason, a tournament weekend, a switch to opposite or outside, a beach partner who sets you 200 balls, or coming back from a layoff and hitting full volume in week one.",
    "signs": [
      "A dull ache at the front and outside of the shoulder that shows up the morning after hitting more than during it",
      "Pain at the top of the swing and through the follow through, while pushing a heavy door or carrying bags feels normal",
      "The ball dies. Same technique, less speed, and you catch yourself arming the ball instead of swinging",
      "It warms up during practice and feels better by ball 20, then hurts worse that evening",
      "Trouble sleeping on that side, or waking when you roll onto it",
      "Reaching behind you into a back seat or a back pocket feels weak or tender"
    ],
    "red_flags": [
      "A single swing or a caught arm followed by immediate weakness, so you cannot lift the arm to shoulder height. That pattern fits a full thickness tear.",
      "Night pain that wakes you every night regardless of position and does not settle over weeks.",
      "Numbness, pins and needles, or coldness in the arm or hand, or a grip that is suddenly weak.",
      "Fever, spreading redness, or a hot swollen joint, particularly after a recent medical procedure or a skin infection near the shoulder.",
      "A visible hollow in the muscle behind the shoulder blade on the hitting side, which points at a nerve problem rather than a tendon."
    ],
    "phases": [
      {
        "name": "Calming it down",
        "goal": "Take out the loads that provoke the tendon while keeping the arm moving and keeping the rest of your training intact",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "No pain at rest or in bed",
          "Everyday overhead reaching is comfortable",
          "Symptoms no longer carry over into the next morning",
          "Low effort contact, like controlled hitting lines, does not flare it"
        ]
      },
      {
        "name": "Rebuilding capacity",
        "goal": "Load the cuff and the whole shoulder girdle deliberately so the tendon can handle more than the sport asks of it",
        "typical_window": "4 to 12 weeks",
        "markers": [
          "Outward rotation strength feels close to matched side to side",
          "Overhead loading no longer produces a next day flare",
          "Full pain free rotation in both directions",
          "Confidence returning at the top of the reach"
        ]
      },
      {
        "name": "Back to swinging",
        "goal": "Reintroduce speed, then height, then volume, in that order, judging the response 24 hours later rather than how it feels mid session",
        "typical_window": "3 to 8 weeks",
        "markers": [
          "Full effort swings on a good set without pain",
          "Ball speed back to normal by feel and by how defenders react",
          "A normal week of hitting without soreness accumulating across it"
        ]
      }
    ],
    "prevention": [
      "Side lying external rotation and prone horizontal abduction with a light dumbbell, two or three times a week year round. The posterior cuff is the brake on your swing and it is almost always the weak link in a hitter.",
      "Cross body stretch or sleeper stretch on the hitting shoulder after every session while the tissue is warm, to hold onto internal rotation.",
      "Count your hard contacts. A rough weekly tally, and a rule that you do not raise it by more than about a third from one week to the next, prevents most of these.",
      "Serratus anterior work such as banded wall slides and push up plus, so the shoulder blade keeps the socket under the arm through the whole swing.",
      "Train rotation from the ground with medicine ball rotational throws and half kneeling chops, so the arm is the last link in the chain rather than the engine.",
      "Rebuild volume over several weeks after any layoff, and during a growth spurt in younger players, rather than returning straight to full hitting."
    ],
    "return_markers": [
      "Full, pain free internal and external rotation, matching or close to the non hitting side",
      "Outward rotation strength that holds against firm resistance without giving way or pain",
      "A full hitting session at competitive effort with no increase in symptoms the next morning",
      "Serve and swing velocity back to your own normal, not just comfortable at half effort"
    ],
    "loads": [
      "serve",
      "attack",
      "block"
    ]
  },
  {
    "slug": "scapular-dyskinesis",
    "name": "Scapular dyskinesis (SICK scapula)",
    "also_called": [
      "winging",
      "SICK scapula",
      "scap dysfunction",
      "shoulder blade not moving right"
    ],
    "region": "shoulder",
    "triage": "self_manage",
    "summary": "The shoulder blade stops moving the way it should, so the socket is not where the arm needs it during the swing.",
    "what_it_is": "The shoulder blade is not bolted to the ribcage by a joint. It is slung on muscle, and it has to rotate upwards, tilt backwards and turn outwards as the arm goes overhead so the socket stays underneath the ball. Dyskinesis means it is not doing that properly. The pattern most often seen in hitters is a blade that tips forward, so the inner edge and bottom corner lift off the ribs and the whole shoulder sits lower and further forward on the hitting side.",
    "how_it_happens": "Serratus anterior and lower trapezius are endurance muscles doing an endurance job, and hundreds of swings plus repeated blocking press fatigues them long before the big movers give out. As they fade the blade tips forward, which closes down the space the cuff moves through and forces the arm to find range the blade should have supplied. It shows up late in tournaments and late in a season. It is also more consequence than cause in many players, since pain, a tight posterior shoulder, or plain fatigue will produce it, and it then makes everything else worse.",
    "signs": [
      "The inner edge or bottom corner of the shoulder blade lifts away from the ribs, clearest when lowering the arm slowly from overhead",
      "In a photo from behind, the hitting shoulder sits lower and rolled further forward than the other side",
      "A tired, heavy, unstable feeling in the shoulder late in sessions rather than sharp pain",
      "Tenderness at the front of the shoulder near the bony point of the coracoid, and along the top inner edge of the blade",
      "Your reach drops. You are not getting as high on the ball late in matches",
      "Clunking or grinding as the blade slides over the ribs"
    ],
    "red_flags": [
      "Winging that appeared suddenly and dramatically, especially after a viral illness, a heavy blow to the shoulder or neck, or an operation. Sudden true winging is a nerve palsy until proven otherwise.",
      "Winging together with numbness, burning pain, or weakness in the arm.",
      "Being unable to raise the arm fully overhead at all, or the blade lifting off dramatically on a simple wall push.",
      "Painful grinding with swelling over the blade, or pain that is present at rest and at night."
    ],
    "phases": [
      {
        "name": "Finding the driver",
        "goal": "Work out whether the blade is the problem or a symptom of a stiff mid back, a tight chest and posterior shoulder, pain elsewhere in the shoulder, or plain fatigue",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "A clear picture of when the pattern appears, fresh or only once fatigued",
          "Mid back and shoulder range assessed",
          "Any painful structure in the shoulder identified rather than assumed"
        ]
      },
      {
        "name": "Rebuilding control and endurance",
        "goal": "Restore the ability to position the blade, then make that position last as long as a match does",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "The blade holds position through a slow arm lowering",
          "The pattern is still correct at the end of a training session, not only at the start",
          "Front of shoulder tenderness settling",
          "Overhead reach feels supported rather than heavy"
        ]
      },
      {
        "name": "Integrating it into the swing",
        "goal": "Carry that control into fast, loaded, fatigued overhead sport, which is a different skill from doing it well in a gym",
        "typical_window": "4 to 8 weeks",
        "markers": [
          "Late session swings look like early session swings on video",
          "Reach height holds through a match",
          "The heavy dead arm feeling does not return"
        ]
      }
    ],
    "prevention": [
      "Serratus anterior work such as banded wall slides, push up plus, and bear crawls. That is the muscle that fatigues first in hitters.",
      "Lower trapezius work such as prone Y raises and half kneeling landmine presses, so the blade rotates upwards instead of shrugging.",
      "Mid back mobility with foam roller extensions and open book rotations, because a stiff upper spine forces the blade forwards.",
      "Row and pull volume that at least matches your pressing volume. Volleyball already loads the front of the shoulder heavily.",
      "Film yourself hitting at the end of a hard session rather than the start. Fatigued mechanics are the ones that injure people.",
      "Chest and front of shoulder stretching, for example a doorway pec stretch, so tight tissue is not holding the blade forward."
    ],
    "return_markers": [
      "Symmetric blade movement raising and slowly lowering both arms, watched from behind",
      "Blade control still present at the end of a full training session",
      "No tenderness at the coracoid or the upper inner edge of the blade",
      "Reach height and swing mechanics holding across a whole match"
    ],
    "loads": [
      "serve",
      "set",
      "attack",
      "block"
    ]
  },
  {
    "slug": "slap-tear",
    "name": "SLAP tear (superior labral tear)",
    "also_called": [
      "labral tear",
      "SLAP lesion",
      "torn labrum",
      "peel back injury"
    ],
    "region": "shoulder",
    "triage": "get_assessed",
    "summary": "A tear of the cartilage rim at the top of the socket, where the biceps anchors, from years of cocking or one hard fall.",
    "what_it_is": "The socket of the shoulder is shallow, and a rim of cartilage called the labrum deepens it and gives the ligaments something to attach to. The long head of the biceps tendon anchors into the top of that rim. A SLAP tear is a tear of the labrum at the top, at or around that biceps anchor. It ranges from simple fraying to an anchor that has lifted off the bone.",
    "how_it_happens": "Volleyball produces these two ways. The common one is slow: in maximal external rotation the biceps anchor twists and peels the top of the labrum backwards off the bone, a fraction at a time, across thousands of cocking phases, which is why it usually turns up alongside internal impingement and a tight posterior shoulder. The other is a single event, such as landing on an outstretched arm out of a dive, bracing against a hard driven ball, or a block deflection that yanks the arm sideways. Beach players collect more of the traumatic version because of the landings, indoor players more of the wear version because of the hitting volume.",
    "signs": [
      "Deep pain inside the shoulder that you cannot point to with one finger. Players describe it as being behind everything",
      "Clicking, catching, or popping when the arm goes overhead or across the body",
      "Pain in the arm back position and again at ball contact, with a sense that the shoulder is loose or not connected",
      "Pulling and curling feel weak or sore, because the biceps anchor is involved",
      "Loss of arm speed with no obvious weak muscle when someone tests you",
      "Symptoms that rise and fall with how much you hit and never fully clear"
    ],
    "red_flags": [
      "The shoulder slipping partly out of joint, or giving way when the arm is up and back.",
      "A distinct pop at the moment of a fall or a caught arm, followed by immediate weakness or inability to lift the arm.",
      "The shoulder locking so the arm will not move through its normal range.",
      "Numbness or pins and needles down the arm, or a hand that feels weak."
    ],
    "phases": [
      {
        "name": "Settling and confirming",
        "goal": "Reduce provocation and get an actual diagnosis, since a SLAP tear is very hard to tell apart from internal impingement or a cuff problem by feel alone",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Rest pain and night pain settling",
          "Overhead reach available without a catch",
          "A clinician has examined the shoulder and there is a plan",
          "Symptoms clearly tied to specific positions rather than everything"
        ]
      },
      {
        "name": "Building stability around it",
        "goal": "Get the muscular control good enough that the joint does not depend on the torn rim, which is often enough to play on",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Cuff and blade strength matched side to side",
          "Clicking reduced, or present but no longer painful",
          "Overhead loading tolerated without symptoms",
          "No sense of the shoulder shifting under load"
        ]
      },
      {
        "name": "Return to overhead volume",
        "goal": "Reintroduce hitting from low to full effort, watching for the loose or dead arm feeling as much as for pain",
        "typical_window": "4 to 12 weeks",
        "markers": [
          "Full swings without a catch or a slip",
          "A normal week of volume tolerated",
          "No loss of arm speed as a session goes on"
        ]
      },
      {
        "name": "If surgery is chosen",
        "goal": "A repair or a biceps procedure resets the timeline entirely, with early protection followed by a long staged return to overhead sport",
        "typical_window": "6 to 12 months to full hitting",
        "markers": [
          "Motion is restored before strength work begins",
          "Overhead strength work is well tolerated before any hitting starts",
          "Return to serving and hitting is staged over months, not weeks",
          "Some players never fully recover their previous swing velocity"
        ]
      }
    ],
    "prevention": [
      "Keep internal rotation with daily cross body and sleeper stretches, because a tight posterior shoulder increases the peel back twist on the labrum.",
      "Cuff and scapular endurance work such as side lying external rotation, prone Y raises and band rows, so control does not vanish in the fourth set.",
      "Drill diving and rolling in defence instead of catching yourself on a straight arm. Beach players in particular should practise shoulder rolls out of a full extension dig.",
      "Train the biceps and forearm in normal strength work. A stronger biceps anchor tolerates the peel back load better.",
      "Manage total hitting volume across a week and a season, which is the lever with the most evidence behind it for the wear version of this injury."
    ],
    "return_markers": [
      "Full swings at competitive effort with no catching, no painful clicking, and no sense of the shoulder shifting",
      "Symmetric cuff strength and no pain on resisted biceps loading",
      "Two or three full hitting sessions in a week with no delayed reaction",
      "Confidence to attack a tight set that forces a full reach back"
    ],
    "loads": [
      "serve",
      "attack",
      "block",
      "dig"
    ]
  },
  {
    "slug": "suprascapular-neuropathy",
    "name": "Suprascapular neuropathy (infraspinatus wasting)",
    "also_called": [
      "infraspinatus atrophy",
      "suprascapular nerve entrapment",
      "spinoglenoid notch syndrome",
      "volleyball shoulder"
    ],
    "region": "shoulder",
    "triage": "get_assessed",
    "summary": "A nerve on the shoulder blade gets irritated by the swing, wasting the muscle behind it. Often painless, first noticed as a dent.",
    "what_it_is": "One nerve, the suprascapular nerve, supplies the two rotator cuff muscles on the back of the shoulder blade. It passes through two tight notches on its way, and the branch to infraspinatus turns sharply around the spinoglenoid notch at the outer edge of the blade. If that branch is stretched, compressed, or repeatedly irritated, infraspinatus stops receiving a proper signal and wastes away. At that point the nerve carries almost no sensation, which is why the classic volleyball version is painless.",
    "how_it_happens": "The follow through of a hard swing whips the arm across the body while infraspinatus contracts hard and the blade rotates, which tightens a ligament over the nerve branch and drags the nerve against the notch. The float serve is repeatedly implicated because of its abrupt, braked arm action. This is one of the most volleyball specific findings in all of sports medicine: surveys of elite players routinely find infraspinatus wasting on the hitting side in a large share of hitters, most of whom have no pain whatsoever. A cyst growing out of a labral tear can also sit in the notch and squash the nerve, and that version usually does hurt.",
    "signs": [
      "A hollow or dent below the ridge of the shoulder blade on the hitting side, often spotted first by a teammate or in a photo",
      "The ball comes off slower with no pain to explain it, and topspin is harder to generate",
      "Rotating the arm outwards against someone's hand gives way easily on that side",
      "For many players, nothing at all until strength is tested or someone looks at the shoulder from behind",
      "In the cyst version, a deep ache at the back of the shoulder that does not behave like tendon pain"
    ],
    "red_flags": [
      "Weakness that appears over days rather than months, especially after a viral illness or after severe shoulder or shoulder blade pain that fades as the weakness arrives. That pattern suggests a nerve inflammation such as Parsonage Turner syndrome.",
      "Weakness or numbness spreading beyond outward rotation, into the hand, the grip, or other muscle groups.",
      "Weakness that follows a neck injury, a stinger, or a heavy collision, particularly with neck pain.",
      "Pain and weakness together, which raises the chance of a cyst compressing the nerve and is worth imaging sooner rather than later."
    ],
    "phases": [
      {
        "name": "Working out why",
        "goal": "Establish whether this is stretch related irritation from the swing or a cyst pressing on the nerve, because the two are managed completely differently",
        "typical_window": "2 to 8 weeks to a clear diagnosis",
        "markers": [
          "A clinician has tested outward rotation strength side to side",
          "Imaging or nerve testing has been done or discussed",
          "Hitting volume has been cut back while the picture is clarified"
        ]
      },
      {
        "name": "Loading what still works",
        "goal": "Strengthen the remaining external rotators and the whole shoulder girdle while reducing the swing volume that keeps provoking the nerve",
        "typical_window": "3 to 6 months",
        "markers": [
          "Outward rotation strength stops declining and starts improving",
          "Swing and serve velocity stabilising",
          "No new movements becoming weak"
        ]
      },
      {
        "name": "The long tail",
        "goal": "Nerves recover slowly, and the muscle may never fill back in visibly even when useful strength returns",
        "typical_window": "6 to 18 months, sometimes longer",
        "markers": [
          "Function returns ahead of the shape of the muscle",
          "Playing normal volume with strength checked periodically",
          "If a cyst was decompressed, strength returning gradually across many months"
        ]
      }
    ],
    "prevention": [
      "Build external rotation strength on purpose with side lying external rotation and prone external rotation at 90 degrees, so infraspinatus is both stronger and has a baseline you can notice a loss against.",
      "Have someone photograph your back and test outward rotation strength side to side once or twice a season. This injury is found by looking, not by waiting for pain.",
      "Cap float serve volume in any single session. The repeated abruptly braked arm action is the mechanism most often blamed.",
      "Swing through a full follow through across the body rather than cutting it short and jamming the arm to a stop, which a coach can see and correct.",
      "Keep posterior shoulder and blade endurance up with band rows and prone Y raises so the arm is decelerated by muscle rather than yanked to a halt at the end of range."
    ],
    "return_markers": [
      "Outward rotation strength measurably improving, or at minimum stable, on repeat testing",
      "Swing and serve velocity back to your own normal",
      "No spread of weakness into other movements",
      "A clinician has ruled out a cyst compressing the nerve"
    ],
    "loads": [
      "serve",
      "attack"
    ]
  },
  {
    "slug": "acl-sprain-and-rupture",
    "name": "Anterior cruciate ligament (ACL) sprain or rupture",
    "also_called": [
      "ACL tear",
      "torn ACL",
      "blown knee"
    ],
    "region": "knee",
    "triage": "urgent",
    "summary": "The main stabilising ligament inside the knee tears, usually on a landing or a plant, with a pop and a knee that swells within hours.",
    "what_it_is": "The ACL is a short, strong cord inside the knee joint that stops the shin bone sliding forward under the thigh bone and controls rotation. A sprain is a stretch or partial tear, a rupture is a complete tear. Because it sits inside the joint and is bathed in joint fluid, a fully torn ACL does not usually heal back into a functioning ligament, which is why the decision about surgery is a real decision rather than a formality. The fast swelling after the injury is blood filling the joint from the torn ligament.",
    "how_it_happens": "Most volleyball ACL injuries involve no contact at all. The typical picture is a single-leg landing from a block or a spike where the knee collapses inward, the foot is planted, and the trunk is leaning away from the leg, so the whole rotation goes through the knee. The plant step of a slide approach is the same shape under speed, one leg decelerating and rotating at once. The other common version is contact only in the sense that you land on an opponent's or teammate's foot under the net, which locks the ankle while the body keeps turning. Beach players tear it far less often, because sand robs you of the sharp deceleration the injury needs.",
    "signs": [
      "A pop or loud snap that you hear or feel at the moment of injury",
      "The knee swelling up within a few hours, often within one hour. Fast swelling means blood",
      "A sense that the knee shifted, slipped or came apart for an instant",
      "Usually cannot continue playing, even if the pain settles quickly",
      "Once the swelling goes down, the knee gives way when you pivot, turn, or come down stairs",
      "A persistent feeling that you cannot trust the leg when you plant on it"
    ],
    "red_flags": [
      "The knee looks deformed or out of place, or the foot below it is cold, pale, numb, or you cannot feel a pulse at the ankle. That suggests a knee dislocation with possible blood vessel or nerve injury and is a same-hour emergency.",
      "Cannot take any weight on the leg at all, or there is bony tenderness on the kneecap, the top of the shin, or the end of the thigh bone. Suspect fracture, which is more likely in a teenager whose growth plates are open.",
      "The knee is stuck bent and will not straighten, with a firm block at the end of the range. That suggests a torn meniscus caught in the joint and needs seeing quickly.",
      "The knee feels loose in more than one direction, or the lower leg can be moved around in ways it should not. Multiple ligament injuries need urgent assessment.",
      "Swelling that fills the joint within the first hour alongside severe pain."
    ],
    "phases": [
      {
        "name": "Calm the joint and get the knee straight",
        "goal": "Get the swelling down, restore full straightening, and wake the quadriceps back up. Straightening lost early is very hard to get back later.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "The knee straightens as fully as the uninjured one when both heels are propped up",
          "You can lift the straight leg without the knee sagging",
          "Visible swelling has come down and the joint no longer feels tight when you bend",
          "Walking without a limp"
        ]
      },
      {
        "name": "Decide the path, build the knee either way",
        "goal": "Work out with a surgeon and a physiotherapist whether the plan is reconstruction or rehabilitation without surgery, while building strength that is needed regardless of the answer.",
        "typical_window": "4 to 12 weeks from injury",
        "markers": [
          "Full bending range restored",
          "Thigh muscle wasting reversing rather than continuing",
          "Single-leg standing controlled without the knee wobbling",
          "No giving way during ordinary daily life"
        ]
      },
      {
        "name": "Rebuild strength and control",
        "goal": "Rebuild single-leg strength, running, landing and change of direction, whether after surgery or on a non-surgical path.",
        "typical_window": "3 to 9 months",
        "markers": [
          "Single-leg strength gap between the two legs closing steadily",
          "Running and two-foot landings without the joint swelling afterwards",
          "Hop distance approaching symmetry side to side",
          "No episodes of the knee slipping or buckling"
        ]
      },
      {
        "name": "Return to volleyball",
        "goal": "Return to the specific demands of the game: single-leg block landings, slide approaches, unbalanced landings near the net.",
        "typical_window": "9 to 12 months after reconstruction and often longer, though a genuinely low-grade sprain that has not torn through can be back in roughly 4 to 12 weeks",
        "markers": [
          "Hop and strength testing within about ten percent side to side",
          "Single-leg landings off balance stay controlled with the knee over the foot",
          "No swelling after full sessions",
          "Confidence attacking and blocking without protecting the leg"
        ]
      }
    ],
    "prevention": [
      "Run a structured neuromuscular warm-up before every session, with jumping, landing, cutting and balance components. Programmes of this kind measurably reduce ACL injuries, and it is the single highest-value thing on this list.",
      "Nordic hamstring curls and Romanian deadlifts. Hamstring strength directly resists the shin sliding forward, and quad-dominant players carry more risk.",
      "Hip abductor and external rotator strength: banded lateral walks, side-lying abduction, single-leg Romanian deadlifts. If the hip cannot hold the thigh, the knee falls inward on landing.",
      "Coach landing technique explicitly. Two feet where the play allows, hips back, chest up, knee over the middle of the foot, and record it from the front occasionally so players can see their own knees collapsing in.",
      "Drill the slide approach plant and the single-leg block landing as skills at low intensity, rather than only ever doing them at full speed in a game.",
      "Enforce centre line discipline in training. A large share of contact ACL and MCL injuries in volleyball come from landing on someone else's foot under the net, and that is largely preventable."
    ],
    "return_markers": [
      "Single hop, triple hop and crossover hop distances within about ten percent of the other leg",
      "Quadriceps and hamstring strength within about ten percent side to side, measured properly rather than guessed",
      "A single-leg block landing taken off balance stays controlled, with no inward collapse and no sense of the knee slipping",
      "No swelling the morning after a full training session with jumping and defence",
      "Formally cleared, with both time since surgery and objective testing satisfied, not one or the other"
    ],
    "loads": [
      "attack",
      "block",
      "dig"
    ]
  },
  {
    "slug": "mcl-sprain",
    "name": "Medial collateral ligament (MCL) sprain",
    "also_called": [
      "MCL tear",
      "inside knee ligament sprain",
      "medial ligament sprain"
    ],
    "region": "knee",
    "triage": "get_assessed",
    "summary": "A stretch or tear of the ligament on the inside of the knee, usually from a landing where the knee buckles inward.",
    "what_it_is": "The MCL is a broad band on the inner side of the knee that stops the knee being pushed inward. Injuries are graded from a stretch, through a partial tear, to a complete tear. Unlike the ACL it sits outside the joint and has a good blood supply, so the great majority heal without surgery. It is one of the better outcomes among serious-feeling knee injuries, but the grade drives the timeline and a grade three is not a two-week problem.",
    "how_it_happens": "The signature volleyball mechanism is landing under the net on somebody else's foot. The foot rolls or gets stuck, the body keeps travelling, the knee falls inward and the inside of the joint is forced open. The non-contact version is a single-leg block landing or a slide approach plant where the knee caves inward under a body that is moving sideways. Occasionally it is a direct blow to the outside of the knee, usually from a teammate diving through the same patch of court. Beach players are less exposed but a foot buried in soft sand while the body keeps going produces exactly the same forces.",
    "signs": [
      "Pain along a specific band on the inside of the knee that is tender when you press along it",
      "It hurts when the knee is pushed inward, so sidestepping towards the injured side is uncomfortable",
      "Swelling that is localised to the inside of the knee rather than filling the whole joint",
      "A feeling that the inside of the knee opens or gives when you plant and turn",
      "Stiff and sore at full straightening and full bending for the first few days",
      "In the first day or two, walking with the leg slightly bent and turned out to protect it"
    ],
    "red_flags": [
      "The knee feels loose in more than one direction, gives way, or there was a pop with the whole joint swelling within a couple of hours. That suggests the ACL or several ligaments are involved and needs prompt assessment.",
      "Cannot take weight at all, or there is bony tenderness at the kneecap, top of the shin, or the end of the thigh bone. In players who are still growing, the growth plate at the end of the thigh bone can fail instead of the ligament, and that must not be missed.",
      "Numbness, pins and needles, or a cold or pale foot on that side.",
      "The inside of the knee becomes hot, red and increasingly painful with fever or feeling unwell."
    ],
    "phases": [
      {
        "name": "Protect and settle",
        "goal": "Protect the healing ligament, control swelling, and restore normal walking and straightening. Higher grades are often braced for this period.",
        "typical_window": "3 days to 2 weeks",
        "markers": [
          "Walking without a limp",
          "Localised swelling settling",
          "Full straightening restored",
          "Pressing along the ligament is uncomfortable rather than exquisite"
        ]
      },
      {
        "name": "Load the ligament and rebuild strength",
        "goal": "Restore full range and rebuild quadriceps, hamstring and hip strength, including control of sideways movement.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Full bending and straightening compared with the other knee",
          "Shuffling and lateral movement comfortable at moderate speed",
          "Single-leg standing steady",
          "A gentle inward stress on the knee no longer produces sharp pain"
        ]
      },
      {
        "name": "Return to landing and lateral play",
        "goal": "Restore blocking footwork, single-leg landings and unbalanced landings at game speed.",
        "typical_window": "a further 1 to 4 weeks, which puts a grade one at roughly 1 to 3 weeks from injury in total, a grade two at 3 to 6 weeks, and a complete tear at 6 to 12 weeks or more",
        "markers": [
          "Block footwork at full speed without inside knee pain",
          "Two-foot then single-leg landings controlled with no inward collapse",
          "No swelling the day after a full session",
          "Confident planting and turning towards the injured side"
        ]
      }
    ],
    "prevention": [
      "Hip abductor and glute strength: banded lateral walks, side-lying abduction, hip thrusts. A hip that holds the thigh keeps the knee from falling inward on landing.",
      "Copenhagen adductor holds, so the inside of the thigh contributes to controlling the knee rather than being the weak link.",
      "Landing drills with explicit feedback on knee position, especially single-leg block landings, which is where the non-contact version happens.",
      "Centre line habits. Drill blockers to land back on their own side and coach hitters and blockers to be aware of feet under the net, because most volleyball MCL sprains involve somebody else's foot.",
      "Ankle strength and single-leg balance work, including landing on one foot and holding it. A rolling ankle sends the knee inward, and the ligament pays for it."
    ],
    "return_markers": [
      "No tenderness along the ligament and no pain when the knee is stressed inward",
      "Full range in both directions compared with the other knee",
      "Can shuffle, block-step and cut at full speed without inside knee pain or a sense of the joint opening",
      "Can land a block jump off balance and recover without the knee caving"
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "meniscus-tear",
    "name": "Meniscus tear",
    "also_called": [
      "torn cartilage",
      "meniscal tear",
      "torn meniscus"
    ],
    "region": "knee",
    "triage": "get_assessed",
    "summary": "A tear in one of the two rubbery shock absorbers between thigh and shin, giving joint line pain, catching, and slow swelling.",
    "what_it_is": "Two C-shaped wedges of tough cartilage, the medial and lateral menisci, sit between the thigh bone and the shin bone. They spread load across the joint, deepen the surface, and help the knee track. They tear either suddenly, from twisting on a bent and loaded knee, or gradually, as the tissue becomes more brittle with age. The outer third has a blood supply and can heal, while the inner two thirds mostly cannot, and that single fact drives most of the difference between treatment plans.",
    "how_it_happens": "The mechanism is twisting on a planted, bent knee. In volleyball that is most often a defensive movement: dropping into a low dig, the foot fixed, and the body rotating over it to play a ball that is not quite where you wanted it. The plant step of a slide approach does the same thing at speed, and so does spinning to chase a ball into the back court. Menisci also tear at the same instant as an ACL, because the landing that ruptures the ligament pinches the cartilage in the same movement. In players over about 35, the tear can be almost trivial in origin, a deep squat to pick up a ball is enough.",
    "signs": [
      "Pain along the joint line, the crease you can feel on the inside or outside of the knee between the two bones",
      "Swelling that comes on gradually over the following day rather than in the first hour",
      "Catching, clicking or a sense that something snags as the knee moves through a certain point",
      "Difficulty squatting all the way down or sitting back on your heels",
      "The knee feels unreliable going down stairs or coming out of a low defensive position",
      "A deep ache at the back of the knee at full bend"
    ],
    "red_flags": [
      "The knee is stuck bent and cannot be straightened, with a firm block at the end of the range. That is likely a torn fragment jammed in the joint and needs seeing quickly.",
      "There was also a pop with the knee giving way and the joint swelled within a couple of hours. That points to an ACL injury alongside the meniscus.",
      "Cannot take weight through the leg, or there is bony tenderness on the kneecap or the top of the shin. Suspect fracture.",
      "The knee is hot, red, and increasingly swollen with fever or feeling unwell. Joint infection is an emergency.",
      "Repeated episodes of the knee collapsing under you, especially if they are getting more frequent."
    ],
    "phases": [
      {
        "name": "Settle the joint and restore range",
        "goal": "Reduce the swelling and get full straightening and bending back, whether the plan is surgical or not.",
        "typical_window": "1 to 4 weeks, and similarly after any surgery",
        "markers": [
          "Full straightening compared with the other knee",
          "Swelling reduced and the joint no longer feels tight",
          "Walking without a limp",
          "Catching episodes less frequent or gone"
        ]
      },
      {
        "name": "Strength and control",
        "goal": "Rebuild quadriceps, hamstring and hip strength and re-establish squat control without provoking the joint.",
        "typical_window": "4 to 12 weeks",
        "markers": [
          "Can squat to roughly parallel without joint line pain",
          "No swelling the morning after training days",
          "Single-leg control steady without the knee falling inward",
          "Strength gap between the legs narrowing"
        ]
      },
      {
        "name": "Twist, land and return",
        "goal": "Reintroduce rotation, deep defensive positions and jump landings at game speed.",
        "typical_window": "6 weeks to 4 months if the tear was managed conservatively or trimmed surgically, and 4 to 6 months or longer if it was repaired with stitches, because repaired tissue needs protected healing time",
        "markers": [
          "Pivoting and cutting drills with no catching or apprehension",
          "Can drop into a deep defensive position and drive back out of it under load",
          "No next-day swelling after a session with jumping and defence",
          "Full range including sitting back on the heels, if that was normal for you"
        ]
      }
    ],
    "prevention": [
      "Build strength through the range you actually use on court. Goblet squats and rear-foot-elevated split squats taken to a genuinely deep position prepare the joint for low digging positions instead of leaving deep range untrained.",
      "Hip and glute strength: single-leg Romanian deadlifts, banded lateral walks, hip thrusts. Rotation should come from the hip, not be ground out through the knee.",
      "Practise pivoting off the ball of the foot rather than twisting on a planted heel, and drill defensive footwork so your feet get to the ball and your knee is not asked to rotate to make up the difference.",
      "Ankle mobility work, particularly knee-to-wall dorsiflexion. A stiff ankle stops the shin travelling forward and pushes the twist up into the knee.",
      "Landing and deceleration drills, the same ones that reduce ACL injuries. A large share of meniscus tears happen in exactly that event."
    ],
    "return_markers": [
      "No catching, locking or giving way for several weeks",
      "Full bending range compared with the other knee",
      "Deep squat and single-leg squat without pain along the joint line",
      "No swelling the morning after a full session including jumping and defensive movement"
    ],
    "loads": [
      "dig",
      "attack",
      "block"
    ]
  },
  {
    "slug": "patellar-tendinopathy",
    "name": "Patellar tendinopathy",
    "also_called": [
      "jumper's knee",
      "patellar tendonitis",
      "patellar tendinitis",
      "pain under the kneecap"
    ],
    "region": "knee",
    "triage": "self_manage",
    "summary": "Pain at the bottom tip of the kneecap that warms up as you jump and bites hardest the morning after a heavy jumping session.",
    "what_it_is": "The patellar tendon is the thick cord running from the bottom of your kneecap down to the bump on your shin. It is what transmits the force of your quadriceps into the ground every time you jump and every time you land. In tendinopathy the fibres in one small part of that tendon, almost always right at the lower tip of the kneecap, become disorganised and thickened, and that spot becomes painful under load. It is not a classic hot inflammation, which is why complete rest tends to make it feel better for a fortnight and then just as bad in the first week back.",
    "how_it_happens": "It is the landing, not the jump. Every time you land from a spike or a block, your quadriceps contracts hard while it is being lengthened, and the patellar tendon takes several times your body weight in a fraction of a second. An outside hitter or a middle can take well over a hundred max-effort landings in a single session, and on a sprung wooden court none of that force gets absorbed by the surface. The injury usually appears after a jump in load rather than during steady high load: preseason, a jump serve added to your game, a tournament weekend, a move from beach to indoor, or a switch to a position that blocks every rotation.",
    "signs": [
      "A pinpoint sore spot on the bottom tip of the kneecap that you can find with one fingertip",
      "Sore at the start of warm-up, fades or disappears once you are properly warm, then comes back worse two hours later or the next morning",
      "First steps out of bed feel stiff and sore at the front of the knee",
      "Worse going down stairs, squatting, and on the landing rather than the take-off",
      "Pain level tracks how much you jumped the day before, not how much you did today",
      "A slow single-leg squat on a decline, or off the edge of a step, reproduces the exact spot"
    ],
    "red_flags": [
      "A sudden pop or tearing feeling at the front of the knee during a jump, followed by not being able to straighten the knee or lift the leg straight, or the kneecap sitting visibly high. That is a tendon rupture and needs emergency care the same day.",
      "Swelling that fills the whole joint, or the knee giving way, catching or locking. Tendons do not do that, so the working assumption is wrong and it needs assessing.",
      "Pain that is there at rest and at night, unrelated to how much you played, especially with fever, feeling generally unwell, or unexplained weight loss.",
      "In a player roughly 10 to 16 years old, an exquisitely tender and visibly swollen bump on the shin or at the bottom of the kneecap. That is growth plate related, not adult tendinopathy, and it is managed differently."
    ],
    "phases": [
      {
        "name": "Settle the irritation",
        "goal": "Bring the daily ache and morning stiffness down while keeping the tendon working, because tendons get worse with total rest.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Morning stiffness in the first few steps is shorter and milder",
          "Pain that comes on during activity settles back to baseline within about 24 hours instead of building day on day",
          "Stairs and getting out of a chair no longer need guarding",
          "Jump volume has been cut to a level the knee can absorb without a next-morning spike"
        ]
      },
      {
        "name": "Rebuild tendon capacity",
        "goal": "Build genuine quadriceps and tendon strength with heavy, slow, progressive loading, plus the hip and calf work that shares the landing.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Heavier strength work produces a stable, predictable next-day response rather than an escalating one",
          "The strength gap between the sore leg and the good leg is visibly shrinking",
          "A decline squat at the same depth hurts less than it did a month ago",
          "Able to train strength on consecutive days without a flare"
        ]
      },
      {
        "name": "Reintroduce spring",
        "goal": "Put speed back into the tendon, since strength work alone does not prepare a tendon for the rate of loading in a spike landing.",
        "typical_window": "4 to 8 weeks, usually overlapping the strength phase",
        "markers": [
          "Repeated two-foot hops, then single-leg hops, without a next-morning flare",
          "Submaximal approach jumps feel normal rather than tentative",
          "Weekly jump count can be stepped up without a 24 hour pain spike",
          "No longer landing softly on one side to protect the knee"
        ]
      },
      {
        "name": "Full jump load",
        "goal": "Return to the real jump volume of your position, including back-to-back days and tournament weekends.",
        "typical_window": "3 to 6 months from the start for a recent case, 9 to 12 months or more for one that has been there a season or two",
        "markers": [
          "Full practice and match jump counts with no morning-after penalty",
          "Blocking sessions and jump serving tolerated on consecutive days",
          "Pain, if any, is a low background level that does not climb week to week"
        ]
      }
    ],
    "prevention": [
      "Heavy slow squats and leg press through full range, twice a week, all year. Tendon capacity is built by heavy slow load, and the off-season is when it can be built without competing with jump volume.",
      "Isometric holds before practice: a Spanish squat with a band behind the knees, or a wall sit held at about 60 degrees. This reliably dulls tendon pain for a couple of hours and lets you train properly rather than limping through.",
      "Nordic hamstring curls and Romanian deadlifts, so your landing is shared between hamstring and quadriceps instead of dumped entirely on the front of the knee.",
      "Straight-leg and bent-knee calf raises. An ankle that can absorb load takes work off the knee on every landing.",
      "Practise quiet landings: hips back, chest up, knee tracking over the middle of the foot, absorbing over a longer range instead of a stiff-legged thump. Film it from the front once a season.",
      "Count your jumps, at least roughly. Sudden jumps in weekly jump volume are what break tendons, not steady high volume."
    ],
    "return_markers": [
      "First steps in the morning are pain-free or trivially stiff",
      "A slow single-leg decline squat is pain-free or mildly sore and does not flare the following day",
      "Quadriceps strength on the injured side is within roughly ten percent of the other leg",
      "Two or three full-jump-volume sessions completed with the same next-morning feeling each time",
      "Approach jump height is close to your normal and you are landing evenly on both legs"
    ],
    "loads": [
      "serve",
      "attack",
      "block"
    ]
  },
  {
    "slug": "patellofemoral-pain",
    "name": "Patellofemoral pain",
    "also_called": [
      "runner's knee",
      "kneecap pain",
      "anterior knee pain",
      "PFPS"
    ],
    "region": "knee",
    "triage": "self_manage",
    "summary": "Aching around or behind the kneecap, worse with stairs, squatting and long sitting, and it does not warm up the way a tendon does.",
    "what_it_is": "The kneecap slides in a groove at the end of the thigh bone, and patellofemoral pain is pain coming from that joint. Unlike a tendon problem there is usually no single damaged structure to point at. It is a load-sensitive joint that has been asked for more than it currently has capacity for, often with some contribution from how well the hip and quadriceps are controlling the leg. It is extremely common and it responds well to the right loading, but it is stubborn and it takes months rather than weeks.",
    "how_it_happens": "Volleyball loads this joint through repeated deep knee bend. The kneecap is squashed into its groove hardest between roughly 30 and 90 degrees of bend, which is exactly the ready position, the drop into a passing platform, the squat and rise of blocking footwork, and the absorption phase of every landing. Liberos and setters who live in a low crouch through long rallies, and blockers doing repeated shuffle-squat-jump sequences, accumulate an enormous amount of it. The important distinguishing feature is the pattern of pain: jumper's knee is a pinpoint spot that fades once you are warm, while this is a vaguer ache around or behind the kneecap that often stays or grows across a session and is at its worst after sitting still.",
    "signs": [
      "A vague ache around the front of the knee that you cannot pin down with one finger, often described as behind or all around the kneecap",
      "Worse after sitting for a long time with the knee bent, in a car, a classroom or a bus",
      "Worse going down stairs than going up",
      "Grinding, creaking or a gritty feeling as the knee bends and straightens",
      "Pain that stays level or climbs during a session rather than warming up and fading",
      "Sometimes mild puffiness at the front, but not a joint that fills up with fluid"
    ],
    "red_flags": [
      "A joint that genuinely fills with fluid, especially after a specific incident. That points to something structural rather than simple patellofemoral pain and needs assessing.",
      "The kneecap has visibly slipped sideways at some point, or you have had a frank dislocation. That is a different problem with a different plan.",
      "The knee locks, catches or gives way underneath you.",
      "Pain that is present at rest and wakes you at night, particularly alongside fever, feeling unwell, or unexplained weight loss.",
      "In a teenager, knee pain accompanied by a limp, thigh or groin pain, or restricted hip rotation. Hip problems refer pain to the knee and some of them are time-critical, so a limping adolescent with knee pain needs the hip examined."
    ],
    "phases": [
      {
        "name": "Take the sting out",
        "goal": "Reduce the specific loading that provokes it, usually repeated deep knee bend under load, while continuing to train in modified form.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Stairs and long periods of sitting are less provocative",
          "Can complete a modified session without the pain climbing through it",
          "The background daily ache is lower",
          "You know which positions and volumes the knee currently tolerates"
        ]
      },
      {
        "name": "Build hip and quadriceps capacity",
        "goal": "Strengthen the quadriceps and hips through progressively greater depth, and improve control of the knee over the foot.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Strength work at increasing depth is tolerated without a flare",
          "Descending stairs no longer provokes it",
          "Single-leg squat looks controlled with less inward collapse of the knee",
          "Can sit through a long journey or class without the ache building"
        ]
      },
      {
        "name": "Return to full court demands",
        "goal": "Restore the ability to hold low positions and repeat jump and block sequences for a whole session.",
        "typical_window": "4 to 12 weeks overlapping the previous phase, with full resolution commonly taking 3 to 6 months",
        "markers": [
          "Can hold a low ready position through long rallies and repeat it",
          "Full jump and blocking volume without pain climbing across the session",
          "No lingering ache the evening after a hard day",
          "Pain no longer dictates which position you play"
        ]
      }
    ],
    "prevention": [
      "Squats and split squats through the full range you actually use on court, built up gradually rather than added all at once. Deep range capacity is what the joint lacks.",
      "Hip abductor and external rotator strength: side plank with a top leg lift, banded lateral walks, single-leg Romanian deadlifts. A hip that cannot hold the thigh lets the kneecap grind off-centre.",
      "Slow, controlled step-downs from a box. Descending is where the joint is loaded hardest and where control is most often absent.",
      "Calf raises and knee-to-wall ankle mobility. A stiff ankle forces the knee forward and adds compression at the kneecap.",
      "Ramp jump volume and low-position volume across preseason instead of doubling it in the first week back. This problem is usually a load spike wearing a technique costume."
    ],
    "return_markers": [
      "Going down stairs is comfortable",
      "Long periods of sitting no longer build an ache",
      "Can hold a low defensive position for a full rally, repeatedly, through a session",
      "Pain no longer climbs across a session or lingers into the next day"
    ],
    "loads": [
      "pass",
      "dig",
      "block",
      "attack"
    ]
  },
  {
    "slug": "quadriceps-tendinopathy",
    "name": "Quadriceps tendinopathy",
    "also_called": [
      "quad tendon pain",
      "quadriceps tendonitis",
      "pain above the kneecap"
    ],
    "region": "knee",
    "triage": "self_manage",
    "summary": "Tendon pain at the top edge of the kneecap rather than the bottom, common in blockers and in players who land deep.",
    "what_it_is": "The quadriceps tendon joins the four thigh muscles to the top edge of the kneecap. Like the patellar tendon below it, it responds to repeated heavy loading by becoming thickened, disorganised and painful, almost always right at the top pole of the kneecap. It behaves like jumper's knee and is managed on the same principles, but it is less common and it is frequently mislabelled, because players and coaches assume any pain at the front of the knee is jumper's knee and then wonder why decline squats are not helping.",
    "how_it_happens": "The quadriceps tendon takes its highest load in deep knee bend, which makes it the blocker's tendon. Repeated deep squats at the net, fast repeat jumps off a low stance, and landings where the knee travels well past ninety degrees load the quad tendon more than the patellar tendon does. Middles doing continuous block-move-block sequences, and players who sit deep through long rallies and then jump from there, are the typical cases. It also appears after a training change rather than a match: adding heavy deep squats, double jumps, or a lot of depth work to a programme without ramping up to it.",
    "signs": [
      "A sore spot right at the top edge of the kneecap, above it rather than below it, tender to press in one specific place",
      "Worst on deep squats, deep landings and driving up out of a low blocking stance",
      "Warms up during a session and then bites afterwards and the next morning",
      "Sometimes a thickening or lump you can feel just above the kneecap",
      "Uncomfortable rising from a low chair or taking stairs two at a time",
      "Pain that tracks the previous day's deep jumping volume rather than today's effort"
    ],
    "red_flags": [
      "A pop or tearing feeling above the kneecap followed by not being able to straighten the knee or lift the leg straight, sometimes with a dip or gap you can feel above the kneecap. That is a quadriceps tendon rupture and needs an emergency department the same day.",
      "The knee swells inside the joint, locks, catches or gives way. Tendons do not do that, so the assumption is wrong.",
      "Pain present at rest and at night that has nothing to do with how much you trained, especially alongside fever, feeling unwell or losing weight without trying.",
      "Tendon pain that appeared with no change at all in training load, particularly if other tendons or joints are hurting at the same time. That pattern points away from simple overload and needs a proper look."
    ],
    "phases": [
      {
        "name": "Settle the irritation",
        "goal": "Bring the daily ache and morning stiffness down while keeping the tendon loaded in the ranges it currently tolerates, backing off the deepest positions rather than stopping altogether.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Morning stiffness above the kneecap shorter and milder",
          "Pain after training settles back to baseline within about 24 hours",
          "Rising from a chair no longer needs guarding or a push off the arms",
          "Deep block volume reduced to a level that does not produce a next-morning spike"
        ]
      },
      {
        "name": "Rebuild tendon capacity",
        "goal": "Build quadriceps and tendon strength with heavy slow loading, adding depth as tolerance allows, alongside hip and calf work.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Heavier loads produce a stable rather than escalating next-day response",
          "Squat depth can be increased without a flare",
          "Strength gap between the legs closing",
          "Consecutive strength days tolerated"
        ]
      },
      {
        "name": "Return to deep and fast",
        "goal": "Reintroduce fast, deep, repeated jumping, which is the specific demand that caused the problem.",
        "typical_window": "4 to 10 weeks overlapping the strength phase, with the whole process commonly 3 to 6 months",
        "markers": [
          "Repeated block jumps out of a deep stance without a next-day spike",
          "Full training jump counts tolerated",
          "Back-to-back training days without a flare",
          "No longer avoiding the deep block stance"
        ]
      }
    ],
    "prevention": [
      "Heavy slow squats through full depth, twice a week, progressed gradually. The quad tendon needs capacity specifically in deep knee bend, because that is where blocking puts it.",
      "Isometric holds in a deep position, such as a wall sit or a Spanish squat, before sessions. They prepare the tendon and reliably dull tendon pain for a while.",
      "Split squats and step-ups so single-leg strength in deep range keeps pace with two-legged strength.",
      "Straight-leg and bent-knee calf raises plus hip thrusts, so the quadriceps is not the only thing absorbing every landing.",
      "Progress blocking volume deliberately. A middle moving from part-time to a full-time front-row role can double their deep jump count in a single week, and that is exactly the change that produces this."
    ],
    "return_markers": [
      "No morning stiffness at the top of the kneecap",
      "Deep squat and rise with no pinpoint pain above the kneecap",
      "Quadriceps strength within about ten percent of the other leg",
      "Repeated deep block jumps across a full session with no next-day flare"
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "chronic-ankle-instability",
    "name": "Chronic ankle instability",
    "also_called": [
      "trick ankle",
      "bad ankle",
      "weak ankle",
      "an ankle that keeps rolling"
    ],
    "region": "ankle",
    "triage": "get_assessed",
    "summary": "The ankle keeps rolling on flat ground, because the first sprain healed the pain but never restored the reflexes.",
    "what_it_is": "After a lateral sprain, something like a third to a half of players end up with an ankle that keeps giving way, keeps aching, or simply cannot be trusted. Two things are going on. The mechanical part is that a torn ligament heals long and slack, so the joint has more play in it than it should. The functional part is bigger: that ligament was full of sensors telling your brain where the foot was in space, the reflex loop that fires the muscles on the outside of the shin got slower, and those muscles got weaker while you were limping around. The result is an ankle that is a bit loose and, more importantly, a bit late.",
    "how_it_happens": "The pattern is almost always identical. A player sprains an ankle, waits until the swelling and pain are gone, which takes one to three weeks, then goes straight back to blocking, because pain going away feels like healing. Nothing has restored the reflex speed, the peroneal strength, or the ankle's forward bend, so the foot now sits slightly more tilted in the air and lands already inverted, with slower brakes behind it. Volleyball then serves up the exact same hazard, a blind landing among feet at the net, hundreds of times a season, and each fresh roll takes another bite out of the ligament and the reflex loop. One sprain becomes three, and then it starts giving way on stairs and flat ground, which is usually when players finally take it seriously.",
    "signs": [
      "The ankle rolls on flat ground, on stairs, or stepping off a kerb, not just in the middle of a play",
      "A constant sense that the ankle cannot be trusted, and reluctance to land single leg on that side",
      "Playing without a brace or tape stops feeling like an option",
      "Puffiness around the ankle after most sessions, and a dull ache at the front of the joint",
      "Less forward bend on that side, so a deep squat or a knee-to-wall test is clearly short",
      "Clicking, catching, or a pinching sensation deep in the joint"
    ],
    "red_flags": [
      "Catching, locking, or a sharp deep pinch inside the joint with swelling out of proportion to activity, which can mean a piece of cartilage and bone on the talus has been damaged (osteochondral lesion) and needs imaging",
      "Giving way while simply walking on level ground, which suggests genuine mechanical instability rather than a control problem",
      "Sudden loss of power turning the foot outward, or a snapping sensation behind the outside ankle knob, which points to a peroneal tendon tear or the tendon slipping out of its groove",
      "Pain at rest or at night, which does not fit an instability pattern at all",
      "Sharp pain at the back of the ankle when pointing the toes hard, which is a separate problem common in jumpers (posterior ankle impingement)"
    ],
    "phases": [
      {
        "name": "Settle the latest episode and find the real deficit",
        "goal": "Calm the current flare and get someone to work out how much of this is a loose ligament, how much is weakness and slow reactions, and whether anything inside the joint is damaged.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "The most recent roll has settled enough to walk and train in straight lines without pain",
          "There is a clear picture of which side has less forward bend, less balance, and less strength turning the foot outward",
          "Bracing or taping is being used for everything, not just matches"
        ]
      },
      {
        "name": "Rebuild strength, range, and balance",
        "goal": "Restore calf and peroneal strength, get the forward bend back, and retrain balance. This is the phase people skip, and it is the one that actually changes the reinjury rate.",
        "typical_window": "6 to 12 weeks, and the balance work needs most of that before it takes",
        "markers": [
          "Single leg heel raise numbers close to matching the other side",
          "Standing on the injured leg with eyes closed no longer means constant correcting",
          "Forward bend of the ankle is symmetric side to side",
          "No new giving way episodes across this block of work"
        ]
      },
      {
        "name": "Reactive control under game conditions",
        "goal": "Make the ankle handle what it actually fails at, which is landing blind on an uneven surface with a body attached to it.",
        "typical_window": "8 to 16 weeks from the start of the work",
        "markers": [
          "Hopping and landing on a soft or uneven surface without the ankle wobbling",
          "Landing from a block jump with the head up and the eyes on a ball, not on the floor",
          "A full week of training with no swelling and no episodes"
        ]
      },
      {
        "name": "Decision point",
        "goal": "If the ankle is still giving way after consistent, genuine strength and balance work, this is where imaging and a surgical opinion about ligament repair or reconstruction belong.",
        "typical_window": "3 to 6 months after starting structured work",
        "markers": [
          "Giving way still happening on flat ground despite months of consistent loading",
          "Deep front of ankle pain and swelling that does not track with training load",
          "Clicking, catching, or a joint that feels like it has something loose in it"
        ]
      }
    ],
    "prevention": [
      "Brace or tape every session, not just matches. A lace-up brace measurably cuts recurrence in players with a previous sprain, and most sprains happen in training volume where nobody bothers taping.",
      "Balance work with someone interfering: partner nudges at the hip and shoulder, head turns, catching a ball thrown wide, all on one leg. Game landings happen with the eyes and the brain busy, so quiet balance on a wobble board misses the point.",
      "Peroneal strength: band eversion, side-lying eversion holds, and heel raises done with the weight biased through the outside toes. These muscles are the brake, and they need to be both strong and fast.",
      "Heavy calf raises through the full range, knee straight and knee bent, with slow lowering. Calf capacity decides how much landing force ever reaches the ligaments.",
      "Restore forward bend with knee-to-wall calf stretching and ankle joint mobilisation. A stiff ankle changes how you land and pushes the foot onto its outside edge.",
      "Landing drills onto a folded mat or other compliant surface, so the ankle has rehearsed an uneven landing before somebody's shoe puts one under it at the net."
    ],
    "return_markers": [
      "Side to side hop and figure of eight hop times within about a tenth of the uninjured leg",
      "Four consecutive weeks of full training with no giving way and no swelling",
      "Single leg balance with eyes closed for about half a minute, matching the other side",
      "A block jump landed on an uneven or soft surface with no collapse",
      "A repeat of whatever ankle instability questionnaire a clinician scored you on at the start, showing a real change"
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "lateral-ankle-sprain",
    "name": "Lateral ankle sprain",
    "also_called": [
      "rolled ankle",
      "twisted ankle",
      "inversion sprain",
      "ATFL sprain"
    ],
    "region": "ankle",
    "triage": "get_assessed",
    "summary": "The classic net injury: you land on someone's foot at the centreline, the ankle rolls under, and the outside ligaments tear.",
    "what_it_is": "Three short ligaments hold the outside of your ankle together. The front one, the anterior talofibular ligament (ATFL), is tight when your toes are pointed down, which is exactly the position your foot is in when you come out of the air. When the foot lands tipped inward, that ligament takes the whole load and stretches or tears, sometimes taking the ligament below it (the calcaneofibular ligament) with it. Grades run from a stretched ligament with some swelling, to a partial tear, to a complete rupture, and the grade matters far more than how much it hurts in the first hour.",
    "how_it_happens": "Most bad ones happen on the centreline. A blocker lands blind with the eyes still up on the ball and puts the outside edge of the foot on the attacker's shoe as the hitter broad jumps forward across the line. Because the foot is already pointed downward coming out of the jump, it tips straight into a roll with nothing to stop it. The same thing happens between two blockers landing on each other in a double block, between a hitter and a covering teammate, and on a defender landing on a loose ball. Beach players roll ankles far less because sand collapses under a bad landing instead of gripping, while grass hides the same mechanism in divots and soft patches.",
    "signs": [
      "A pop, snap, or tearing sensation felt at the moment of landing",
      "Swelling on the outside front of the ankle, often within minutes and often shaped like an egg",
      "Bruising that shows up over the next few days and tracks down into the foot and toes as gravity pulls it",
      "Pain putting weight through the foot, especially pushing off for the approach or shuffling sideways",
      "A feeling that the ankle is loose or will not hold when you turn on it"
    ],
    "red_flags": [
      "You cannot take four steps on it right after the injury, or bone hurts when pressed on the back edge or tip of either ankle knob, on the navicular, or on the bump at the outside of the midfoot. These are the standard signs that an x-ray is needed to rule out a fracture.",
      "Numbness, pins and needles, or toes that go pale, dusky, or cold, which suggests nerve or blood vessel involvement and needs same-day care",
      "Pain high on the outside of the shin near the knee alongside the ankle pain, which can mean the fibula broke up top (Maisonneuve injury) even though the ankle is what hurts",
      "Obvious deformity, or the foot looking out of line with the leg",
      "Redness and heat spreading up the leg, or fever, which points to infection rather than a sprain"
    ],
    "phases": [
      {
        "name": "Protect and settle",
        "goal": "Get the swelling under control and get walking normally again, once a fracture has been ruled out.",
        "typical_window": "3 days to 2 weeks",
        "markers": [
          "Swelling stops climbing and the ankle no longer feels tight and hot by the end of the day",
          "You can put full weight through the foot and walk indoors without a limp",
          "Bruising appears in the foot and toes, which is normal drainage rather than a new injury"
        ]
      },
      {
        "name": "Motion and strength back",
        "goal": "Get the ankle bending forward again and get the calf and the muscles down the outside of the shin working.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Kneeling toward a wall, the injured ankle bends forward close to as far as the good side",
          "You can rise onto the toes of the injured leg alone without holding onto anything",
          "Standing on the injured leg no longer needs constant clawing with the toes to stay upright"
        ]
      },
      {
        "name": "Jump, land, and cut",
        "goal": "Reintroduce impact and direction change so the ankle learns to absorb landings again.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Two-footed jumping and landing is pain free",
          "Hopping and lateral shuffling on the injured leg feels solid rather than guarded",
          "The ankle is not puffy the morning after a session"
        ]
      },
      {
        "name": "Back into traffic at the net",
        "goal": "Return to landings you cannot see coming, which is the actual demand of the sport.",
        "typical_window": "4 weeks to 3 months, and longer if a ligament was completely torn or more than one was involved",
        "markers": [
          "Block footwork at match speed with no visible protecting of the leg",
          "You will land in a crowd at the net without hesitating or pulling out of a jump",
          "Bracing or taping is a choice rather than the only thing making play possible"
        ]
      }
    ],
    "prevention": [
      "Wear a lace-up ankle brace, or get taped, for practice as well as matches. This is the single most effective thing in the sport, especially for anyone with a previous sprain, and most sprains happen in ordinary training volume rather than on match day.",
      "Single leg balance progressions: barefoot on the floor, then on a folded mat or foam pad, then with eyes closed, then catching a ball tossed off to one side. Game landings are blind, so training balance while your eyes are busy is the whole point.",
      "Band eversion work, turning the foot outward against resistance, plus side-lying eversion holds. The peroneal muscles down the outside of the shin are the active brake against a roll, and they only help if they are strong and quick.",
      "Heavy calf raises with the knee straight and with the knee bent, including slow lowering off a step. A strong calf controls how hard the foot slaps down out of the air.",
      "Blocker footwork drills that finish with a squared two-foot landing behind the line rather than a reach under the net, and hitters practising a landing with feet together instead of a splayed stride across the centreline.",
      "Glute and hip abductor strength, because a hip that collapses inward on landing tips the whole leg over the outside edge of the foot."
    ],
    "return_markers": [
      "Single leg hop distance and side to side hop speed within about a tenth of the uninjured leg",
      "Balance on the injured leg with eyes closed for about half a minute, matching the other side",
      "A full block jump landed on a soft or uneven surface with no wobble and no apprehension",
      "No swelling or stiffness the morning after a full practice",
      "You stop thinking about the ankle mid-rally"
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "plantar-fasciopathy",
    "name": "Plantar fasciopathy",
    "also_called": [
      "plantar fasciitis",
      "heel spur pain",
      "PF",
      "morning heel pain"
    ],
    "region": "ankle",
    "triage": "self_manage",
    "summary": "Sharp heel pain on the first steps of the morning, from overloading the tie-rod of the arch on hard courts in thin shoes.",
    "what_it_is": "The plantar fascia is a thick, tough band running from the front of the heel bone forward into the base of the toes. It works like a tie-rod: as the arch flattens under load it stretches and stores energy, and as you push off and the toes bend up it winds tight and turns the foot into a stiff lever. When the demand on it outruns its capacity, the tissue where it anchors on the inside of the heel thickens and degenerates. Despite the name, it is usually not an inflamed tissue so much as an overloaded one, which is why it responds to graded loading rather than rest alone.",
    "how_it_happens": "Volleyball is a long chain of hard landings and hard braking on an unforgiving surface, and the fascia takes a share of every one. The single heaviest load is the braking step of the spike approach, that final plant where the arch flattens under body weight moving forward at speed and then has to reverse it. Court shoes are deliberately low, thin, and flexible for feel, so the foot does far more of the work than it would in a running shoe, and players stand around on hard floors between drills for hours. Beach players get there from the opposite direction, barefoot on sand where the arch works constantly with nothing supporting it, and the classic trigger for both is a step change in load: sand to indoor, offseason to preseason two-a-days, or a whole season played out in one dead pair of shoes.",
    "signs": [
      "Sharp pain under the heel on the first few steps out of bed, or after sitting still, that eases after a few minutes of walking",
      "Pain that returns late in a long session and the evening after it, rather than at the start",
      "A specific tender spot on the inside front of the heel bone that you can press with a thumb",
      "Worse barefoot on a hard gym floor, better in a cushioned shoe",
      "Pain rising onto the toes to reach for a block or a serve toss",
      "Worse the day after a jump heavy practice, better after an easy day"
    ],
    "red_flags": [
      "Numbness, tingling, or burning spreading into the sole or toes, which points to a nerve being compressed rather than a fascia problem and needs assessment",
      "Heel pain that is worse at night or at rest, which does not fit a loading injury",
      "Focal bone tenderness on the heel that hurts to hop on, especially after a spike in training, which can be a calcaneal stress fracture",
      "A sudden pop in the arch with immediate bruising and swelling, which suggests the fascia has torn",
      "Heel pain in both feet in a teenager or young adult, alongside morning stiffness lasting over half an hour, back stiffness, or other sore joints, which can mean an inflammatory arthritis rather than an overload injury"
    ],
    "phases": [
      {
        "name": "Settle the morning pain",
        "goal": "Bring the peak loads on the fascia down far enough that the tissue is not being reinjured before it can respond, so the first steps of the morning stop being sharp.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "The first steps in the morning go from sharp to dull, or from many painful steps to a few",
          "Jump volume and time standing barefoot on hard floors is clearly lower than it was",
          "Walking in a cushioned shoe is comfortable, even if barefoot on the gym floor is not"
        ]
      },
      {
        "name": "Build the calf and foot back up",
        "goal": "Load the fascia and the calf deliberately, because capacity is what has been outrun. This phase is loading, not resting.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Rising onto the toes of the affected foot alone no longer hurts under the heel",
          "Morning pain is intermittent rather than daily",
          "A moderate session no longer produces a bad next morning"
        ]
      },
      {
        "name": "Return to full jump volume",
        "goal": "Rebuild the approach, the braking step, and full practice jump counts without the symptoms cycling back.",
        "typical_window": "3 to 6 months, and a stubborn case can run past a year",
        "markers": [
          "Full spike approaches with no heel pain on the plant step",
          "Back to back heavy sessions without the morning pain returning",
          "The tender spot on the heel no longer reproduces the pain when pressed"
        ]
      },
      {
        "name": "If it has not turned around",
        "goal": "Reassess. Heel pain that has not budged in six months of sensible loading is the point where imaging and a second look at the diagnosis are appropriate, because several other things cause pain in the same spot.",
        "typical_window": "beyond 6 months",
        "markers": [
          "No meaningful change in morning pain despite months of consistent calf and foot loading",
          "Symptoms have changed character, for example spreading, burning, or turning into night pain",
          "Pain has appeared in the other heel with no obvious load reason"
        ]
      }
    ],
    "prevention": [
      "Heavy slow calf raises with the toes propped up on a rolled towel, knee straight and knee bent. Propping the toes tightens the fascia through the same mechanism it uses at push-off, so this loads the actual tissue rather than just the calf.",
      "Foot intrinsic work: short foot or arch doming, big toe presses, and toe scrunches on a towel. These are the muscles that share the arch load with the fascia, and they are chronically weak in players who live in flat court shoes.",
      "Replace volleyball shoes when the midsole creases and stops springing back, usually well before the upper looks worn out, and rotate two pairs across a heavy season rather than playing one pair into the ground.",
      "Ramp jump volume across transitions instead of stepping into them: beach season into indoor, offseason into preseason two-a-days, grass into gym. Almost every case starts at one of those handovers.",
      "Keep shoes on during long practices instead of standing around barefoot or in flat slides on a hard floor. Hours of standing between drills is invisible load that still counts.",
      "Big toe extension mobility work, because a stiff big toe forces the fascia to take more strain every time you push off."
    ],
    "return_markers": [
      "First step morning pain gone or trivial for a couple of weeks running",
      "A single leg heel raise with the toes propped up, done without heel pain",
      "Hopping repeatedly on the affected foot with no pain",
      "A full jump heavy practice with no flare the following morning",
      "For beach players, playing barefoot on sand without symptoms returning"
    ],
    "loads": [
      "attack",
      "block",
      "serve"
    ]
  },
  {
    "slug": "syndesmotic-ankle-sprain",
    "name": "Syndesmotic ankle sprain",
    "also_called": [
      "high ankle sprain",
      "syndesmosis injury",
      "torn syndesmosis"
    ],
    "region": "ankle",
    "triage": "get_assessed",
    "summary": "The foot pins and the leg rotates over it, tearing the ligaments that bind the two shin bones. Much slower than a rolled ankle.",
    "what_it_is": "Your two lower leg bones, the tibia and fibula, are lashed together just above the ankle by a set of ligaments and a sheet of tissue called the syndesmosis. It has to stay tight, because the talus sits in the slot between those bones like a wedge and pushes them apart slightly on every step. When rotation forces that slot open, the binding ligaments tear. This is a completely different injury to a rolled ankle even though it happens in the same second of the same play, and it behaves differently: less swelling, less bruising, more disability, and a far longer road back.",
    "how_it_happens": "The setup is the same centreline collision, but the outcome branches on what the foot does. If the foot rolls under, you get a lateral sprain. If the foot instead lands flat and gets trapped on an opponent's shoe or a teammate's foot while your body keeps rotating, the foot is turned outward and the ankle is jammed into a forward bend, and that wedges the two shin bones apart. Beach and grass produce their own version, where the foot buries and grips in soft sand or catches in turf on a hard cut or block shuffle, and the leg turns while the foot cannot. Because the swelling is unimpressive, players routinely tape it and keep playing, which is why so many of these are found weeks late.",
    "signs": [
      "Pain above the ankle joint, at the front, between the two shin bones rather than over the outside ankle knob",
      "Far less swelling and bruising than you would expect for how much it hurts",
      "Sharp pain at toe-off, so walking hurts more at push-off than at heel strike",
      "Pain when the foot is turned outward, or when someone squeezes the calf higher up the leg",
      "Pain on the plant step of the approach and on any twisting over a fixed foot"
    ],
    "red_flags": [
      "You cannot bear weight on it, which raises the possibility of a fracture or a frankly unstable syndesmosis that may need surgical fixation",
      "Pain high on the outside of the leg near the knee, which points to a fibula fracture at the top of the bone (Maisonneuve injury). This is missed constantly because the ankle is what hurts.",
      "Numbness, tingling, or toes that go pale or cold",
      "A visible gap or widening at the front of the ankle, or the foot sitting out of line with the leg",
      "Pain getting worse rather than better over the first week or two, which usually means the working assumption of a simple sprain is wrong"
    ],
    "phases": [
      {
        "name": "Protect and offload",
        "goal": "Take rotation and push-off load off the joint while the torn ligaments have a chance to knit, which usually means a boot and often crutches early on.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Walking flat footed in a boot is tolerable while walking barefoot is not",
          "Squeezing the calf, or turning the foot outward, still reproduces pain above the ankle",
          "Swelling stays modest, which is typical here and is not evidence the injury is minor"
        ]
      },
      {
        "name": "Walking and calf loading",
        "goal": "Get out of the boot and back to a normal walking pattern with a working push-off.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "You can walk without the boot and without pain at the front of the ankle at toe-off",
          "Rising onto the toes of the injured leg no longer pinches between the shin bones",
          "Turning the foot outward against light resistance is pain free"
        ]
      },
      {
        "name": "Rotation and impact",
        "goal": "Reintroduce twisting, jogging, and landing, the exact loads that opened the joint in the first place.",
        "typical_window": "4 to 12 weeks",
        "markers": [
          "Jogging with changes of direction is pain free",
          "Pivoting on a planted foot no longer causes pain above the joint line",
          "No ache or swelling the morning after impact work"
        ]
      },
      {
        "name": "Return to jumping and net play",
        "goal": "Handle full approach, take-off, and blind landings at match speed.",
        "typical_window": "6 weeks to 4 months for a stable sprain, and 4 to 6 months or more if it was unstable or needed surgical fixation",
        "markers": [
          "Full approach with no pain on the plant step",
          "Lateral block shuffles and hard pushes off the injured leg at match speed",
          "A whole practice with no next-day setback"
        ]
      }
    ],
    "prevention": [
      "Heavy calf raises knee straight and knee bent, plus tibialis posterior work such as band inversion, because these muscles control how far the foot turns out under a loaded landing.",
      "Hip external rotator and glute strength, so the rotation of a landing gets absorbed up the chain instead of arriving entirely at the ankle. Split squats with a controlled trunk turn and loaded side-lying clams are the workhorses.",
      "Landing technique for blockers: land square with the feet under the hips, not on a twist with one foot crossing the body. Coaches can drill this by finishing every block footwork rep with a held two-foot landing.",
      "Make it a team habit that hitters land short of the centreline and blockers step back off the line after the block. This injury needs a trapped foot, and a trapped foot needs somebody else's shoe.",
      "Sand and grass specific: build up hard planting and cutting on soft surfaces gradually at the start of the season, because a foot that buries and grips is what supplies the rotation.",
      "Do not lean on ankle bracing here the way you would for a rolled ankle. Braces control side to side roll far better than rotation, so strength and landing mechanics are the main defence."
    ],
    "return_markers": [
      "Hopping on the injured leg and landing with a turn, pain free",
      "Squeezing the calf and forcing the foot outward no longer reproduces any pain",
      "Full approach jump and block jump with no pain at push-off",
      "A full practice followed by a morning with no swelling, ache, or stiffness above the joint",
      "Single leg heel raise endurance matching the other side"
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "abdominal-oblique-strain",
    "name": "Abdominal oblique strain (internal oblique tear at the rib attachment)",
    "also_called": [
      "side strain",
      "pulled ab",
      "torn oblique",
      "rib-side strain",
      "ribs",
      "side of the stomach"
    ],
    "region": "back",
    "triage": "get_assessed",
    "summary": "A tear in the side of the abdominal wall, usually felt as a sharp catch during a jump serve or a big swing.",
    "what_it_is": "The obliques are the sheets of muscle that wrap the sides of your abdomen and drive rotation and side-bending. The internal oblique attaches to the lower ribs by a thin fibrous edge, and that junction is where the tissue usually fails. Most tears are small, involving fibres near the rib attachment. A larger one can pull away a slice of that attachment and produce visible bruising over the following days.",
    "how_it_happens": "During the cocking phase the trunk arches, rotates away from the hitting arm and side-bends, which puts the obliques on the side opposite the hitting arm on maximum stretch. Those same muscles then have to contract hard to reverse the rotation and whip the trunk through, so they are lengthening and firing at the same time, which is exactly how muscle tears. Jump serving is the highest-risk version because the athlete chooses full arch and full speed with no compromise, and the classic moment is the first hard serving day of preseason or the first session back after a break. For a right-handed player, the left side is the usual casualty, although either side can go.",
    "signs": [
      "A sudden sharp catch or pop in the side of the abdomen or over the lower ribs during a serve or swing, often at the moment the trunk whips forward",
      "You can point straight to it, and pressing on it reproduces it",
      "Coughing, sneezing, laughing and sitting up from lying all hurt",
      "Rolling over in bed and getting out of bed are surprisingly painful",
      "Reaching the arm overhead on that side pulls at the spot",
      "Bruising along the side or lower ribs appearing two to four days later in a bigger tear"
    ],
    "red_flags": [
      "Sharp pain with breathing in, plus a tender point directly on a rib, which points to a rib stress fracture or rib injury rather than muscle",
      "A bulge in the abdominal wall that appears when you lift your head or strain, which can mean a hernia or a full muscle rupture",
      "Abdominal pain with swelling, nausea, dizziness or feeling faint, which needs urgent assessment for internal injury or bleeding",
      "Flank pain with fever, or pain on urinating or blood in the urine, which is a kidney problem and not an oblique",
      "Pain spreading to the tip of the shoulder after a blow or a hard twist. Shoulder-tip pain from an abdominal injury is referred from under the diaphragm and can mean internal bleeding. Get same-day emergency assessment."
    ],
    "phases": [
      {
        "name": "Protect the tear",
        "goal": "Let the torn fibres knit without pulling them apart again, which mainly means avoiding rotation, coughing hard and sitting straight up from lying.",
        "typical_window": "1 to 2 weeks",
        "markers": [
          "Coughing and sneezing no longer produce a sharp stab",
          "Can get out of bed by rolling without bracing the side with a hand",
          "Walking and daily movement are comfortable",
          "The area is still tender to press, which is normal here"
        ]
      },
      {
        "name": "Restore rotation and load tolerance",
        "goal": "Get full pain-free trunk rotation and side-bend back, then start asking the muscle to produce force again.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Full range of side-bend and rotation in both directions with no catch",
          "Resisted rotation is uncomfortable at worst rather than sharp",
          "Can sit up from lying and hold side-lying positions without symptoms",
          "No morning soreness in the spot after the previous day's work"
        ]
      },
      {
        "name": "Rebuild the swing",
        "goal": "Reintroduce rotational speed in stages, because the tear happens at speed, not at load.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Rotational throws and controlled swinging without symptoms",
          "Hitting resumes off a toss before a full approach, and at partial speed before full",
          "No next-morning tenderness at the rib attachment after a hitting day",
          "Full-speed swings feel free rather than guarded"
        ]
      },
      {
        "name": "Return to serving volume",
        "goal": "Rebuild jump-serve tolerance, which is the last and most demanding thing to come back and the most common point of re-tear.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Float serves before topspin, topspin standing before jump serving",
          "A full serving set at match effort with nothing the next day",
          "Two hard sessions in a week without the spot reappearing"
        ]
      }
    ],
    "prevention": [
      "Side plank progressions, including long-lever side plank and side plank with rotation, to build endurance in the exact tissue that fails.",
      "Pallof press plus band chops and lifts, which train controlled rotation and anti-rotation rather than raw crunching.",
      "Rotational medicine ball throws into a wall, built up over preseason weeks, so the first violent rotation of the year is not a jump serve at full effort.",
      "Ramp jump-serve volume across preseason instead of taking fifty maximum serves on day one back. Most oblique tears happen in the first two weeks of a block.",
      "Open-book and thread-the-needle thoracic rotation drills, so the upper back supplies rotation range and the rib attachment does not get taken to end range every rep.",
      "90/90 breathing with a full exhale to keep the ribs down, which improves how the obliques sit and load during the arch."
    ],
    "return_markers": [
      "Full pain-free rotation and side-bend in both directions",
      "Coughing, sneezing and sitting up from lying produce nothing",
      "Full-speed swings at practice volume with no soreness the next morning",
      "Jump serving at full effort, repeated across a session, with no return of the catch",
      "No tenderness left when pressing on the rib attachment"
    ],
    "loads": [
      "serve",
      "attack"
    ]
  },
  {
    "slug": "extension-based-low-back-pain",
    "name": "Extension-based mechanical low back pain (lumbar facet irritation)",
    "also_called": [
      "hitter's back",
      "arching back pain",
      "facet pain",
      "low back pain from hitting"
    ],
    "region": "back",
    "triage": "get_assessed",
    "summary": "One-sided low back pain from arching in the cocking phase. It cannot be told apart from a bone stress injury by feel, which is why it gets assessed.",
    "what_it_is": "The back of your spine has small paired joints (facet joints) that stack one vertebra on the next, plus thick muscles running either side of them. When you arch, those joints close down on each other and take load directly, and irritation of that joint capsule and the muscles around it is one cause of this pain pattern. It is not the only one. A pars stress reaction, the early stage of the spondylolysis filed separately in this library, produces the same one-sided arching pain and cannot be separated from facet irritation by how it feels or by whether it warms up. That distinction is a clinician’s to make, not yours, and it matters most in a player who is still growing, where a missed bone stress injury is the one that costs a season.",
    "how_it_happens": "The cocking phase of the spike is a loaded arch. As the hitter reaches peak height, the trunk extends, rotates away from the hitting arm and side-bends, forming a C shape, and then reverses that whole shape violently to whip the arm through. A hitter takes 100 to 300 of those a session, and every one of them ends with the lumbar facets slammed to end range. Jump serving is the same shape with more air time and a harder finish, back-setting adds a deliberate arch with no approach to absorb it, and landing off a block with the hips already ahead of the shoulders gives you one more compressed extension per rep.",
    "signs": [
      "Pain on one side of the low back, an inch or two off the midline, that you can point to with a finger",
      "Worse when you arch, reach for a ball above and behind you, or lie face down",
      "Better when you sit, bend forward, or pull your knees to your chest",
      "Sore and stiff the morning after a heavy hitting or serving day, loosens up once you move",
      "Pain builds through practice rather than warming up and disappearing",
      "Often shows up on the side opposite the hitting arm in right-handed hitters, though either side is common"
    ],
    "red_flags": [
      "You are still growing (roughly under 18) and the pain has not clearly improved in two to three weeks, which means a bone stress injury has to be ruled out before anyone calls this muscular",
      "Pain, numbness, pins and needles or weakness running down a leg, or any change in bladder or bowel control",
      "Pain that wakes you at night regardless of position, or comes with fever, night sweats or unexplained weight loss",
      "Back pain that started with a fall, a collision or landing on someone's foot, rather than building up over sessions",
      "You are still growing and the pain is one-sided and arching-related. In a growing player this is treated as a possible pars bone stress injury until a clinician says otherwise."
    ],
    "phases": [
      {
        "name": "Settle the irritation",
        "goal": "Get pain out of walking, sitting, sleeping and school before anyone thinks about volleyball.",
        "typical_window": "3 days to 2 weeks",
        "markers": [
          "Can stand, walk and roll over in bed without a sharp catch",
          "Morning stiffness lasts minutes rather than the whole first hour",
          "Arching still reproduces the pain, and that is expected at this stage",
          "Pain has stopped spreading and stays in the one spot"
        ]
      },
      {
        "name": "Build the front and free the hips",
        "goal": "Give the arch somewhere else to come from, so the low back stops being the only hinge.",
        "typical_window": "2 to 6 weeks, overlapping the first phase",
        "markers": [
          "Can hold a front plank and a dead bug position without the low back complaining",
          "Can reach both arms overhead standing against a wall without the ribs flaring and the low back arching to get there",
          "Hip flexor stretching feels like a stretch rather than a pinch in the back",
          "Everyday bending and lifting is pain free"
        ]
      },
      {
        "name": "Reload the swing",
        "goal": "Reintroduce the arch under real speed, in the order the sport actually demands it.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Standing arm swings and controlled hitting off a toss are pain free",
          "Approach and land without pain, then without next-morning soreness",
          "Full-speed swing does not produce a catch at the top",
          "Serving builds from float to topspin without the spot flaring"
        ]
      },
      {
        "name": "Back to volume",
        "goal": "Tolerate a normal week, not a normal rep.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Two hard hitting days back to back with no next-day stiffness",
          "Full practice with no drop-off in swing height late on",
          "No need to modify anything in the last drill of the session"
        ]
      }
    ],
    "prevention": [
      "Dead bugs and their progressions, done with the low back flat and the ribs pulled down. This trains the front of the trunk to resist the arch, which is exactly its job in the cocking phase.",
      "Half-kneeling hip flexor stretch and couch stretch on both sides. A short psoas and rectus femoris tips the pelvis forward and forces the arch to come from L5 instead of the hip.",
      "Thoracic extension over a foam roller and open-book rotations. If the upper back can extend and rotate, the arch is shared across ten segments rather than dumped into two.",
      "Side plank and Pallof press for the sides of the trunk, which control the side-bend and rotation half of the C shape.",
      "Hip thrusts and Bulgarian split squats. Strong glutes finish the jump and absorb the landing so the low back is not the shock absorber.",
      "Count hard swings and jump serves across club, school, beach and open gym combined, and avoid stacking two maximum hitting days in a row."
    ],
    "return_markers": [
      "Standing back bend to full range with no sharp pain",
      "Standing on one leg and arching (the stork position) is pain free on both sides",
      "Full approach, swing and landing repeated at practice volume with no increase in pain the next morning",
      "A full session of hitting with no loss of swing height in the last twenty minutes"
    ],
    "loads": [
      "attack",
      "serve",
      "block",
      "set"
    ]
  },
  {
    "slug": "lumbar-disc-related-back-pain",
    "name": "Disc-related low back pain (lumbar disc injury, with or without nerve root irritation)",
    "also_called": [
      "slipped disc",
      "bulging disc",
      "herniated disc",
      "sciatica"
    ],
    "region": "back",
    "triage": "get_assessed",
    "summary": "Low back pain coming from the disc, typically worse with sitting and bending, and sometimes sending pain down a leg.",
    "what_it_is": "Between each pair of vertebrae sits a disc, a tough fibrous ring around a gel-like centre, which spaces the bones and spreads load. Repeated bending and rotation under compression can irritate or tear fibres in the ring. If the gel pushes outward far enough it can press on, or chemically irritate, a nearby nerve root, and that is what sends pain, pins and needles or numbness down the leg. Disc bulges also show up on scans in plenty of people with no pain at all, so the scan alone is not the diagnosis.",
    "how_it_happens": "This is the one volleyball back injury the arch does not cause. It comes from the other half of the sport: the hours spent in a flexed passing posture, the low lunging digs, and the compression of landing, which runs several times body weight through the spine on every jump. Hitters compound it in the transition from full extension in the air to a flexed, rotated landing, so the disc absorbs the whole reversal. Beach players get more of it from unstable sand landings and low digs, and the gym adds risk when heavy deadlifts or cleans get done with a rounded back after a hard practice.",
    "signs": [
      "A deep ache or band of pain across the low back, sometimes more on one side",
      "Worse with sitting, and much worse after a long drive to a tournament or a set spent on the bench",
      "Worse first thing in the morning and when bending forward to put shoes on",
      "Coughing, sneezing or straining increases it",
      "Pain, pins and needles or numbness into the buttock, back of the thigh, calf or foot",
      "Leg pain that is worse than the back pain, following a clear line down the limb"
    ],
    "red_flags": [
      "Numbness in the groin, inner thighs or saddle area, loss of bladder or bowel control, or difficulty starting or feeling urination. This is a medical emergency and needs an emergency department the same day, not an appointment.",
      "Weakness in the leg or foot: a dragging toe, foot slapping when you walk, or being unable to rise onto toes or heels on one side",
      "Symptoms in both legs at once, or leg symptoms that are getting steadily worse over days",
      "Fever, recent infection, or unexplained weight loss with back pain",
      "Severe pain starting immediately after a fall, a collision or a heavy landing gone wrong"
    ],
    "phases": [
      {
        "name": "Settle the irritation",
        "goal": "Reduce the nerve irritation and find the positions and movements that ease symptoms rather than provoke them.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Leg symptoms retreating up towards the back rather than spreading further down, which is the single most useful sign things are moving the right way",
          "Can sit for twenty minutes or so without symptoms building",
          "Sleep is less broken",
          "Coughing no longer sends pain down the leg"
        ]
      },
      {
        "name": "Rebuild tolerance to bending and load",
        "goal": "Get bending, hinging and sitting back to normal, and restore any strength lost in the leg.",
        "typical_window": "3 to 8 weeks",
        "markers": [
          "Can hinge and squat to depth without symptoms",
          "Can sit through a class, a bus ride or a long match without a flare",
          "Calf and foot strength are symmetrical again if they had been affected",
          "No leg symptoms with normal walking distances"
        ]
      },
      {
        "name": "Rebuild landing and passing tolerance",
        "goal": "Reintroduce the compressive and flexed loads specific to volleyball.",
        "typical_window": "3 to 8 weeks",
        "markers": [
          "Repeated jump landings without a next-day flare",
          "Can hold a low passing or digging posture for a full drill",
          "Diving and lateral digs return without provoking leg symptoms",
          "Gym work returns to hinging and squatting patterns under load"
        ]
      },
      {
        "name": "Full volume and tournament load",
        "goal": "Tolerate accumulated load, which for this injury is the real test, not any single movement.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Back-to-back matches with no build-up of symptoms",
          "A full weekend tournament including the travel",
          "No symptoms returning on the Monday morning after"
        ]
      }
    ],
    "prevention": [
      "Romanian deadlifts and kettlebell deadlifts to groove a hip hinge, so digging low and picking balls up is driven by the hips instead of a rounded lower back.",
      "Goblet squat holds and 90/90 hip switches for hip mobility, because a stiff hip forces the passing posture to be created by bending the spine.",
      "The trunk endurance staples, side plank, bird dog and curl-up, which build stiffness and endurance without repeatedly bending the spine to end range under load.",
      "Box drops and controlled landing practice to land hip-hinged with knees bent, plus calf and quad strength so the legs absorb the landing rather than the spine.",
      "Move heavy loaded lifting away from the first hour after waking, when discs are at their most swollen and least tolerant of bending under load.",
      "On long tournament drives, stand up and walk every thirty to forty-five minutes rather than sitting the whole way and then warming up cold."
    ],
    "return_markers": [
      "No leg symptoms, or only occasional symptoms that stay above the knee and settle quickly",
      "Can sit through a full journey or a full match on the bench and stand up without stiffness or catching",
      "Leg strength symmetrical: single-leg heel raises and heel walking equal both sides",
      "A full passing and digging session with no increase in symptoms the following day",
      "Repeated jump landings at practice volume with no flare"
    ],
    "loads": [
      "pass",
      "dig",
      "attack",
      "block"
    ]
  },
  {
    "slug": "spondylolysis-pars-stress-fracture",
    "name": "Lumbar stress reaction and spondylolysis (pars interarticularis stress fracture)",
    "also_called": [
      "pars fracture",
      "spondy",
      "stress fracture in the back",
      "back stress reaction"
    ],
    "region": "back",
    "triage": "get_assessed",
    "summary": "A stress injury to a thin bridge of bone in the lower spine, driven by the repeated arch-and-rotate of hitting and jump serving.",
    "what_it_is": "On the back of each vertebra there is a narrow strut of bone called the pars interarticularis, joining the joint above to the joint below. Repeated arching combined with rotation loads that strut in bending, which is the one thing it is poorly built for. First the bone gets irritated and swollen inside, which is a stress reaction and shows on MRI but not X-ray. If loading continues, a crack forms, which is spondylolysis. It is almost always at L5, usually on one side, and it is the single most common cause of persistent low back pain in an adolescent athlete.",
    "how_it_happens": "The cocking phase of the spike is extension plus rotation plus side-bend under speed, which is the exact loading pattern the pars fails under, and a hitter repeats it hundreds of times a session. Jump serving is worse per rep because the athlete chooses maximum arch with no defender forcing a compromise. The risk peaks between roughly 12 and 17, when the growth spurt leaves bone lagging behind the muscular force being applied to it, and a year-round schedule of club plus school plus beach plus open gym removes the offseason that would otherwise let the bone catch up. Setters who back-set heavily and blockers who land arched with the hips ahead of the shoulders add reps of the same shape.",
    "signs": [
      "Deep one-sided low back pain that you can point to with one finger, just off the midline near the belt line",
      "Standing on one leg and arching backwards reproduces it, and it is worse standing on the leg on the painful side",
      "Worse the day after a heavy jumping or serving day, and worse late in a session rather than at the start",
      "Unlike a muscle strain, it does not warm up and disappear after ten minutes",
      "Pain sitting up from lying, or arching to reach an overhead shelf",
      "Sometimes a vague ache into the buttock, but rarely true pain down the leg"
    ],
    "red_flags": [
      "Pain, numbness, tingling or weakness travelling down a leg, or any change in bladder or bowel control, which suggests the injury is affecting nerves",
      "A sense of the back giving way or catching, or a step or shelf that you or someone else can feel along the line of the spine, which can mean the vertebra has slipped forward",
      "Back pain in a growing athlete that persists beyond two weeks despite reduced load, which should be imaged rather than managed as a muscle problem",
      "Night pain unrelated to position, fever, or unexplained weight loss",
      "Sudden severe pain after a fall or collision rather than a gradual build"
    ],
    "phases": [
      {
        "name": "Unload the bone",
        "goal": "Take away the loading that caused it so the bone can heal, which means stopping jumping, hitting and serving rather than reducing them.",
        "typical_window": "6 to 12 weeks, sometimes longer for a frank crack",
        "markers": [
          "Daily life, walking and school are pain free",
          "Standing on one leg and arching no longer hurts on either side",
          "Some players are put in a brace during this period, some are not, and both are normal practice",
          "Repeat imaging or a clinical review, not a calendar date, is what ends this phase"
        ]
      },
      {
        "name": "Rebuild control in neutral",
        "goal": "Build trunk, hip and glute strength in positions that do not push the spine into end-range extension.",
        "typical_window": "4 to 8 weeks, overlapping the first phase",
        "markers": [
          "Can hold front plank, side plank and bird dog positions with a neutral spine and no symptoms",
          "Hip flexors and quads have regained length after weeks of reduced activity",
          "Hip hinging and squatting are comfortable",
          "Sustained standing and walking are completely unremarkable"
        ]
      },
      {
        "name": "Reintroduce jumping and swinging",
        "goal": "Rebuild landing tolerance first, then the arch, in that order.",
        "typical_window": "4 to 8 weeks",
        "markers": [
          "Repeated jump landings produce no next-day pain in the spot",
          "Blocking footwork and standing arm swings are clear before approach swings are attempted",
          "Hitting resumes off a toss or at half speed before full approach",
          "Jump serving is the last skill added back, usually weeks after hitting"
        ]
      },
      {
        "name": "Return to a full week",
        "goal": "Tolerate the accumulated load of a real training week and a tournament weekend.",
        "typical_window": "3 to 6 weeks",
        "markers": [
          "Consecutive hard days with no next-morning pain",
          "Full practice with normal jump volume and no late-session pain",
          "No return of the one-legged arch pain after a heavy weekend"
        ]
      }
    ],
    "prevention": [
      "Track total hard jumps, swings and jump serves per week across every team and gym the athlete plays in, and build load up gradually rather than doubling it the week club season starts. Volume, not technique, is the main driver.",
      "Dead bugs, front planks and Pallof presses to train the trunk to resist extension, so the arch does not run out of muscle and end up on bone.",
      "Half-kneeling hip flexor stretching and couch stretch, because a tight front of the hip forces extension to happen in the lumbar spine instead.",
      "Thoracic extension over a foam roller plus overhead reach drills, so the upper back contributes to the arch and L5 is not doing all of it.",
      "Romanian deadlifts and hip thrusts to build the posterior chain that finishes the jump and absorbs the landing.",
      "During growth spurt years, plan at least one genuine offseason block per year with no jumping or hitting, and avoid back-to-back maximum jump-serve days."
    ],
    "return_markers": [
      "Single-leg standing arch (stork test) pain free on both sides",
      "Full approach, swing and landing at match speed with no pain the following morning",
      "Jump serving at full effort with no pain during or after",
      "A complete practice week, including consecutive high-jump days, without the pain returning",
      "Clearance from the clinician managing the case, based on symptoms and where relevant on repeat imaging"
    ],
    "loads": [
      "attack",
      "serve",
      "block",
      "set"
    ]
  },
  {
    "slug": "adductor-groin-strain",
    "name": "Adductor (groin) strain",
    "also_called": [
      "groin pull",
      "pulled groin",
      "adductor strain",
      "inner thigh pull"
    ],
    "region": "hip",
    "triage": "self_manage",
    "summary": "A tear in the inner thigh muscles, typically from a hard lateral push out of the block or a wide lunge in sand.",
    "what_it_is": "The adductors run from the pubic bone down the inside of the thigh and pull the leg back toward the midline. Adductor longus is the one that fails most often, usually right where its tendon anchors onto the pubic bone. An acute strain is a tear in that muscle or tendon. Long-running groin pain in the same area can be a different problem, a tendon and bone irritation that has built up over months rather than torn in a moment.",
    "how_it_happens": "A blocker's job is a sudden sideways push followed by a hard stop, and the adductors do the stopping. When you swing block or shuffle to close, the trail leg is left behind with the hip open, and the adductor has to catch it and reverse the direction, which is a maximal contraction from a long position. Defenders get the same demand lunging wide for a ball and then checking to recover. Sand exaggerates every part of it, because the plant foot slides outward under load and the leg ends up further into the split than you asked for, with the adductor taking up the slack.",
    "signs": [
      "Sharp pain in the inner thigh or high in the groin at the moment of a sideways push, a wide lunge, or a stop",
      "Tender to press along the inner thigh, often right where the tendon anchors near the pubic bone",
      "It hurts to squeeze your knees together against a ball or your fist",
      "Getting out of a car, rolling over in bed, and the first lateral step of warm-up all announce themselves",
      "A catch or a pull when the leg is taken out to the side, so the block close and lateral shuffle feel restricted",
      "Bruising appearing on the inner thigh over the next few days with larger tears"
    ],
    "red_flags": [
      "A lump or bulge in the groin that appears when you cough, strain, or stand. That points to a hernia, which needs assessment rather than rehab.",
      "Pain in the testicle, or groin pain with fever, feeling unwell, or urinary symptoms. Those are not muscle injuries.",
      "A pop with immediate loss of the ability to pull the leg inward at all, or a visible gap or bunched-up muscle in the inner thigh",
      "Groin pain in a teenager that comes with a limp, or that also refers to the knee, especially if the hip resists turning inward. Hip joint conditions in growing athletes, including a slipped growth plate, present exactly like a groin strain and are urgent.",
      "Numbness in the inner thigh or groin, or the leg giving way under you"
    ],
    "phases": [
      {
        "name": "Calming the acute strain",
        "goal": "Let the injured tendon-muscle junction settle while gentle activation continues, because a groin that is completely rested stiffens fast.",
        "typical_window": "5 days to 2 weeks",
        "markers": [
          "Walking without a waddle or a shortened stride",
          "A gentle knee squeeze gives a mild pull rather than a sharp pain",
          "Getting in and out of a car no longer needs bracing",
          "The tender area is smaller and more defined than it was"
        ]
      },
      {
        "name": "Loading the adductors, especially long",
        "goal": "Rebuild strength through the range where the muscle failed, not just in the easy short position.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Squeeze strength is approaching the other side",
          "The leg goes out to the side to near-normal range without a catch",
          "Shuffling and side-stepping at moderate speed feel normal",
          "Soreness after loading settles by the next day rather than lingering"
        ]
      },
      {
        "name": "Back to lateral volleyball",
        "goal": "Reintroduce the fast direction change and hard stop that caused it in the first place.",
        "typical_window": "1 to 4 weeks indoor, often longer on sand",
        "markers": [
          "Full-speed block footwork in both directions, including the swing block and the stop at the antenna",
          "You can lunge wide to dig and recover to a ready position",
          "No groin tightness the morning after a full session",
          "On sand, you can push hard laterally out of a deep foot sink without a mental check"
        ]
      }
    ],
    "prevention": [
      "Copenhagen adduction: side plank with the top leg supported on a bench and the bottom leg lifting to meet it. This is the most studied groin prevention exercise there is, and it loads the adductor long, which is how the block close loads it.",
      "Adductor squeezes on a ball at several different amounts of hip bend, because the block close and the dig lunge load the groin at different hip angles.",
      "Lateral lunges and skater bounds with a held landing, to train the catch-and-reverse the trail leg performs every time you shuffle to close.",
      "Side-lying hip abduction and standing band walks for the glutes on the outside of the hip. An adductor that spends a whole match fighting a weak abductor fatigues early.",
      "If you are moving from indoor to beach, build sand volume in stages. The first few weeks on sand are when groins go, because the foot slides and the leg is taken further than it has trained for.",
      "Warm up the direction change specifically with shuffles, cross-overs, and progressively wider lateral lunges before the first blocking drill, not just a jog and a static stretch."
    ],
    "return_markers": [
      "Knee squeeze strength is symmetrical and leaves no sting afterwards",
      "Full-speed swing block to both sides, including closing to the antenna and stopping under control",
      "You can lunge wide enough to dig a ball well outside your body and return to ready",
      "A full session of lateral work leaves no groin tightness the next morning",
      "On sand, the first hard lateral step happens without hesitation"
    ],
    "loads": [
      "block",
      "dig",
      "pass"
    ]
  },
  {
    "slug": "femoroacetabular-impingement",
    "name": "Femoroacetabular impingement syndrome (hip impingement)",
    "also_called": [
      "hip impingement",
      "FAI",
      "pinchy hip",
      "cam hip"
    ],
    "region": "hip",
    "triage": "get_assessed",
    "summary": "Bone shape at the hip pinches the joint rim in deep flexion, so the low defensive stance and jump loading start to hurt.",
    "what_it_is": "The hip is a ball in a socket. In some people the ball has extra bone at its neck (called a cam shape), or the socket rim is deeper or angled forward (a pincer shape), and in deep bend, or bend plus rotation, the two collide. Repeated collision irritates the labrum, the rubbery ring that seals the rim of the socket, and the cartilage just inside it. It is called a syndrome because the bone shape alone is common and often silent. It becomes a diagnosis only when the shape, the symptoms, and the clinical tests all line up.",
    "how_it_happens": "Cam shape develops while the growth plate at the top of the thigh bone is still open, roughly ages eleven to sixteen, and it forms more in athletes who load the hip hard in that window. Volleyball then keeps the hip at end-range flexion constantly: defenders hold a deep forward-leaning stance for whole rallies, passers sit in hip flexion between every contact, and the loading phase of every single approach jump drives the hip to its deepest bend under full body weight before firing back out. The collision is worst in flexion combined with the knee turning inward, which is precisely the shape of a dig lunge across your body. Beach adds a lower sinking stance and much longer rallies.",
    "signs": [
      "A deep ache or pinch in the front of the groin, which players usually show by cupping the hip between thumb and fingers rather than pointing to a spot",
      "It bites in deep hip bend: the low ready position, a low car seat, tying your shoes, pulling the knee up and across your body",
      "Stiffness after sitting for a while, and the first several defensive stances of a session feel tight",
      "Clicking, catching, or a sense of the hip snagging in specific positions",
      "It built over weeks or months rather than starting at a moment you can name",
      "Sometimes an accompanying ache in the side of the hip or the buttock, and it can spread into the front of the thigh"
    ],
    "red_flags": [
      "Any player roughly eleven to sixteen with groin, thigh, or knee pain plus a limp, especially if the hip swings outward as you bend it up. A slipped growth plate at the top of the thigh bone presents exactly this way and is a same-week orthopaedic problem, not a hip that needs stretching.",
      "The hip genuinely locks or gets stuck, or gives way with a sudden inability to walk on it",
      "Hip or groin pain with fever, night sweats, feeling unwell, or pain that wakes you and is not eased by any position",
      "Deep groin pain that began after a heavy landing or a fall, or in a player who is under-eating, has missed periods, or has a history of stress fracture. A stress fracture in the neck of the thigh bone shows up as groin pain in a jumper and can go on to break completely under load.",
      "Numbness, weakness, or pins and needles in the leg, or pain that changes more with bending your spine than with moving your hip, which points at the back rather than the hip"
    ],
    "phases": [
      {
        "name": "Settling the joint down",
        "goal": "Reduce the pinching by temporarily taking the hip out of the positions that provoke it, while keeping the training that does not.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "The deep groin ache no longer flares from ordinary sitting or a normal day",
          "Sleep is undisturbed",
          "A low ready position can be held briefly without the pinch appearing",
          "You can name the specific positions and depths that set it off"
        ]
      },
      {
        "name": "Building the muscular envelope",
        "goal": "Strengthen the hip so muscle controls the joint through range, instead of the bony rim acting as the end stop.",
        "typical_window": "6 weeks to 4 months",
        "markers": [
          "Glute and deep rotator strength are clearly better, and the hip feels more stable rather than only less sore",
          "You can squat and lunge in a comfortable range, and that range is widening week to week",
          "Stiffness after sitting has largely gone",
          "A training session no longer leaves a deep ache that evening"
        ]
      },
      {
        "name": "Reloading the volleyball positions",
        "goal": "Bring back the deep flexion and rotation the sport demands, in a controlled progression rather than all at once.",
        "typical_window": "1 to 3 months",
        "markers": [
          "You can hold a genuine defensive stance for a full-length rally",
          "Approach jumps and landings do not produce the pinch",
          "Deep dig lunges across the body are tolerated",
          "Symptoms hold steady or improve across a training week instead of accumulating"
        ]
      },
      {
        "name": "Deciding what happens next",
        "goal": "Judge honestly whether a well-run loading programme has done enough, or whether imaging and a surgical opinion are the sensible next step.",
        "typical_window": "3 to 6 months from when it started",
        "markers": [
          "A clear comparison of symptoms now against three months ago, rather than a vague sense of progress",
          "Whether you can train fully or are permanently managing around it",
          "Whether flare-ups follow a pattern you understand or arrive without warning",
          "A clinician has reviewed the progress with you rather than you making the call alone"
        ]
      }
    ],
    "prevention": [
      "Hip thrusts, single-leg bridges, and step-ups for glute strength. The stronger the muscles holding the ball centred in the socket, the less often the rim has to be the thing that stops the movement.",
      "Deep rotator work: banded clamshells, side-lying external rotation, and 90/90 hip switches, trained for control rather than for how far you can get.",
      "Train the ready position as a strength position with hinged squat holds and hip hinges, so a low stance is held by muscle instead of sunk into at the end of the range.",
      "Stand tall between reps during long sessions instead of staying folded over for an hour. Total time spent at end-range hip flexion is the dose that matters.",
      "Do not stretch into the pinch. Forcing deep butterfly or aggressive pigeon into the exact painful position is the most common way players make an impinging hip angrier.",
      "Younger players should spread load across sports and seasons during the growth years, because the cam shape forms in the same window as heavy single-sport jumping."
    ],
    "return_markers": [
      "You can hold a low defensive stance through a full-length rally with no pinch",
      "Full approach and landing on both legs, with no deep groin ache that evening or the next morning",
      "Squatting and lunging to the depth the game actually needs, with no catch",
      "The hip does not stiffen up after a car ride, a class, or a long bench spell",
      "Training load has been stepped up over two or three consecutive weeks without symptoms escalating"
    ],
    "loads": [
      "dig",
      "pass",
      "attack",
      "block"
    ]
  },
  {
    "slug": "hamstring-strain",
    "name": "Hamstring strain",
    "also_called": [
      "pulled hammy",
      "hamstring pull",
      "pulled hamstring",
      "hammy"
    ],
    "region": "hip",
    "triage": "get_assessed",
    "summary": "A tear in the back of the thigh, usually from a deep lunge to dig or the hard braking plant of an approach.",
    "what_it_is": "Three muscles run down the back of the thigh from the sitting bone at the base of the pelvis to below the knee. They extend the hip and they slow the lower leg down as it swings forward. A strain is a tear in those fibres, most often where the muscle blends into its tendon. Volleyball ones sit either in the belly of the outer hamstring or high up near the sitting bone, and the high ones are slower to settle.",
    "how_it_happens": "Volleyball is not a sprinting sport, so the classic top-speed hamstring tear is less common here and two other patterns dominate. The first is the stretch type: a deep lunge, a sprawl, or a pancake for a dig, where the hip folds deep while the knee is near straight, putting the hamstring at its longest exactly as it is asked to hold the body up. The second is braking: the plant step of the approach and the stop at the end of a chase are hard eccentric decelerations and the hamstring is the brake. Sand makes it worse because the plant foot keeps sliding, so the deceleration lasts longer and the muscle holds that long position longer than it planned to.",
    "signs": [
      "A sudden grab, pull or pop in the back of the thigh during a lunge, a chase, or a hard plant, and you usually stop on the spot",
      "Tender when you press somewhere along the back of the thigh, and you can often put one finger on the exact spot",
      "Straightening the knee with the hip bent up reproduces it, so reaching for your toes or a straight-leg stretch bites",
      "Bruising appearing down the back of the thigh or into the calf over the next two or three days",
      "Walking is possible, but lengthening your stride or going down stairs feels unsafe",
      "High strains near the sitting bone ache when you sit on a hard bench or drive for a while"
    ],
    "red_flags": [
      "A loud pop with immediate inability to walk, fast swelling, and a large bruise high in the thigh. The tendon can pull completely off the sitting bone, and that has a time window for surgical repair, so it needs seeing quickly.",
      "You are a teenager and felt sharp pain right at the sitting bone during a lunge or a split. Growing bone can pull away at its growth plate instead of the muscle tearing.",
      "Numbness, pins and needles, or shooting pain down into the calf or foot. That is nerve involvement, and back-referred pain frequently masquerades as a hamstring that will not get better.",
      "Back-of-thigh pain with no clear moment of injury, worse at night, or alongside fever or unexplained weight loss",
      "The leg gives way underneath you when you put weight on it"
    ],
    "phases": [
      {
        "name": "Protecting the tear",
        "goal": "Let the torn tissue build early scaffolding while movement and blood flow continue in a pain-free zone.",
        "typical_window": "3 days to 2 weeks",
        "markers": [
          "Walking at normal pace without shortening the stride",
          "The sharp grab has become a defined, dull ache",
          "Bruising, if there was any, has stopped spreading",
          "You can contract the muscle gently without the sharp catch"
        ]
      },
      {
        "name": "Strength through the long range",
        "goal": "Restore force production with the muscle lengthened, which is where hamstrings fail and where they re-fail.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Knee straightens with the hip flexed to nearly the same range as the other side",
          "Loading the muscle at length no longer reproduces the original pain",
          "Jogging and gentle strides feel unremarkable",
          "The tender spot is no longer distinct when you press it"
        ]
      },
      {
        "name": "Speed, lunging and volleyball chaos",
        "goal": "Reintroduce the two things that caused it, hard braking and deep lunging, before returning to live play.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Full-effort sprints and hard stops without apprehension",
          "You can drop into a deep dig lunge or a sprawl and get up without protecting it",
          "No next-morning tightness after a full session",
          "You react to a short ball on instinct rather than deciding whether to go"
        ]
      }
    ],
    "prevention": [
      "Nordic hamstring curls, lowering as slowly as you can control. This has the strongest evidence in sport for cutting hamstring injuries, and it trains the exact eccentric brake the approach plant uses.",
      "Single-leg Romanian deadlifts, which load the hamstring long while one leg does the balancing, which is what the plant leg actually has to do.",
      "Sliding or stability-ball leg curls, to cover the knee-bending half of the hamstring's job that Nordics under-train.",
      "Actually sprint in your training week: a handful of near-maximal runs. A hamstring that never sees high speed in training will meet it for the first time chasing a ball down the line.",
      "Rehearse the deep dig lunge and the sprawl in the warm-up, going gradually deeper across preseason, so the first deep lunge of the year is not in a live rally.",
      "Glute strength through hip thrusts and step-ups. Weak glutes push more hip extension onto the hamstring, which is common in players who live in a low defensive posture all season."
    ],
    "return_markers": [
      "Full-speed sprint and hard stop with no hesitation, and nothing the next morning",
      "Strength at long muscle lengths is symmetrical, not just strength tested in a short position",
      "You can lunge deep enough to dig a low ball on either side and get straight back to ready",
      "Two consecutive full practices with digging and chasing, with no tightening at the end of either",
      "Bending forward with straight legs reaches the same point on both sides without a pull"
    ],
    "loads": [
      "dig",
      "pass",
      "attack",
      "serve"
    ]
  },
  {
    "slug": "hip-flexor-strain",
    "name": "Hip flexor strain (rectus femoris or iliopsoas)",
    "also_called": [
      "pulled hip flexor",
      "hip flexor pull",
      "front-of-hip groin pull",
      "tweaked my hip"
    ],
    "region": "hip",
    "triage": "self_manage",
    "summary": "A pull at the front of the hip from the drive and plant of the approach jump, sore when you lift the knee or land.",
    "what_it_is": "The hip flexors are the muscles that pull your thigh up toward your chest. The two that matter here are iliopsoas, which sits deep inside the pelvis, and rectus femoris, the middle quad muscle that crosses both the hip and the knee. A strain means some of those fibres, or the tendon they pull through, have been overstretched or torn, usually where muscle blends into tendon. Rectus femoris is the one that fails most often in jumpers, because it is asked to do two jobs at the same instant.",
    "how_it_happens": "The last two steps of a spike approach are a violent brake and redirect. The plant leg's hip is driven backward into extension while the knee bends, which stretches rectus femoris at both ends at once, and that is the position muscle tears in. Meanwhile the other leg has to whip the thigh up hard to drive the jump, and jump servers repeat the same thing with a longer run-up. On sand the foot sinks, so the hip flexors drag the leg out of a hole every step, and the low knee-up ready position beach defenders hold keeps them short and working all rally.",
    "signs": [
      "A sharp grab or pinch at the front of the hip or in the crease where the thigh meets the pelvis, usually on one identifiable step or jump rather than building slowly",
      "It hurts to lift your knee toward your chest against resistance, so stairs, getting out of a car, and the swing leg of the approach give it away",
      "Stretching backward into a lunge, which is what the plant step does, produces a pinch or a pull at the front",
      "Tender when you press a small, specific spot at the front of the hip or a hand's width down the front of the thigh",
      "Coughing or sneezing can catch it when the strain is high and deep",
      "Your standing block jump is fine but the approach has lost its speed, and you find yourself hitting off a short, cautious approach"
    ],
    "red_flags": [
      "You are still growing and felt a sudden pop with severe pain over the front of the pelvic bone, and cannot lift the leg at all. In teenagers the growing bone can pull away at its attachment (an avulsion fracture) instead of the muscle tearing, and that is managed differently.",
      "You cannot put weight through the leg, or you are still walking with an obvious limp more than a couple of days later",
      "A large bruise spreads down the front of the thigh, or the muscle looks dented, bunched, or lumpy compared to the other side",
      "Front-of-hip or groin pain with fever, feeling generally unwell, or pain that wakes you at night and is not changed by how you lie",
      "Numbness, pins and needles, or a cold or pale foot on that side"
    ],
    "phases": [
      {
        "name": "Settling the acute pull",
        "goal": "Let the torn fibres lay down early repair tissue while the leg keeps moving in ranges that do not provoke it.",
        "typical_window": "3 to 10 days",
        "markers": [
          "Walking at normal speed without shortening the stride or limping",
          "The sharp catch on lifting the knee has dulled into a defined ache",
          "Any bruising or swelling has stopped spreading",
          "You can lie on your back and lift the straight leg without a wince"
        ]
      },
      {
        "name": "Rebuilding strength through the range",
        "goal": "Get the muscle producing force again in the lengthened, loaded position where it failed.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Resisted knee lift feels close to the other side and does not sting afterwards",
          "A lunge that puts the back hip into extension no longer pinches",
          "Jogging, skipping and easy footwork feel unremarkable",
          "You still notice it at the end of a long session but not at the start"
        ]
      },
      {
        "name": "Back to the full approach",
        "goal": "Restore the braking and redirection demands of the approach and the jump serve run-up.",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Full-speed three-step approach without protecting the plant leg",
          "Block jumps and landings look and feel symmetrical",
          "No morning stiffness at the front of the hip after a hitting session",
          "You commit fully to the jump serve run-up without thinking about it"
        ]
      }
    ],
    "prevention": [
      "Rear-foot-elevated split squats, gone deep enough that the back hip is genuinely stretched. This trains the front of the hip to make force in the long position the plant step forces it into.",
      "Reverse Nordics: kneel, keep the hips straight, and lean the torso back slowly under control. This is the most direct way to build eccentric strength in rectus femoris in exactly the position where it tears.",
      "Half-kneeling hip flexor stretch with the back glute squeezed, done after training rather than before. Hitters and defenders spend whole sessions in hip flexion and quietly lose hip extension range.",
      "Banded standing knee drives and A-skips, to train fast hip flexion the way the swing leg actually uses it in the approach.",
      "Dead bugs and hollow-body holds, so the deep hip flexors learn to work alongside the abdominals instead of yanking on the lower back and finishing the session overloaded.",
      "Build approach volume back gradually after any break. Most of these appear in the first fortnight of preseason or the first week back on sand."
    ],
    "return_markers": [
      "Full-speed approach, including a broken-tempo emergency approach, with no guarding of the plant leg",
      "Resisted knee lift is equal side to side and does not ache the following morning",
      "You can hold a deep lunge with the back hip fully extended without a pinch at the front",
      "A full session of hitting lines followed by a normal next morning",
      "On sand, you can push out of a deep foot sink and sprint two steps without hesitating"
    ],
    "loads": [
      "attack",
      "serve",
      "block",
      "dig"
    ]
  },
  {
    "slug": "achilles-tendinopathy",
    "name": "Achilles tendinopathy",
    "also_called": [
      "Achilles tendonitis",
      "Achilles tendinosis",
      "sore heel cord",
      "tight Achilles"
    ],
    "region": "calf",
    "triage": "get_assessed",
    "summary": "Pain and stiffness in the heel cord from more jumping than the tendon can rebuild between sessions, worst in the morning.",
    "what_it_is": "The Achilles is the thick cord that joins your two calf muscles to your heel bone, and it is the only route those muscles have to the ground. Tendinopathy means the tendon has been loaded faster than it can repair itself, so the fibres become disorganised and the cord thickens, gets stiff and hurts. Most volleyball cases sit in the mid-portion, a few centimetres above the heel, where you can often pinch a tender thickened spot between finger and thumb; a smaller group sit right where the tendon attaches to the heel bone, which behaves differently and reacts badly to being stretched. It is not classic inflammation, which is why the older name tendonitis is inaccurate and why it does not settle with rest alone.",
    "how_it_happens": "Every jump you take is paid for by the Achilles, and middles and opposites routinely clear 100 to 200 jumps in a hard two hour session. Block jumps are the worst offender, because they start from a standstill or a quick shuffle with no real approach, so the calf and Achilles have to produce most of the force themselves instead of sharing it with a swinging arm and a loaded hip, and blockers repeat them every rally. The plant step of a spike approach loads it the other way, driving the ankle into a deep bend while the calf fights to slow your body down, which is exactly the lengthening load tendons complain about. Beach multiplies all of it: the heel sinks so the ankle travels through more range, sand returns almost none of the elastic energy hardwood gives back, and barefoot play removes the heel lift built into your court shoe, so a sand session costs the tendon far more per jump than the same count indoors and the spring indoor-to-sand crossover produces a wave of these.",
    "signs": [
      "Stiff, painful first steps out of bed that ease after a few minutes of walking, and are worse the morning after a jumping session.",
      "Pain that warms up and fades during practice, then returns harder a few hours later or the next day.",
      "A tender, thickened spot roughly two to six centimetres above the heel bone that you can feel between finger and thumb.",
      "Hopping on that leg or a single-leg heel raise reproduces the pain far more reliably than walking does.",
      "Push-off feels flat and your block jump is lower without you deciding to jump lower.",
      "A creaky or squeaky sensation in the cord first thing in the morning."
    ],
    "red_flags": [
      "A sudden pop or the sense of being kicked in the back of the leg, followed by an inability to push off or rise onto the toes. That is a rupture until proven otherwise and needs same-day assessment.",
      "A calf that becomes swollen, warm, hard and painful at rest, especially after a long flight, surgery, or time in a boot or cast. A blood clot can imitate tendon pain and needs urgent review.",
      "Fever, spreading redness or heat over the tendon, or any break in the skin over it. That points to infection rather than overload.",
      "In a player still growing, roughly ages nine to fifteen, pain located on the heel bone itself and tender when you squeeze the sides of the heel. That is usually a growth plate problem, not tendinopathy, and it is managed differently.",
      "Both Achilles tendons becoming painful at once, particularly alongside unexplained morning back or joint stiffness, or an Achilles that turned painful shortly after finishing a course of antibiotics. Those patterns need medical review, not a loading plan."
    ],
    "phases": [
      {
        "name": "Settle the irritation",
        "goal": "Bring daily pain and morning stiffness down by cutting the fast, springy load while keeping the calf working.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Morning stiffness drops from minutes to under a minute.",
          "Pain stops building across the day and across consecutive days.",
          "Jumping and hopping are out, but walking, cycling and slow heavy calf work are usually comfortable.",
          "A temporary heel lift or a shoe with more heel drop noticeably eases it, which is a clue about the diagnosis rather than a cure."
        ]
      },
      {
        "name": "Rebuild the tendon's capacity",
        "goal": "Load the tendon progressively heavier and slower so it rebuilds tolerance. This is the part people skip, and skipping it is why it comes back.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Heavier, slower calf loading is tolerated with pain staying low during and settling by the next morning.",
          "Single-leg heel raise height and repetitions climb toward the uninjured side.",
          "Morning stiffness is absent on most days.",
          "Strength is still noticeably behind on the injured side, which means this phase is not finished no matter how good it feels."
        ]
      },
      {
        "name": "Put the spring back",
        "goal": "Reintroduce fast elastic loading in small, counted doses: skipping, then hopping, then landings, then jumps.",
        "typical_window": "3 to 8 weeks, overlapping the previous phase",
        "markers": [
          "Skipping and hopping produce no next-morning stiffness.",
          "A small number of block jumps and approach jumps can be added without pain climbing during the session.",
          "Jump volume is being counted and built from a deliberately low base.",
          "Any flare settles within about 24 hours instead of lasting days."
        ]
      },
      {
        "name": "Back to full jump volume",
        "goal": "Return to a complete session, including the specific jump load your position actually demands.",
        "typical_window": "4 to 12 weeks",
        "markers": [
          "A full practice leaves no stiffness the following morning.",
          "Take-off height on the affected side matches the other side.",
          "Beach sessions and double days are added last, one change at a time.",
          "Low-level awareness of the tendon on hard days is common and is not the same thing as a relapse."
        ]
      }
    ],
    "prevention": [
      "Heavy slow calf raises twice a week, both straight-knee standing and bent-knee seated, through full range off a step. The bent-knee version loads the soleus, which carries most of the landing force in blocking and is usually the weaker link.",
      "Build a genuine single-leg heel raise capacity, in the region of 25 clean full-range repetitions a side, and retest monthly. Losing repetitions on one side shows up before pain does.",
      "Isometric calf raise holds in mid-range on heavy jumping days. They tend to quieten tendon pain for a few hours and let you train without adding more fast, springy load.",
      "Count jumps through preseason and avoid large week-to-week jumps in volume. Double days, a new blocking role and adding a jump serve are the three changes that most often precede a first flare.",
      "Knee-to-wall ankle mobility work if your ankle bend is limited or uneven side to side. A stiff ankle pushes load into the heel cord and changes how you absorb a block landing.",
      "Ramp into sand deliberately with short, spaced-out beach sessions rather than switching over in a week. Sand takes the ankle through more range, gives back almost no elastic energy and leaves you with no heel lift, so the crossover weeks are the highest-risk period of your year."
    ],
    "return_markers": [
      "Single-leg heel raise height and repetitions close to the uninjured side, full range, with no flare the next morning.",
      "Ten to fifteen minutes of continuous jumping and landing without pain climbing during the session.",
      "Morning stiffness gone, and it does not reappear the day after a hard session.",
      "Block jumps and approach jumps at match effort with the same take-off height on both sides.",
      "You are no longer thinking about the tendon between rallies."
    ],
    "loads": [
      "block",
      "attack",
      "serve"
    ]
  },
  {
    "slug": "achilles-tendon-rupture",
    "name": "Achilles tendon rupture",
    "also_called": [
      "blown Achilles",
      "torn Achilles",
      "snapped Achilles",
      "Achilles tear"
    ],
    "region": "calf",
    "triage": "urgent",
    "summary": "The heel cord tears through: a bang, a feeling of being kicked from behind, and push-off disappears. Needs same-day assessment.",
    "what_it_is": "The Achilles is the thickest tendon in the body and the only connection your calf muscles have to your heel. A rupture is a complete tear across it, almost always two to six centimetres above the heel bone, in a stretch of tendon with a poor blood supply. In most cases the tendon had been quietly degenerating for months or years, with or without pain, before the day it let go. Once it is torn the calf can no longer pull on the heel, so push-off, heel raises and jumping are gone, but many people can still walk flat-footed, which is exactly why ruptures get sent home as a calf strain.",
    "how_it_happens": "The typical moment is a sudden push-off: driving off one foot to block a ball you were not set for, sprinting off the net to chase a tip, or planting to change direction after a shanked pass. The tendon fails where a fast, forceful contraction meets a foot being shoved into a deep bend, so an awkward landing or a step into a soft hole in the sand can do it too. It skews heavily toward players in their thirties, forties and fifties who play once or twice a week at high intensity in a body that trains at a lower one, and it clusters at the start of the first game and the end of the last. A large share of these players had an Achilles that had been stiff and achy in the mornings for months and was played through.",
    "signs": [
      "A loud pop or bang that people nearby often hear, plus certainty that somebody kicked or hit you in the back of the leg. Players turn round to find nobody there.",
      "Immediate inability to push off, sprint, or rise onto the toes on that leg, even though walking flat-footed is often still possible.",
      "A gap or dent you can feel in the cord a few centimetres above the heel, at least until swelling fills it in over the first day.",
      "When you kneel on a chair with your feet hanging over the edge, the injured foot hangs looser than the other, and squeezing the calf does not make it point down the way the intact side does. A clinician calls this the calf-squeeze or Thompson test.",
      "Surprisingly little pain after the first minute, which is one of the main reasons it gets underestimated on the night."
    ],
    "red_flags": [
      "Any suspected rupture is itself urgent. Get seen the same day, stay off it, and do not test it by trying to jump or push off. Delayed diagnosis narrows the treatment options and worsens the result.",
      "Numbness, pins and needles, a foot that is cold, pale or blue, or a calf that becomes hard, tight and steadily more painful. That is a circulation or compartment problem and belongs in an emergency department, not a clinic queue.",
      "Any break in the skin over the tendon or a wound at the injury site. An open tendon injury is a surgical emergency because of infection risk.",
      "Once you are in a boot or cast: new calf swelling, warmth and pain, or any breathlessness or chest pain. Immobilisation raises clot risk, and a clot that travels to the lungs is life-threatening.",
      "After surgery: fever, spreading redness, increasing wound pain, or any discharge from the wound. Infection over a repaired Achilles is serious and time-critical."
    ],
    "phases": [
      {
        "name": "Diagnosis and the first decision",
        "goal": "Confirm what has happened, protect the tendon in a shortened position, and decide with a surgeon between surgical repair and managed non-surgical healing.",
        "typical_window": "first 24 hours to 2 weeks",
        "markers": [
          "The foot is held pointed down in a boot with heel wedges, or in a cast, usually with crutches at first.",
          "A complete tear has been confirmed clinically or on ultrasound, and how well the torn ends meet has been assessed.",
          "There is a named plan for how long in the boot and when the wedges come out.",
          "Pain and swelling settle quickly, which feels reassuring and tells you nothing about healing."
        ]
      },
      {
        "name": "Protected healing",
        "goal": "Let the tendon heal at the right length, neither too long nor too short, while load is reintroduced in controlled steps.",
        "typical_window": "6 to 12 weeks",
        "markers": [
          "Heel wedges come out in stages and the foot moves back toward flat inside the boot.",
          "Weight through the leg progresses from partial to full while still booted.",
          "The calf is visibly wasted next to the other side, which is expected at this stage.",
          "Ankle movement and gentle calf work begin under guidance rather than being avoided completely."
        ]
      },
      {
        "name": "Out of the boot, rebuild the calf",
        "goal": "Walk normally without a limp, and rebuild calf strength that has almost always dropped further than anyone expects.",
        "typical_window": "3 to 6 months from injury",
        "markers": [
          "Walking heel to toe in normal shoes, first with a heel lift and later without.",
          "A two-legged heel raise returns, then eventually a single-leg one. Getting the single-leg raise back commonly takes months, not weeks.",
          "The calf circumference gap narrows but is rarely gone.",
          "Cycling, swimming and steady walking or light jogging are typically negotiated during this stretch."
        ]
      },
      {
        "name": "Back to jumping and to the court",
        "goal": "Restore the spring, height and confidence that volleyball demands from one leg.",
        "typical_window": "8 to 12 months from injury",
        "markers": [
          "Single-leg heel raise height and endurance within roughly 10 to 20 percent of the other side, which is the usual gate.",
          "Repeated hopping and jump landings on the injured leg with no pain and no collapse in height.",
          "Block jumps and approach jumps at full effort off either leg with symmetrical take-off.",
          "Many players are back at some level by six to nine months and back to their real jumping self between nine and twelve months. A minority never fully close the height gap."
        ]
      }
    ],
    "prevention": [
      "Treat a grumbling Achilles as a warning rather than a nuisance and get it looked at. Most ruptures happen in tendons that were already degenerating, and months of morning stiffness is the clearest advance signal you will ever get.",
      "Heavy slow calf raises twice a week, straight-knee standing and bent-knee seated, through full range off a step. For a midweek-league player this is the closest thing to rupture insurance that exists.",
      "If you play once or twice a week at full intensity, train on the days you do not play. The classic rupture is a fit-enough person with an unfit tendon, because tendons adapt far more slowly than the heart and lungs.",
      "Keep a plyometric base year-round with skipping, pogo hops and low box landings, built up gradually, so an all-out push-off in game three is not the hardest thing your calf has done in six months.",
      "Warm up properly before the first competitive point, including short sprints and a few progressive approach jumps, and keep moving between games rather than sitting cold on the bench.",
      "Ramp your beach exposure rather than switching over in a week. Barefoot play takes the ankle through more range with no heel lift and no elastic return from the ground, which is a genuine step up in tendon load."
    ],
    "return_markers": [
      "Cleared by the surgeon or physiotherapist who managed the injury. This is not a decision to make on feel.",
      "Single-leg heel raise within about 10 to 20 percent of the other side for both height and repetitions.",
      "Repeated single-leg hopping with symmetrical height and controlled, quiet landings.",
      "Full approach jump and block jump off either leg with no drop in take-off height and no tendon pain the next day.",
      "Full training sessions completed before any match play, not the other way round."
    ],
    "loads": [
      "block",
      "attack",
      "dig"
    ]
  },
  {
    "slug": "medial-gastrocnemius-strain",
    "name": "Medial gastrocnemius strain (tennis leg)",
    "also_called": [
      "tennis leg",
      "calf pull",
      "torn calf muscle",
      "popped calf"
    ],
    "region": "calf",
    "triage": "get_assessed",
    "summary": "A sudden tear where the inner calf muscle meets its tendon, usually on a lunging dig or a hard push-off. It feels like being kicked.",
    "what_it_is": "Your calf has two muscles: the gastrocnemius, the bulky one you can see, which crosses both the knee and the ankle, and the soleus underneath it, which crosses only the ankle. Tennis leg is a tear where the inner (medial) head of the gastrocnemius hands over to its tendon, a few inches below the back of the knee and toward the inside. Because that muscle crosses the knee, it is stretched to its limit whenever the knee straightens and the ankle bends at the same time, and that is the position it tears in. Most are partial tears that heal well, and the size of the pop tells you very little about the size of the tear.",
    "how_it_happens": "The classic volleyball version is a defensive lunge: you step wide for a ball, the front knee straightens as you reach, your body weight drives the trailing ankle into a deep bend, and the medial gastrocnemius is caught long while contracting hard. The other common one is the transition push-off, where you land from a block, plant, and explode back off the net to hit, asking the calf to switch from absorbing to producing force in a fraction of a second. In sand it tends to happen on the pull-out, dragging a foot that is still buried while the rest of you is already moving. Recreational players over 30 take the majority of them, usually in the third game of the night when the calf is cooked and the warm-up was two minutes of pepper.",
    "signs": [
      "Sudden sharp pain in the upper inner calf, often with an audible pop, and the near-universal feeling that somebody kicked you or drilled a ball into your leg. Players commonly turn round to see who did it.",
      "You can usually still walk, but flat-footed, and rising onto the toes on that side is sharply painful.",
      "Bruising appears over the next one to three days and tracks down toward the ankle and heel with gravity. It looks alarming and is normal.",
      "A tender spot, sometimes a dent or a lump, in the upper inner calf a few inches below the crease of the knee.",
      "Much more pain when the knee is straight and the toes are pulled up than when the knee is bent, because bending the knee takes the gastrocnemius off stretch."
    ],
    "red_flags": [
      "A calf that becomes swollen, warm, tight and painful at rest, especially after a flight, surgery, or a spell in a boot or cast. A blood clot can look exactly like a calf strain and needs same-day assessment.",
      "No ability to push off at all, not even a small heel raise while standing, or a gap you can feel in the cord above the heel. That is an Achilles rupture, not a muscle strain, and it is urgent.",
      "Pain that keeps building over hours with a calf that feels hard, tight or bursting, or numbness, pins and needles, or a foot that is cold or pale. That can be compartment syndrome or a circulation problem, and it is an emergency.",
      "Fever, spreading redness, or skin over the calf that is hot and shiny. That suggests infection rather than a torn muscle.",
      "Six weeks in with no meaningful change, or a third tear in the same spot inside a season. The working assumption is wrong and something else is driving it."
    ],
    "phases": [
      {
        "name": "Protect and settle",
        "goal": "Let the torn fibres knit without pulling them apart again, and keep swelling and bleeding under control.",
        "typical_window": "3 to 10 days",
        "markers": [
          "Walking is guarded or limping, and is usually more comfortable with the heel slightly raised in the shoe.",
          "Bruising appears and drifts down toward the ankle over several days.",
          "Pain is sharp on a stretch or a push-off but quiet at rest.",
          "Ready to move on when you can walk heel to toe normally without thinking about it."
        ]
      },
      {
        "name": "Range and basic strength",
        "goal": "Restore full ankle bend and rebuild the calf's ability to take load in the position it tore in.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Ankle bend with the knee straight matches the other side.",
          "A two-legged heel raise, then a single-leg one, becomes possible without sharp pain.",
          "Walking downhill and going down stairs no longer produce a grab.",
          "The tender spot is smaller and takes firmer pressure to find."
        ]
      },
      {
        "name": "Speed, spring and reaction",
        "goal": "Rebuild tolerance to fast, high-force loading, which is what actually causes re-tears.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Jogging, then striding, then hopping, each without a next-day flare.",
          "Lunging out to the side and pushing back feels confident on both legs.",
          "Calf size and single-leg heel raise endurance are closing in on the good side.",
          "No protective hesitation when you have to change direction at speed."
        ]
      },
      {
        "name": "Back into volleyball",
        "goal": "Reintroduce full-speed defence, blocking and approach jumps.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "A full practice leaves no calf stiffness the next morning.",
          "You are digging at match speed without shortening your lunge.",
          "Repeated push-offs out of a block landing feel the same both sides.",
          "You have stopped checking the calf between rallies."
        ]
      }
    ],
    "prevention": [
      "Standing heel raises with a slow lowering phase off a step, knee straight, through full range. Knee straight is what genuinely loads the gastrocnemius, and the muscle tears lengthened with the knee straight.",
      "Seated bent-knee calf raises as well. The soleus underneath does most of the endurance work through long rallies, and when it fatigues early the load shifts onto the gastrocnemius.",
      "Loaded lateral lunges and split-stance floor reaches that copy the dig position, so the calf is strong at the end of its range rather than only in the middle.",
      "Pogo hops and skipping rope twice a week, short and sharp. A calf that only ever trains slow will tear when the game goes fast.",
      "A real warm-up before the first competitive ball: five minutes to raise your temperature, then progressive lunges, skips and a few submaximal approach jumps. Tennis leg loves cold rec-league players in the first fifteen minutes.",
      "Ramp beach exposure over several weeks instead of switching across in one, and expect the first barefoot sessions to leave the calves sore in a way indoor play does not."
    ],
    "return_markers": [
      "Single-leg heel raise on the injured side matches the other for height and roughly for repetitions.",
      "Repeated hopping on the injured leg, and landing on it, with no grabbing sensation.",
      "Full-speed lateral lunge to the floor and push back out, both directions, without hesitation.",
      "The knee-straight, toes-up stretch feels equal on both sides.",
      "A full practice with no calf stiffness the following morning."
    ],
    "loads": [
      "dig",
      "pass",
      "attack",
      "block"
    ]
  },
  {
    "slug": "mallet-finger",
    "name": "Mallet finger (extensor tendon avulsion at the DIP joint)",
    "also_called": [
      "dropped fingertip",
      "baseball finger",
      "drop finger"
    ],
    "region": "hand",
    "triage": "get_assessed",
    "summary": "The tendon that straightens your fingertip tears off the bone, the tip droops, and it hurts far less than it should.",
    "what_it_is": "A thin tendon runs down the back of the finger and attaches to the last bone to lift the fingertip straight. In a mallet injury that attachment tears, either the tendon pulling off the bone or a fleck of bone pulling off with it. The tip then hangs down and you cannot lift it under your own power, although someone else can lift it for you.",
    "how_it_happens": "The ball hits the very tip of a straight finger end-on and forces the last joint to bend while the tendon is actively holding it straight. In volleyball that is most often a block where one fingertip is slightly ahead of the others and meets the ball first, or a one-handed dig or reach where the ball catches the end of a finger. It also happens tucking a fingertip into the floor on a dive or a failed pancake, and catching a finger on the net or an opponent's jersey while withdrawing the hands from the block. The dangerous feature is how little it hurts. Players tape it, keep playing the tournament, and the tendon heals long or not at all, leaving a permanent droop.",
    "signs": [
      "The last joint of the finger droops and will not lift when you try, though you can push it straight with the other hand",
      "Swelling and a dull ache over the back of the fingertip rather than sharp pain",
      "A bruise or blood under the nail",
      "The tip catches on pockets and gloves and will not sit flat on a table",
      "Often you can still grip, hit and pass, which is why it gets ignored"
    ],
    "red_flags": [
      "You cannot actively lift the fingertip at all. That is the injury itself and it needs assessing within days, not weeks, because how it is splinted early determines the final result.",
      "Blood collecting under the nail, or the nail lifting out of its fold. That combination points to a fracture through the joint and a nailbed injury, and it changes the treatment.",
      "The middle knuckle starts hyperextending as the tip droops, giving the finger a wavy swan neck shape. That means the whole extensor mechanism has shifted and is a more complex problem.",
      "An open cut over the back of the last joint, which can mean the tendon or the joint itself is exposed and carries an infection risk.",
      "Skin under the splint that becomes white, soggy, ulcerated or painful. Splint-related skin breakdown needs a clinician to refit it, not a longer stretch of tolerating it."
    ],
    "phases": [
      {
        "name": "Held straight, continuously",
        "goal": "The fingertip is held in full extension by a splint a clinician has fitted and reviews, so the torn attachment can knit at the right length.",
        "typical_window": "the treating clinician sets the duration, and it is measured in weeks rather than days",
        "markers": [
          "A clinician has fitted the splint and decides when it comes off. That call is theirs, not the app’s and not yours.",
          "The joint bending during this period is the thing the splint exists to prevent, which is why the clinician sets the rules for changing it.",
          "Pain is often minimal throughout. That is normal and is not a sign the injury is minor.",
          "The middle knuckle is left free and keeps moving normally."
        ]
      },
      {
        "name": "Coming out of the splint",
        "goal": "Reintroduce bending at the last joint gradually while checking the tip is still holding straight",
        "typical_window": "2 to 6 weeks after splinting ends",
        "markers": [
          "The tip stays straight, or close to straight, when the splint is removed for a check",
          "Bending returns slowly and the joint feels stiff and thickened",
          "A small residual droop of a few degrees may appear and is a common outcome",
          "Splinting at night or for training often continues part time during this stage"
        ]
      },
      {
        "name": "Back to ball contact",
        "goal": "Return to blocking, digging and floor contact and see whether the repair holds under real force",
        "typical_window": "3 to 6 months from injury",
        "markers": [
          "The fingertip can be actively lifted level with the rest of the finger, or with a small permanent lag",
          "No return of the droop after a session with hard-driven ball contact",
          "Grip and fist are full, with mild stiffness at the last joint",
          "The knuckle stays thicker than its opposite number, often permanently"
        ]
      }
    ],
    "prevention": [
      "Rubber band finger extension. Band around the fingertips, spread and lift the fingers against it. Stronger finger extensors help the fingers stay straight and aligned at the instant of impact.",
      "Practise block hand shape with all fingertips in one plane. Wall presses and partner ball presses with fingers spread and stiff, so no single fingertip is left leading into the ball.",
      "Train the pancake and the sprawl to land on the flat back of the hand, not on fingertips. Rehearse it on a mat until the flat-hand contact is the default.",
      "Finger extensor isometric holds against a table edge, lifting each fingertip individually and holding, to build control of the last joint specifically.",
      "Keep nails short. A long nail on a finger that takes a ball end-on is what turns a tendon injury into a nailbed injury as well."
    ],
    "return_markers": [
      "The fingertip lifts actively to level, or within a small and stable lag, without a splint",
      "Cleared by the clinician who fitted or supervised the splint",
      "A hard-driven ball can be taken on the hand without the tip dropping again afterwards",
      "Full fist and normal grip strength for everyday tasks",
      "No pain or swelling over the back of the last joint the morning after a session"
    ],
    "loads": [
      "block",
      "dig",
      "pass"
    ]
  },
  {
    "slug": "pip-joint-sprain",
    "name": "PIP joint sprain (jammed finger), including volar plate injury",
    "also_called": [
      "jammed finger",
      "stoved finger",
      "sprained knuckle",
      "finger jam"
    ],
    "region": "hand",
    "triage": "get_assessed",
    "summary": "A jammed middle knuckle is a real ligament injury, and a meaningful share of them are fractures or volar plate tears in disguise.",
    "what_it_is": "The PIP joint is the middle knuckle of a finger. It is held together by a ligament on each side (the collateral ligaments) and a thick fibrous pad on the palm side (the volar plate) that stops the finger bending backwards. A jam stretches or tears one or more of these. The same impact can also crack the bone at the joint surface or pull a fragment of bone off with the volar plate, which looks and feels almost identical in the first few days.",
    "how_it_happens": "Blocking is the main source. A hard-driven ball arriving at 60 to 80 mph meets a hand that is not fully spread or not yet firm, and the ball catches one finger end-on. If it drives the finger straight backwards, the volar plate on the palm side takes it. If it catches the finger off-centre, one of the side ligaments takes it. Digging a hard-driven ball off the fingertips does the same thing with less force, and setting a ball that arrives faster than expected can hyperextend a finger before the hand is loaded. Fingers also get jammed on the net cable, on an opponent's hand over the net, and on the floor during a pancake or a dive where the fingertips land before the flat of the hand.",
    "signs": [
      "Swelling around the middle knuckle within an hour, often leaving the finger sausage shaped for weeks",
      "Pain when you try to make a full fist, and the fingertip will not reach the palm",
      "Tenderness when you press along the sides of the joint or on the palm side crease",
      "Pain and a stretched feeling when the finger is bent backwards, which points at the volar plate",
      "The joint stays visibly thicker than the same knuckle on the other hand long after the pain fades",
      "Stiffness that is worst first thing in the morning and after a session"
    ],
    "red_flags": [
      "The finger crosses over or under its neighbour when you make a fist, or the nail is rotated compared to the other hand. Rotation means a fracture until proven otherwise and it needs imaging.",
      "The joint opens up or feels like it slides when gently stressed sideways, or the finger looks bent at rest in a way you cannot straighten passively.",
      "Point tenderness on the bone above or below the joint rather than on the joint line itself, which suggests a fracture rather than a sprain.",
      "The finger is numb, cold, white or dusky, or the tip does not refill with colour when you press and release the pad.",
      "Broken skin over the knuckle, especially from contact with teeth or the net cable, or a knuckle that becomes hot, red and increasingly painful after day two. That pattern is infection, not swelling."
    ],
    "phases": [
      {
        "name": "Working out what it actually is",
        "goal": "Separate a straightforward sprain from a fracture, a volar plate avulsion or an unstable joint, and control the initial swelling",
        "typical_window": "0 to 10 days",
        "markers": [
          "Swelling and heat are at their peak and the joint is hard to assess accurately",
          "An x-ray has been taken, or a clinician has explained why one is not needed",
          "The finger can be moved passively through some range without a sensation of the joint giving way"
        ]
      },
      {
        "name": "Protected movement",
        "goal": "Get the joint moving early enough to avoid permanent stiffness, while the injured tissue is still shielded from sideways and backwards force",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Buddy taping to a neighbouring finger, or a splint fitted by a clinician, is being used for anything with ball or floor contact",
          "Active bending improves week on week rather than plateauing",
          "Swelling settles overnight instead of staying constant",
          "The joint is no longer painful at rest"
        ]
      },
      {
        "name": "Return to ball contact",
        "goal": "Reintroduce block, dig and set contact in that rough order of force, and confirm the joint tolerates being loaded backwards",
        "typical_window": "2 to 8 weeks from injury",
        "markers": [
          "Full fist, or fingertip within about a finger's width of the palm",
          "Can take controlled ball contact without flinching or pulling the hand away",
          "No rebound swelling the morning after a session",
          "Grip strength feels close to the other hand for everyday tasks"
        ]
      },
      {
        "name": "Residual stiffness and thickness",
        "goal": "Recover the last of the range and accept the cosmetic outcome, which is often permanent",
        "typical_window": "3 months to 2 years",
        "markers": [
          "The knuckle is still visibly thicker than its opposite number and probably always will be",
          "A small loss of full straightening or full bending may persist without affecting play",
          "Cold weather and long sessions still make the joint ache more than the others"
        ]
      }
    ],
    "prevention": [
      "Buddy tape at-risk pairs before blocking sessions. Index to middle and ring to little, taped above and below the middle knuckle, with the joint left free to bend. This limits sideways force without stopping you playing.",
      "Train block hand shape until it is automatic. Wall presses with hands spread wide, fingers straight and stiff, thumbs up, holding the shape for several seconds so the hand meets the ball as one plane rather than with a single finger leading.",
      "Rubber band finger extension. Loop a band around all five fingertips and spread the fingers apart against it. This builds the intrinsic hand muscles that hold the fingers spread and firm at the moment of contact.",
      "Grip and putty work. Squeezing therapy putty or a grip trainer, plus finger flexor holds on a bar or plate pinch, so the whole hand can stiffen against impact.",
      "Rehearse the pancake and the dive so the flat of the hand contacts the floor first. Fingertip-first landings are how a lot of jams and mallet fingers happen.",
      "Trim nails short and take rings off before you play. Both turn a routine jam into a skin or nailbed injury."
    ],
    "return_markers": [
      "Can make a full fist and fully straighten the finger, with any gap symmetrical enough not to interfere with grip",
      "Blocking or digging a hard-driven ball produces no sharp pain and no instinctive hand withdrawal",
      "No sideways looseness when the joint is stressed, and no pain point on the bone either side of the joint",
      "Swelling does not rebound in the 24 hours after a full session",
      "Confidence to play without taping, or a conscious decision to keep taping for the season"
    ],
    "loads": [
      "block",
      "dig",
      "set",
      "pass"
    ]
  },
  {
    "slug": "thumb-ulnar-collateral-ligament-sprain",
    "name": "Thumb ulnar collateral ligament sprain",
    "also_called": [
      "skier's thumb",
      "gamekeeper's thumb",
      "jammed thumb",
      "sprained thumb"
    ],
    "region": "hand",
    "triage": "get_assessed",
    "summary": "The ligament holding the thumb against the hand tears when a ball forces it outward, and pinch grip goes with it.",
    "what_it_is": "On the inside of the thumb's big knuckle, facing the index finger, sits a ligament that stops the thumb splaying away from the hand. It is what lets you pinch anything. When the thumb is forced outward it stretches or tears. In some complete tears the torn end flips over the top of a nearby tendon and physically cannot reach the bone again, which is called a Stener lesion and does not heal without surgery no matter how long it is rested.",
    "how_it_happens": "Setting is the exposure that is specific to this sport. The thumbs are a primary contact surface and they sit abducted, away from the palm, at the moment a ball arrives. A hard-driven ball dug high, an overhead emergency set, or a set taken slightly late drives the ball into the thumb pad and levers it outward against exactly the ligament that resists that direction. Setters take several hundred contacts a session. Blockers get it differently, from a ball striking the side of the thumb, or from the thumb catching on the net or on an opponent's hand. Diving and rolling adds a third mechanism where the thumb catches on the floor or in the sand and the body weight levers it away from the hand.",
    "signs": [
      "Swelling and bruising in the web space between thumb and index finger",
      "Pain pinching, gripping a bottle, turning a key or holding a phone",
      "A weak or unreliable pinch, where things slip out of the thumb and index grip",
      "Pain when you press the inside of the thumb knuckle, on the side facing the index finger",
      "A sense that the thumb is loose, unstable or falls away from the hand",
      "Pain setting, especially deep or hard balls, out of proportion to how the thumb looks"
    ],
    "red_flags": [
      "The thumb splays visibly further from the index finger than the other side, or feels like it has no firm end point when moved outward. That pattern suggests a complete tear.",
      "A tender lump felt just under the skin at the inside of the thumb knuckle, which can be the bunched-up torn ligament sitting where it cannot heal (Stener lesion). This is a surgical problem and time matters.",
      "You cannot pinch at all, or pinch collapses immediately under any load.",
      "Tenderness over bone at the base of the thumb near the wrist rather than at the knuckle, which points at a fracture rather than a ligament sprain.",
      "Numbness in the thumb, or swelling severe enough that the thumb is cold or discoloured."
    ],
    "phases": [
      {
        "name": "Protect and clarify",
        "goal": "Immobilise the thumb, get imaging and an assessment of how loose the joint is, and determine whether this is a partial tear, a complete tear or an avulsion fracture",
        "typical_window": "0 to 2 weeks",
        "markers": [
          "The thumb is in a brace or a thumb spica splint that stops it moving away from the hand",
          "A clinician has stress tested the joint, or imaging has been done, and the answer is not simply assumed",
          "Pain at rest settles and bruising in the web space starts to spread and fade",
          "A decision has been made about whether surgery is on the table"
        ]
      },
      {
        "name": "Protected motion and rebuilding pinch",
        "goal": "Restore movement while the joint stays shielded from outward force, and start reloading the pinch and grip that vanished",
        "typical_window": "2 to 8 weeks",
        "markers": [
          "Bending and straightening the thumb returns while sideways stress is still avoided",
          "Pinch strength improves week to week rather than staying flat",
          "The brace comes off for daily tasks but goes back on for anything with impact risk",
          "Pressing the inside of the knuckle is no longer sharply painful"
        ]
      },
      {
        "name": "Back to setting and blocking",
        "goal": "Return to ball contact in the direction that caused the injury, with the thumb taped and the volume built back rather than resumed at full",
        "typical_window": "6 weeks to 4 months, longer if surgery was needed",
        "markers": [
          "Can set a controlled ball without pain and without the thumb feeling like it will give",
          "Pinch strength is close to the uninjured side",
          "Taping or a brace is still used for full contact play and that is normal",
          "No swelling in the web space after a session"
        ]
      }
    ],
    "prevention": [
      "Tape the thumb for blocking and heavy setting sessions. A figure-of-eight or thumb spica tape job that limits the thumb travelling away from the index finger, while leaving bending free.",
      "Plate pinch holds. Pinch two small weight plates smooth-side out between thumb and fingers and hold. This directly loads the pinch mechanism the ligament protects.",
      "Thenar and first dorsal interosseous work. Squeeze a ball or putty between thumb and index, and press the thumb inward against resistance, to build the muscles that back up the ligament.",
      "Fix setting contact. The ball should sit on the pads of the fingers with the thumbs supporting from below and not spread wide, so a hard ball does not land on an abducted thumb. Drill this on slow balls before it matters on fast ones.",
      "Wrist and forearm strength, including wrist extension and radial deviation work, so the whole unit absorbs load rather than the thumb taking it in isolation.",
      "Progress setting volume gradually after a break. A setter jumping straight back to several hundred contacts a session after time off is the classic setup."
    ],
    "return_markers": [
      "Pinch strength within reach of the other hand, tested by holding real objects rather than by feel alone",
      "The thumb has a firm end point when moved outward, with no sensation of opening up",
      "Can set a hard-driven ball repeatedly without pain in the web space",
      "No swelling or ache the morning after a full session",
      "Cleared by the clinician who assessed the joint, particularly if a complete tear was ever suspected"
    ],
    "loads": [
      "set",
      "block",
      "pass",
      "dig"
    ]
  },
  {
    "slug": "triangular-fibrocartilage-complex-irritation",
    "name": "Wrist sprain and TFCC irritation (triangular fibrocartilage complex)",
    "also_called": [
      "wrist sprain",
      "ulnar wrist pain",
      "setter's wrist",
      "TFCC tear"
    ],
    "region": "hand",
    "triage": "get_assessed",
    "summary": "Pinky-side wrist pain from the cartilage cushion that takes the load every time a set or a block drives the wrist back.",
    "what_it_is": "On the little finger side of the wrist sits a cushion of cartilage and ligaments between the end of the forearm bone (the ulna) and the small wrist bones. It absorbs compression and holds the two forearm bones together as you rotate your hand. It gets irritated by repeated loading and torn by a single hard compression or twist. Generic wrist sprains involve the ligaments around it and often behave similarly at first.",
    "how_it_happens": "Setting drives load straight down the axis of a wrist held in extension, several hundred times a session, and the peaks come on the balls that arrive fastest and deepest, where the setter has to absorb and redirect with the wrist rather than the legs. Blocking adds a different load, where a hard-driven ball forces the wrist backwards at contact and the ulnar side compresses. Beach and grass players plant an outstretched hand in sand or turf on digs and rolls, which loads the wrist in extension and rotation at the same time. Falling on an outstretched hand in an indoor dive is the single-event version. The pattern that gets missed is the setter who has a slow build of pinky-side ache over a season of increased volume, with no fall to point at.",
    "signs": [
      "Pain on the little finger side of the wrist, sometimes deep and hard to localise",
      "Clicking, catching or a clunk when you rotate your forearm to turn a doorknob or pour a jug",
      "Pain pushing up off the floor, doing a push-up, or pressing out of a chair",
      "Weak grip, or grip that fades quickly through a session",
      "Swelling or a full feeling on the ulnar side of the wrist",
      "Setting deep balls hurts more than setting easy ones, and blocking a hard swing produces a jolt of pain"
    ],
    "red_flags": [
      "Pain and tenderness on the thumb side of the wrist, in the hollow at the base of the thumb, after a fall on an outstretched hand. That is a possible scaphoid fracture, it often looks minor, and it heals badly if it is missed.",
      "Visible deformity, a step in the line of the wrist, or grinding after a fall.",
      "Numbness, tingling or weakness spreading into the fingers, or a hand that goes dead when you load the wrist.",
      "The wrist gives way, clunks loudly with a jolt, or the end of the ulna sits noticeably prominent compared to the other side, which suggests instability rather than irritation.",
      "Wrist that becomes hot, red and swollen with fever or spreading pain, which is infection rather than a sprain."
    ],
    "phases": [
      {
        "name": "Settle and offload",
        "goal": "Reduce the compressive load through the ulnar side, and establish whether this is irritation, a tear or something else on the wrist entirely",
        "typical_window": "1 to 4 weeks",
        "markers": [
          "Pain at rest and at night settles",
          "Weight-bearing on the hand is being avoided or modified, including push-ups and floor drills",
          "A clinician has assessed the wrist, and imaging has been considered if there was a fall involved",
          "Grip is still weak and rotation still provokes symptoms"
        ]
      },
      {
        "name": "Rebuilding grip and rotation control",
        "goal": "Restore forearm rotation and the muscular support around the wrist so the cushion is not taking load unsupported",
        "typical_window": "3 to 10 weeks",
        "markers": [
          "Turning the forearm through full range is possible without a catch or clunk",
          "Grip strength climbs and holds through a longer session",
          "Push-up position or floor loading is tolerated without next-day pain",
          "Clicking, if it remains, is no longer painful"
        ]
      },
      {
        "name": "Return to setting and blocking volume",
        "goal": "Rebuild ball contact volume progressively, since this is a load problem as much as a tissue problem",
        "typical_window": "6 weeks to 4 months, with symptoms that can rumble for 6 to 12 months",
        "markers": [
          "Can set a full session without pinky-side ache the following morning",
          "Blocking hard swings produces no sharp pain at contact",
          "Taping or a wrist support is still used for high-volume days, which is common and reasonable",
          "Symptoms trend downward across weeks even if individual sessions still provoke a little"
        ]
      }
    ],
    "prevention": [
      "Wrist extensor and flexor isometric holds, then slow eccentric wrist curls with a light dumbbell, to build the muscular sleeve that shares load with the cartilage.",
      "Pronation and supination work with a hammer or a light bar held at one end, which trains exactly the rotation the TFCC stabilises.",
      "Grip loading. Farmer carries, dead hangs from a bar, and heavy carries build grip and wrist stability at the same time.",
      "Fix setting contact so the ball is taken on the finger pads with the wrist in a firm neutral position rather than collapsing into full extension on every ball. Slow-ball drills first, then hard-driven.",
      "Build setting volume in steps rather than jumps. Coming back from a break or moving into a setter role mid-season is when the reps double overnight and this shows up.",
      "Modify floor work if it hurts. Push-ups on fists, on parallettes or on dumbbells keep the wrist near neutral instead of at end-range extension under body weight."
    ],
    "return_markers": [
      "Full pain-free forearm rotation with no painful click",
      "Can bear body weight through the hand in a push-up position without next-day ulnar pain",
      "Grip strength close to the other side and stable through a full session",
      "A full setting or blocking session produces no rebound pain the following morning",
      "No sense of the wrist giving way or clunking under load"
    ],
    "loads": [
      "set",
      "block",
      "dig",
      "pass"
    ]
  },
  {
    "slug": "cervical-strain",
    "name": "Neck strain (cervical strain)",
    "also_called": [
      "stiff neck",
      "crick in the neck",
      "neck tweak",
      "whiplash"
    ],
    "region": "head",
    "triage": "get_assessed",
    "summary": "Overloaded or torn muscle and joint tissue in the neck, from spike and serve volume or from the head whipping in a collision.",
    "what_it_is": "The neck holds your head up and lets you track a ball that is above and behind you. A strain is overloaded or partly torn muscle and tendon, usually in the muscles running from the base of the skull down to the shoulder blade and along the side of the neck, often with irritated facet joints (the small joints at the back of each vertebra) in the mix. It is a soft tissue and joint problem rather than a nerve or disc problem. In the first days it can look identical to things that are not a strain, which is why it gets assessed rather than guessed at, especially when a collision or a fall was involved.",
    "how_it_happens": "There are two routes into it. The slow one is volume: every jump serve and every spike starts with the head tipped back and rotated to keep the ball in view, then whips forward as the trunk snaps through at contact, and a hitter takes hundreds of those in a session while a setter spends whole rallies with the chin poked forward looking up under the ball. The deep neck flexors fatigue first and the upper trapezius and levator scapulae take over the job of holding the head, which is where the ache and the tender knot on top of the shoulder come from. The fast one is impact: a head-to-shoulder collision chasing a dig, a pancake or dive where the chin or forehead reaches the floor and the head is thrown backwards, or a hard-driven ball catching the side of the head and snapping the neck sideways. Beach and grass add landings where one arm plants in the sand and the head keeps rotating against a body that has already stopped.",
    "signs": [
      "Pain and stiffness on one side, worst turning the head that way, and usually worse the morning after the session or the collision.",
      "Having to turn your whole trunk to see the setter or pick up a ball coming from behind you.",
      "A tight, tender band running from the base of the skull down to the top of the shoulder blade.",
      "A headache starting at the base of the skull and spreading up behind the eye on the same side.",
      "Pain when you look up at a toss, arch back for a back set, or reach up to block.",
      "Ache that builds through a session and settles overnight at first, then stops settling."
    ],
    "red_flags": [
      "Numbness, tingling, weakness or a heavy dead feeling running into the arm or hand, or dropping things and fumbling with that hand. That points at a nerve root, not a muscle.",
      "After a collision or a head-to-floor landing: severe pain right on the midline bones of the neck, inability to turn the head about 45 degrees each way, pins and needles in both arms or in the legs, or an electric shock down the spine when you tip your chin to your chest. Do not let anyone move you, call emergency services.",
      "Neck pain together with any concussion signs such as headache, fog, nausea or vision changes. The two injuries very often arrive in the same moment.",
      "Neck pain with dizziness, double vision, slurred speech, unsteady walking or numbness in the face, particularly after the neck was whipped. That can be a blood vessel injury and is an emergency.",
      "Fever, unexplained weight loss, night pain that wakes you and will not settle in any position, or a history of cancer alongside the neck pain."
    ],
    "phases": [
      {
        "name": "Angry and guarded",
        "goal": "Get the neck out of the held, protected position and moving inside a comfortable range, and get someone to rule out the things that are not a strain.",
        "typical_window": "the first 3 to 10 days",
        "markers": [
          "Rotation towards the sore side is clearly limited and sharp at the end of range.",
          "Stiffest first thing in the morning, and sleep is disturbed by it.",
          "Gentle movement eases the stiffness within a few minutes rather than sharpening it. If movement consistently makes it worse, the working assumption is wrong.",
          "No symptoms in the arm at any point."
        ]
      },
      {
        "name": "Range back, endurance not yet",
        "goal": "Near-full pain-free movement in every direction, and the start of holding the head steady under load instead of only moving it freely.",
        "typical_window": "roughly 1 to 4 weeks",
        "markers": [
          "Rotation is close to matching the other side and morning stiffness clears within minutes.",
          "Looking up at a toss no longer catches.",
          "The neck still fatigues and aches by the end of a light session even though the range is there.",
          "Ball control and defensive work come back before serving and hitting."
        ]
      },
      {
        "name": "Reloading the overhead work",
        "goal": "Rebuild serving and hitting volume and find out whether the neck tolerates the day after, which is the honest test rather than how it feels mid-session.",
        "typical_window": "2 to 6 weeks from onset for a straightforward strain, and 6 to 12 weeks or longer when it started with a collision or when arm symptoms were part of it",
        "markers": [
          "A serving set at controlled pace produces no flare the next morning.",
          "Head position stays steady through the hitting motion instead of the whole trunk swinging round to compensate.",
          "Diving, rolling and pancaking happen without bracing or protecting the neck.",
          "Any leftover ache is shrinking week to week rather than sitting at the same level."
        ]
      }
    ],
    "prevention": [
      "Chin tuck holds lying on your back, head lifted just clear of the floor with the chin drawn in and the neck long. These deep neck flexors decelerate the head when the trunk whips through at spike contact, and they fatigue across a hitting session, which is when the upper trap starts taking the load.",
      "Isometric neck holds in all four directions against your own hand or a wall, built up gradually. A neck that resists being moved passes less force into passive tissue when a shoulder or a hard-driven ball reaches your head.",
      "Prone Y and T raises, band pull-aparts and face pulls for the mid and lower trapezius. Hitters and passers live in a forward-head, rounded-shoulder position, which leaves the levator and upper trap holding the head up for hundreds of reps.",
      "Thoracic extension over a foam roller and open-book rotations for the mid back. If the upper back will not extend, the neck has to extend further to get the eyes under a set or a toss, and the same two or three segments absorb all of it.",
      "Fix the serve toss so it stays in front and you track the ball with your eyes rather than by cranking the head and trunk backwards. A toss behind the head forces end-range neck extension on every single serve, which for a jump server is hundreds a week."
    ],
    "return_markers": [
      "Full rotation both directions, pain free, and broadly matching the uninjured side.",
      "A full session of serving and hitting produces no increase in stiffness the following morning.",
      "No arm symptoms at all, during play or afterwards.",
      "Able to hold the head steady looking up through a full hitting line without the neck complaining.",
      "Able to dive, roll and pancake without guarding or bracing the neck on the way down."
    ],
    "loads": [
      "serve",
      "attack",
      "set",
      "dig"
    ]
  },
  {
    "slug": "sport-related-concussion",
    "name": "Concussion (sport-related concussion)",
    "also_called": [
      "getting your bell rung",
      "head knock",
      "ball to the head",
      "getting dinged"
    ],
    "region": "head",
    "triage": "urgent",
    "summary": "A brain injury from a hit to the head or body. You do not have to be knocked out, and you do not go back on court that day.",
    "what_it_is": "A concussion is a brain injury caused by force transmitted to the head, either directly or through the body. The brain is shaken inside the skull and brain cells stop handling energy normally for a period of days to weeks. Nothing shows up on a standard scan, which is why concussions get waved off as nothing. There is no mild version you can play through, and the diagnosis is the same whether you were knocked out or just felt strange for ten minutes.",
    "how_it_happens": "Three patterns account for almost every volleyball concussion. A hard-driven ball hits the head at close range: a blocker taking a swing in the face from two metres away, a defender inside the ten foot line, or a passer catching a jump serve flush. Two players chase the same dig and collide in the seam, usually head to shoulder or head to head, and the head takes the whip. Third, the head reaches the floor, in a dive or a pancake that runs out of arm, or a bad landing off a block that puts the back of the head down, and on beach or grass a head-first landing into ground that is harder than it looks.",
    "signs": [
      "Headache or a feeling of pressure in the head, either straight away or building over the next day or two.",
      "Feeling foggy, slowed down or just not right, losing track of the rotation or the play call.",
      "Dizziness, feeling off balance, or the gym suddenly seeming too bright or too loud.",
      "Nausea, blurred or double vision, losing the ball in flight, reacting to the hitter late.",
      "Being unusually irritable, tearful or flat, and sleeping badly or far more than usual in the days after.",
      "Symptoms that get worse with reading, screens, or anything that raises your heart rate."
    ],
    "red_flags": [
      "Knocked out at all, even for a second, a seizure or convulsion, or a stretch of time you cannot remember. Emergency care.",
      "Headache that keeps getting worse, repeated vomiting, growing confusion or agitation, or becoming hard to rouse. Call emergency services.",
      "Neck pain or tenderness right on the bones of the neck alongside the head injury, or numbness, tingling or weakness in the arms or legs. Treat it as a possible spinal injury, do not move the player, call emergency services.",
      "Unequal pupils, slurred speech, double vision that does not clear, or weakness down one side of the body.",
      "Clear fluid or blood from the nose or ear, or bruising appearing behind the ear or around both eyes after a hard impact. Possible skull fracture."
    ],
    "phases": [
      {
        "name": "Off the court, first day or two",
        "goal": "Get the injury recognised and assessed and let the sharpest symptoms settle. The player is done for the day the moment a concussion is suspected. There is no version of this where they finish the set.",
        "typical_window": "the first 24 to 48 hours",
        "markers": [
          "The player is out for the day even if they feel fine, because symptoms commonly arrive hours later.",
          "Someone is with them for the first night and knows the red flags above.",
          "Screens, loud gyms and heavy mental work are cut back, but total dark-room rest is not the aim and tends to slow recovery.",
          "Seen by a doctor or other clinician who manages concussion, ideally within the first day."
        ]
      },
      {
        "name": "Light activity that does not stir symptoms",
        "goal": "Ordinary daily life plus easy movement such as walking or a stationary bike at an effort that barely nudges symptoms, and a staged return to school or work. Getting light aerobic work going early tends to shorten recovery rather than drag it out.",
        "typical_window": "roughly day 2 to the end of week one, sometimes longer",
        "markers": [
          "Easy exercise can be done without a clear spike in headache or fog.",
          "Most of a normal school or work day is manageable, with screens tolerated.",
          "Symptoms are trending down day to day rather than swinging up and down.",
          "Sleep is moving back towards normal."
        ]
      },
      {
        "name": "Volleyball movement with no chance of contact",
        "goal": "Reintroduce the visual, balance and jumping demands of the sport: footwork, ball control, jumping, serving, hitting on a controlled toss, all with no risk of another head impact. Steps are typically held at least a day each and symptoms returning means dropping back a step, which is why this is run by the clinician managing the case and not self-administered.",
        "typical_window": "usually somewhere in week one to week three",
        "markers": [
          "Running, jumping and change of direction produce no symptoms.",
          "Tracking a ball, spinning out of a dig and looking up under a set no longer bring on dizziness or headache.",
          "Full-effort conditioning is tolerated.",
          "No symptoms during the session and none in the hours afterwards, since delayed symptoms count."
        ]
      },
      {
        "name": "Full training, clearance, then matches",
        "goal": "Return to full practice including blocking at the net, digging in traffic and receiving hard serves, and then be formally cleared by the clinician before a first match. Clearance comes before competition, not after it.",
        "typical_window": "most adults are cleared somewhere between 2 and 4 weeks; under-18s commonly take longer, and roughly one in five to one in three run past a month",
        "markers": [
          "Full contact-equivalent practice completed with no symptoms during or after.",
          "The clinician managing the case has cleared the player, in writing where the club asks for it.",
          "Any academic or workplace adjustments the injury required have been dropped.",
          "Ball tracking and reaction speed are back at match pace, not just close enough."
        ]
      }
    ],
    "prevention": [
      "Isometric neck holds in four directions, resisting your own hand or a wall at the forehead, back of the head and each side, held steady and built up over weeks. A stronger, stiffer neck means the head accelerates less when a ball or a teammate's shoulder hits it, and most volleyball players never train the neck at all.",
      "Chin tuck holds lying on your back, head just off the floor with the chin drawn in. These deep neck flexors control the whip of the head and they also protect the neck itself, which is frequently injured in the same moment as the brain.",
      "Blocking technique work with a coach hitting controlled balls at the block: press over with the eyes open and hands wide rather than turning the head away. Face contacts at the net come from flinching and closing the eyes at the last instant.",
      "Rehearse loud, early calls on short balls, free balls and anything landing in the seam between a defender and a chasing setter. Head-to-head collisions in volleyball nearly always happen where two players both went and neither called it.",
      "Peripheral awareness drills from defensive posture, such as a partner calling numbers or dropping a ball while you read the hitter's arm. Most head contacts come from a ball or a body you did not see coming.",
      "Clear the environment before you play: pad or move the referee stand, keep ball carts and benches back off the court, and on beach or grass walk the area for buried hard objects. A head that hits a cart is a worse injury than a head that hits a floor."
    ],
    "return_markers": [
      "Symptom free at rest and through full-effort conditioning, with nothing appearing in the hours afterwards.",
      "Back to a full school or work load, including screens, without symptoms.",
      "Completed the whole stepwise progression, including full-speed non-contact volleyball and then full practice, without symptoms at any stage.",
      "Cleared by a clinician who manages concussion, before the first match rather than after it.",
      "Sleep, mood and concentration back at your own baseline, and ball tracking normal rather than half a beat late."
    ],
    "loads": [
      "block",
      "dig",
      "pass"
    ]
  },
  {
    "slug": "medial-tibial-stress-syndrome",
    "name": "Shin splints",
    "also_called": [
      "medial tibial stress syndrome",
      "MTSS",
      "shin pain"
    ],
    "region": "calf",
    "triage": "self_manage",
    "summary": "Aching along the inside edge of the shin bone that comes on with jumping and settles with rest, and is the body objecting to a jump in load rather than an injury to any one structure.",
    "what_it_is": "Irritation of the bone surface and the soft tissue attaching to it along the inner border of the tibia. It sits on a spectrum: at the mild end the tissue is simply overloaded and recovers quickly, and at the far end the bone itself is stressed and heading toward a stress fracture. The difference matters because the treatment is the same at first and the timeline is not.",
    "how_it_happens": "Volleyball is jumping and landing, hundreds of times a session, and the shin takes the shock every time. It shows up when the load changes faster than the bone can adapt: preseason after a quiet summer, a move from one session a week to four, a switch from a sprung indoor floor to a hard gym or a beach court, or new shoes with less under the heel. Sand cuts both ways here, softening the landing while making every push-off longer and harder.",
    "signs": [
      "A diffuse ache along the inner edge of the shin, over a stretch of several centimetres rather than one point.",
      "Sore at the start of a session, easing as you warm up, then worse afterwards and the next morning.",
      "Tender to press along that inner border, over a broad area.",
      "Both legs often, though usually one is worse.",
      "Settles within a day or two of resting, and returns at the same point in the next hard session."
    ],
    "red_flags": [
      "Pain that narrows to one small point you can cover with a fingertip, especially if pressing it is sharp.",
      "Pain that continues at rest or wakes you at night.",
      "Pain that no longer warms up but gets worse through a session.",
      "Swelling over the bone, or pain on hopping on that leg alone.",
      "Any of the above in a player with low energy availability, missed periods, or a previous stress fracture."
    ],
    "phases": [
      {
        "name": "Settle the load",
        "goal": "Get the shin out of the range that is aggravating it without stopping everything.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Jumping volume cut, not necessarily to zero: skills, ball control and upper body work continue.",
          "Walking and daily life are pain free.",
          "Morning soreness is gone or nearly gone.",
          "Footwear and surface have been looked at rather than assumed."
        ]
      },
      {
        "name": "Build the tissue",
        "goal": "Make the calf, foot and shin tolerate load again, and address why the load spiked.",
        "typical_window": "3 to 6 weeks",
        "markers": [
          "Calf raise strength and endurance is building, both straight and bent knee.",
          "Hopping on that leg is comfortable.",
          "Jump volume is climbing gradually rather than returning to where it was.",
          "No return of morning soreness as volume rises."
        ]
      },
      {
        "name": "Back to full jumping",
        "goal": "Return to full training volume with the load progressed rather than resumed.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Full practice without symptoms during or after.",
          "Repeat jumping and blocking sequences are comfortable.",
          "The week's jump count is being tracked, at least roughly.",
          "Confident landing and pushing off on that leg."
        ]
      }
    ],
    "prevention": [
      "Build calf raises to real capacity: straight-knee for the gastrocnemius and bent-knee for the soleus, working toward sets in the twenties on one leg. The soleus takes several times body weight on landing, and a weak one hands that load to the shin.",
      "Add a foot intrinsic routine, arch doming and toe spreading, especially if you play barefoot on sand. The foot is the first shock absorber and beach players train everything above it and nothing in it.",
      "Progress jump volume by roughly ten percent a week rather than by however many sessions the schedule happens to hold, and treat a tournament week as the spike it is.",
      "Land quietly and through the whole foot rather than slapping flat. Noise on landing is load that went somewhere, and it is a cue a partner can give you from the sideline.",
      "Replace shoes before the midsole is dead, and be honest about the change when you move between a sprung floor, a hard gym floor, grass and sand in the same month.",
      "Eat enough for the training you are actually doing. Bone adapts to load only when there is energy to build with, and shin pain in an underfuelled player is a different and more serious conversation."
    ],
    "return_markers": [
      "No pain during or after a full session, and none the following morning.",
      "Able to hop 20 times on the affected leg without pain.",
      "Calf raise strength and endurance comparable side to side.",
      "Full jump volume reached by progression rather than by jumping straight back in.",
      "No tenderness to press along the shin."
    ],
    "loads": [
      "attack",
      "block",
      "serve"
    ]
  },
  {
    "slug": "peroneal-tendinopathy",
    "name": "Peroneal tendinopathy",
    "also_called": [
      "peroneal tendinitis",
      "outside ankle tendon pain",
      "fibularis tendinopathy"
    ],
    "region": "ankle",
    "triage": "self_manage",
    "summary": "Pain in the tendons running behind and below the bony bump on the outside of the ankle, from the constant small corrections a soft or uneven surface demands.",
    "what_it_is": "Overload of the peroneal tendons, which run down the outside of the lower leg, hook behind the outer ankle bone and attach under the foot. Their job is to turn the foot outward and, more importantly here, to stop it rolling inward. In a tendinopathy the tendon has been asked for more than it can currently supply and has become irritated and sore rather than torn.",
    "how_it_happens": "These tendons are the ankle's brake against rolling over, and every step in sand asks them to work. They flare after a spell of beach or grass volleyball, after a lateral ankle sprain when the ankle is relying on them for stability it used to get from ligament, and in players who habitually land slightly on the outside of the foot. Uneven ground, an unraked court, or a partner's foot underfoot all add sudden demand.",
    "signs": [
      "Pain behind or just below the bony bump on the outside of the ankle.",
      "Worse with pushing off, cutting, or walking on soft or uneven ground.",
      "Tender to press along the tendon rather than over the bone itself.",
      "Sometimes a swelling or thickening you can feel along the tendon line.",
      "Often follows a period of increased beach play, or an old ankle sprain that never fully rehabilitated."
    ],
    "red_flags": [
      "A snapping or clicking sensation as the tendon moves over the bone, especially with a feeling of it slipping out of place.",
      "Sudden inability to turn the foot outward against resistance.",
      "Marked swelling, bruising, or an inability to bear weight.",
      "Pain over the bone itself rather than the tendon, which needs a fracture ruled out.",
      "Numbness or pins and needles into the foot."
    ],
    "phases": [
      {
        "name": "Calm it down",
        "goal": "Reduce the daily provocation while keeping the tendon loaded enough not to deteriorate.",
        "typical_window": "1 to 2 weeks",
        "markers": [
          "Walking and stairs are comfortable.",
          "Isometric holds turning the foot outward can be done without pain.",
          "The aggravating volume, usually sand hours, has been cut rather than pushed through.",
          "Pain settles within 24 hours of activity rather than lingering."
        ]
      },
      {
        "name": "Load the tendon",
        "goal": "Build capacity in the peroneals and the whole ankle rather than resting and hoping.",
        "typical_window": "4 to 8 weeks",
        "markers": [
          "Resisted eversion is getting stronger and is comfortable through range.",
          "Single-leg balance is steady, including on an unstable or soft surface.",
          "Calf raises are strong both straight and bent knee.",
          "Hopping and lateral movement are tolerable."
        ]
      },
      {
        "name": "Back to the surface",
        "goal": "Return to full play on the surface that caused it, at a volume the tendon can hold.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Cutting and lateral defensive movement are pain free.",
          "A full session on sand is tolerated without a flare the next day.",
          "Confidence pushing off the outside of the foot.",
          "Symptoms do not return as the weekly hours climb."
        ]
      }
    ],
    "prevention": [
      "Train resisted eversion directly, turning the foot outward against a band for sets of fifteen to twenty. Almost nobody trains this direction, and it is the exact action these tendons exist for.",
      "Build single-leg balance on a soft surface, thirty to sixty seconds a side, eyes open then closed. Sand is an unstable surface and the ankle needs to be trained on one.",
      "Rehabilitate ankle sprains properly rather than to the point where they stop hurting. A ligament that never regained its stability leaves the peroneals doing its job every session.",
      "Build beach volume gradually when you move outdoors for a season, rather than going from indoor courts to five sand sessions a week in the first fortnight.",
      "Rake or walk the court before playing, and level obvious holes. Most sudden ankle loads outdoors come from a foot landing somewhere it did not expect.",
      "Strengthen the calf as a whole, both straight and bent knee, so the peroneals are not the only structure controlling the ankle when you are tired."
    ],
    "return_markers": [
      "Full pain-free range turning the foot in and out.",
      "Eversion strength comparable side to side.",
      "Able to hop and cut on the leg without pain.",
      "A full session on the aggravating surface without a next-day flare.",
      "No tenderness along the tendon."
    ],
    "loads": [
      "dig",
      "block",
      "attack"
    ]
  },
  {
    "slug": "metatarsal-stress-fracture",
    "name": "Metatarsal stress fracture",
    "also_called": [
      "march fracture",
      "foot stress fracture",
      "forefoot stress injury"
    ],
    "region": "ankle",
    "triage": "get_assessed",
    "summary": "A crack developing in one of the long bones of the forefoot from repeated load, common in barefoot sand players, and one of the injuries where playing through it makes the timeline much longer.",
    "what_it_is": "A stress injury to one of the metatarsals, the long bones running from the midfoot to the toes. Repeated loading outpaces the bone's ability to repair, and what starts as a stress reaction becomes a true fracture line. The second and third metatarsals take the most load and are the most commonly affected; a fracture at the base of the fifth has a poorer blood supply and is managed differently, which is one reason this needs imaging rather than a guess.",
    "how_it_happens": "Push-off in sand loads the forefoot heavily and repeatedly, and beach players do it barefoot with no midsole between the bone and the ground. It builds over weeks rather than arriving in one moment: a preseason volume jump, a tournament block, a move from indoor shoes to barefoot sand, or a long stretch of jumping on hard ground. Low energy availability makes it far more likely, because bone cannot repair on a deficit.",
    "signs": [
      "Pain in the forefoot that you can point to with one finger.",
      "Worse with push-off, jumping and running, better with rest at first.",
      "Progressively less activity is needed to bring it on.",
      "Tender to press directly on the bone, sometimes with swelling on the top of the foot.",
      "Aching after the session and the following morning."
    ],
    "red_flags": [
      "Pain at rest or at night, which suggests the injury has progressed.",
      "Inability to bear weight, or a limp you cannot hide.",
      "Pain at the base of the fifth metatarsal, on the outer edge of the midfoot, which heals poorly and often needs specific management.",
      "Any suspected stress fracture in a player with low energy availability, disordered eating, or absent periods.",
      "Sudden sharp pain with a pop, which may be a complete fracture."
    ],
    "phases": [
      {
        "name": "Diagnosis and offloading",
        "goal": "Confirm what it is and take the load off so the bone can heal.",
        "typical_window": "2 to 6 weeks",
        "markers": [
          "Imaging has been done: an early stress fracture often does not show on plain x-ray.",
          "Walking is pain free, in a boot or stiff-soled shoe if that is what it takes.",
          "No jumping or running at all.",
          "Fitness maintained through non-impact work such as cycling or swimming."
        ]
      },
      {
        "name": "Reload the bone",
        "goal": "Return load gradually and rebuild the foot and calf.",
        "typical_window": "3 to 6 weeks",
        "markers": [
          "Walking normally without pain or tenderness.",
          "Foot intrinsic and calf strength work underway.",
          "Impact reintroduced in small, controlled doses on a firm surface first.",
          "No symptoms in the 24 hours after each step up."
        ]
      },
      {
        "name": "Back to sand",
        "goal": "Return to full volleyball including the surface that caused it.",
        "typical_window": "3 to 6 weeks",
        "markers": [
          "Jumping and landing pain free on a firm surface.",
          "Barefoot sand work reintroduced gradually rather than resumed.",
          "Full practice tolerated without next-day pain.",
          "Training load being tracked, and the cause understood rather than repeated."
        ]
      }
    ],
    "prevention": [
      "Build barefoot sand volume gradually, especially in the first month of a beach season. Going from shod indoor courts to daily barefoot sand is the single most common way this arrives.",
      "Train the foot itself: arch doming, toe spreading and short-foot holds, several sets most days. Beach players load the forefoot harder than anyone and rarely strengthen it.",
      "Build calf capacity straight and bent knee, so the forefoot is not absorbing load a strong calf should be taking.",
      "Eat and sleep for the training you are doing. Bone is living tissue that remodels only with enough energy, and stress fractures cluster in underfuelled athletes.",
      "Wear shoes off the court during a heavy beach block rather than staying barefoot all day, so the forefoot gets some hours of reduced load.",
      "Treat a new, localised forefoot ache as a load question immediately rather than a fortnight later. A stress reaction caught early costs weeks; a fracture costs months."
    ],
    "return_markers": [
      "No tenderness when pressing directly on the bone.",
      "Pain-free hopping and jumping on a firm surface.",
      "Full sessions on sand without pain during or afterwards.",
      "Cleared by the clinician who managed the injury.",
      "The training load that caused it has actually changed."
    ],
    "loads": [
      "attack",
      "block",
      "serve"
    ]
  },
  {
    "slug": "wrist-extension-impingement",
    "name": "Wrist impingement",
    "also_called": [
      "dorsal wrist impingement",
      "back of wrist pain",
      "wrist extension pain"
    ],
    "region": "hand",
    "triage": "self_manage",
    "summary": "Pinching pain across the back of the wrist at full extension, felt when blocking, setting or pressing up off the floor.",
    "what_it_is": "Compression of the soft tissue at the back of the wrist when the joint is taken to its end range of extension under load. The tissue between the bones gets pinched repeatedly and becomes irritated and thickened, which narrows the space further. It is a mechanical and load problem rather than damage to a specific structure, which is why it usually responds well to changing how the wrist is loaded.",
    "how_it_happens": "Blocking puts the wrist into extension with a ball hitting it. Setting loads it at the top of the range hundreds of times a session. Pressing up off the floor after a dig does the same with body weight behind it. It tends to appear in players with limited wrist extension range or weak forearms, and in beach players pushing up out of the sand repeatedly.",
    "signs": [
      "A sharp pinch at the back of the wrist when you bend it fully back.",
      "Worse blocking, setting, or pushing up off the floor.",
      "Usually little or no pain with the wrist in neutral.",
      "Sometimes a tender spot or slight swelling on the back of the wrist.",
      "Grip strength is normal, which distinguishes it from most tendon problems."
    ],
    "red_flags": [
      "Pain following a fall onto an outstretched hand, which needs a fracture ruled out, particularly at the base of the thumb.",
      "Numbness, pins and needles, or weakness in the hand.",
      "Marked swelling, deformity, or inability to move the wrist.",
      "Pain that persists at rest or wakes you at night.",
      "A lump that is growing rather than settling."
    ],
    "phases": [
      {
        "name": "Get out of the pinch",
        "goal": "Stop repeatedly loading the exact position that hurts.",
        "typical_window": "1 to 2 weeks",
        "markers": [
          "Push-ups and floor presses done on fists or handles rather than flat palms.",
          "Setting volume reduced, with bump setting used where it is legal and sensible.",
          "Daily activities are comfortable.",
          "Symptoms settle rather than accumulate across a week."
        ]
      },
      {
        "name": "Build the forearm",
        "goal": "Strengthen the wrist through range so the end position is supported rather than raw.",
        "typical_window": "3 to 6 weeks",
        "markers": [
          "Wrist extension and flexion strength work is progressing.",
          "Extension range is improving and comfortable.",
          "Loaded positions such as a plank on flat hands are tolerable.",
          "Blocking a controlled ball does not provoke it."
        ]
      },
      {
        "name": "Back to full load",
        "goal": "Return to full blocking, setting and floor work.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Full setting volume without a flare.",
          "Blocking hard-hit balls comfortably.",
          "Pushing up out of the sand repeatedly without pinching.",
          "No morning stiffness after a heavy session."
        ]
      }
    ],
    "prevention": [
      "Build forearm strength in both directions, wrist curls and reverse wrist curls, two or three sets a few times a week. A strong forearm supports the end of the range instead of collapsing into it.",
      "Work wrist extension range gently and regularly, hands on a table with fingers pointing back, rocking into range without forcing the pinch.",
      "Press up off a fist or a handle rather than a flat palm when your wrists are sore, so you keep training without repeating the exact provoking position.",
      "Get setting technique looked at: a set caught deep with the wrist collapsed backwards loads the joint far more than one contacted with a firm, shaped hand.",
      "Build up beach volume gradually, because pushing out of sand loads the wrist in extension over and over in a way indoor play does not.",
      "Warm the wrists up before blocking and setting rather than making the first hard ball of the session the first thing they meet."
    ],
    "return_markers": [
      "Full pain-free wrist extension under body weight.",
      "Forearm strength comparable side to side.",
      "A full setting session without pain during or afterwards.",
      "Blocking hard balls without a pinch.",
      "No swelling or tenderness at the back of the wrist."
    ],
    "loads": [
      "block",
      "set",
      "dig"
    ]
  },
  {
    "slug": "prepatellar-bursitis",
    "name": "Prepatellar bursitis",
    "also_called": [
      "housemaid's knee",
      "kneecap bursitis",
      "swollen kneecap"
    ],
    "region": "knee",
    "triage": "get_assessed",
    "summary": "A soft, swollen lump sitting directly on the front of the kneecap after repeated diving and landing on the knees, which looks alarming and is usually straightforward unless it is infected.",
    "what_it_is": "Inflammation of the bursa, a small fluid-filled cushion that sits between the kneecap and the skin to let them slide over each other. Repeated impact or pressure makes it fill with fluid, producing a swelling you can see and move that sits on top of the kneecap rather than inside the joint. That distinction matters: the knee joint itself is usually fine.",
    "how_it_happens": "Diving and sliding onto the knees does it, which in volleyball means defence, pancakes and any dig that ends on the floor. It builds up over a run of heavy defensive sessions, or arrives after one hard landing on a knee. Grass and sand are kinder here than a gym floor, but an abrasion on any surface can let bacteria in, which turns a mechanical problem into an infected one.",
    "signs": [
      "A soft, squashy swelling directly over the kneecap that moves under the skin.",
      "Sore to kneel on, often more uncomfortable than genuinely painful.",
      "The knee bends and straightens normally and feels stable.",
      "No swelling inside the joint itself.",
      "Often follows a run of diving-heavy sessions or one hard landing."
    ],
    "red_flags": [
      "Redness, heat, or skin that looks angry over the swelling.",
      "Fever, feeling unwell, or spreading redness up or down the leg, which suggests infection and needs same-day care.",
      "A break in the skin, graze or cut over the swelling.",
      "Rapidly increasing pain or swelling.",
      "Inability to bend the knee, or swelling inside the joint rather than on top of it."
    ],
    "phases": [
      {
        "name": "Rule out infection and settle it",
        "goal": "Confirm it is not infected, then take the pressure off.",
        "typical_window": "1 to 2 weeks",
        "markers": [
          "No redness, heat or fever, or infection has been treated.",
          "Kneeling avoided, and diving onto the knee stopped for now.",
          "Swelling reducing rather than growing.",
          "Full knee range and normal walking."
        ]
      },
      {
        "name": "Protect and rebuild",
        "goal": "Get back to defensive work without reloading the bursa immediately.",
        "typical_window": "2 to 4 weeks",
        "markers": [
          "Swelling largely resolved.",
          "Kneepads in use, and the landing technique looked at rather than assumed.",
          "Lower-limb strength work continuing throughout.",
          "Controlled dives onto a mat tolerated."
        ]
      },
      {
        "name": "Back to defence",
        "goal": "Full defensive volume without the swelling returning.",
        "typical_window": "1 to 3 weeks",
        "markers": [
          "Full dig and pancake volume without recurrence.",
          "Kneeling is comfortable.",
          "No swelling after a heavy defensive session.",
          "Landing technique has actually changed if that was the cause."
        ]
      }
    ],
    "prevention": [
      "Wear kneepads that still have padding in them, and position them over the kneecap rather than pushed down the shin. Most volleyball kneepads are worn until they are decorative.",
      "Learn to slide and roll rather than land square on the kneecap. A dig that finishes along the thigh and hip spreads the impact; one that finishes on the point of the knee concentrates it.",
      "Build quad and hip strength so you can get low and stay low, which means reaching more balls without dropping onto the knee at all.",
      "Clean and cover any graze over the kneecap properly. An infected bursa is a different and more serious problem, and it starts with broken skin.",
      "On grass and sand, check the court for stones, shells and glass before a defensive session, because the surface hides them and a knee finds them.",
      "Cut diving volume during a heavy tournament block rather than adding to it, and let the bursa recover between competition weekends."
    ],
    "return_markers": [
      "Swelling resolved and the kneecap looks like the other one.",
      "Kneeling comfortable.",
      "Full defensive session including dives without recurrence.",
      "No redness, heat or signs of infection.",
      "Kneepads and landing technique addressed rather than ignored."
    ],
    "loads": [
      "dig",
      "pass"
    ]
  }
];

/** One entry by slug, or undefined. */
export function rehabBySlug(slug: string): RehabEntry | undefined {
  return REHAB.find((e) => e.slug === slug);
}
