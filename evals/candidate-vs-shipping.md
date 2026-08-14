# Candidate reader vs shipping reader, on real player clips

47 clips every Vollyio user has actually uploaded, read by both models
through the identical prompt and schema. `shipped` is the number the
player was shown at the time, from whichever path was live then.

| | shipping (3.6-flash) | candidate (3.1-pro) |
|---|---|---|
| min / median / max | 71 / 78 / 92 | **18 / 62 / 88** |
| sd | 5.0 | **17.1** |
| range used | 21 | **70** |

## Every clip, biggest disagreement first

| clip | skill | shipped | flash | pro | flash - pro |
|---|---|---|---|---|---|
| prod-02eb77fa | attack | 63 | 78 | **18** | 60 |
| prod-22bee58a | attack | 86 | 79 | **32** | 47 |
| prod-da4dd9e5 | set | 75 | 78 | **32** | 46 |
| prod-01657590 | attack | 76 | 79 | **38** | 41 |
| prod-2873531a | attack | 48 | 78 | **42** | 36 |
| prod-5189ea5e | attack | 42 | 78 | **42** | 36 |
| prod-9c5ceb12 | attack | 63 | 78 | **42** | 36 |
| prod-207a5a24 | set | 74 | 78 | **44** | 34 |
| prod-945b7103 | attack | 70 | 83 | **52** | 31 |
| prod-1d9c1409 | attack | 61 | 79 | **48** | 31 |
| prod-18dbaece | set | 64 | 78 | **48** | 30 |
| prod-13ee336b | attack | 62 | 71 | **43** | 28 |
| prod-67d7d515 | attack | 74 | 79 | **52** | 27 |
| prod-910c0d77 | attack | 64 | 76 | **50** | 26 |
| prod-705fb8c9 | attack | 51 | 74 | **48** | 26 |
| prod-28a1aa72 | set | 76 | 78 | **58** | 20 |
| prod-d9a34f8f | set | 77 | 81 | **62** | 19 |
| prod-204a9569 | attack | 0 | 81 | **62** | 19 |
| prod-db19ba5c | set | 75 | 79 | **62** | 17 |
| prod-10b14975 | attack | 52 | 77 | **60** | 17 |
| prod-0ff74323 | set | 68 | 79 | **62** | 17 |
| prod-ea2e536e | attack | 65 | 74 | **60** | 14 |
| prod-7f0fbc23 | attack | 81 | 90 | **79** | 11 |
| prod-4886ba9c | set | 60 | 78 | **68** | 10 |
| prod-20b66ca2 | attack | 68 | 78 | **68** | 10 |
| prod-a49925a7 | attack | 89 | 92 | **82** | 10 |
| prod-21f56a0c | serve | 76 | 71 | **62** | 9 |
| prod-eed9f542 | set | 79 | 81 | **72** | 9 |
| prod-c09f59f4 | attack | 76 | 81 | **72** | 9 |
| prod-45f6ee8b | attack | 48 | 81 | **73** | 8 |
| prod-cda226e1 | set | 73 | 76 | **68** | 8 |
| prod-3858b2b4 | pass | 87 | 78 | **72** | 6 |
| prod-2c82a59e | set | 90 | 74 | **68** | 6 |
| prod-40ca3c40 | attack | 75 | 92 | **88** | 4 |
| prod-cd3fe7d8 | attack | 89 | 85 | **82** | 3 |
| prod-4e78b124 | attack | 70 | 89 | **88** | 1 |
| prod-cc267048 | set | 61 | 74 | **73** | 1 |
| prod-5e3775e0 | attack | 53 | 88 | **88** | 0 |
| prod-dc008f22 | set | 76 | 73 | **73** | 0 |
| prod-70995c73 | serve | 71 | 72 | **72** | 0 |
| prod-ef4f5e7c | attack | 83 | 84 | **86** | -2 |
| prod-01f707ac | set | 65 | 78 | **82** | -4 |
| prod-2b74cb9e | attack | 89 | 83 | **88** | -5 |
| prod-9435760b | attack | 63 | 81 | **error** |  |
| prod-8671aaec | attack | 78 | 76 | **refused** |  |
| prod-6d619200 | attack | 61 | - | **53** |  |
| prod-706ea215 | attack | 81 | refused | **48** |  |

## The ten widest disagreements, with what each model said

### prod-02eb77fa (attack) — flash 78, pro 18

- flash: Solid jump attack with great contact height over the net; adding a stronger wrist snap at contact will yield more consistent topspin and downward power.
- pro: This is a beginner-level third contact where you push the ball over, but building a dynamic approach will let you get off the ground and actually swing at the ball.

### prod-22bee58a (attack) — flash 79, pro 32

- flash: A strong, dynamic attacking rep in the sand with excellent timing and high contact, which can be improved even further with a crisper wrist snap at peak height.
- pro: An improvised off-speed attack on sand, where building a structured, accelerating approach would greatly improve your jump and power.

### prod-da4dd9e5 (set) — flash 78, pro 32

- flash: A very clean, well-aligned setting rep that sets up your attacker well, which could be further improved by pushing a faster tempo to the pin.
- pro: You made a smart decision to put up a high ball out of system, but getting your feet to the spot earlier will make your delivery much more consistent.

### prod-01657590 (attack) — flash 79, pro 38

- flash: A strong, well-timed attacking rep with solid contact height over the net, where a faster closing approach will help maximize your vertical pop.
- pro: A rough attacking rep where a broad jump and a bent-arm contact cause the ball to catch the net; focusing on converting forward speed into vertical lift will give you the height needed for a clean swing.

### prod-2873531a (attack) — flash 78, pro 42

- flash: A strong, well-timed attack rep off transition where a deeper penultimate step will help drive maximum vertical elevation.
- pro: You have a recognizable approach, but jumping slightly early forces you under the ball, leading to a tough contact and a net error.

### prod-5189ea5e (attack) — flash 78, pro 42

- flash: Solid attacking rep with clean high contact and good timing; increasing closing approach speed will add even more power and vertical height.
- pro: An attacking rep where developing a structured approach and reaching for a higher contact point will significantly increase your power.

### prod-9c5ceb12 (attack) — flash 78, pro 42

- flash: A powerful, well-executed attack rep with great reach and pace, where minor adjustments to landing balance will increase consistency.
- pro: An attacking rep on sand where arriving early and underneath the ball forces a weak, bent-arm contact.

### prod-207a5a24 (set) — flash 78, pro 44

- flash: This is a clean, accurate setting rep with good hand shape and alignment, which could be made even more repeatable by establishing your footwork a fraction of a second earlier.
- pro: You get to the ball and square up well, but establishing a quicker, higher contact point will make your sets much cleaner and easier to hit.

### prod-945b7103 (attack) — flash 83, pro 52

- flash: A well-timed, high-contact outside attack that can be made even safer and more repeatable with balanced two-foot landings.
- pro: This is a developing attacking rep with good fundamental shape, and focusing on your jump timing to keep the ball in front of you will immediately improve your power and landing balance.

### prod-1d9c1409 (attack) — flash 79, pro 48

- flash: Solid attacking rep with well-timed jump and high contact, which can be improved further by driving harder into your approach takeoff on sand.
- pro: This is a controlled rep that successfully gets the ball over the net, but accelerating your approach and keeping your elbow high will unlock significantly more power.

