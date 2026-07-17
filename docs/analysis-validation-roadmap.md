# Analysis Validation and Coaching Calibration Roadmap

Status: proposed operating plan, 2026-07-16

## Objective

Make Sideout defensible for intermediate and expert players by validating each
layer of the analysis separately, emitting measurements only when they are
reliable, and calibrating coaching feedback to the largest trainable constraint
rather than a professional ideal.

## Decisions

1. Do not claim that the whole analysis is "95% accurate." That combines
   objective measurements with subjective coaching judgment and cannot be
   supported by one number.
2. The defensible 95% claim is narrower: on eligible clips, at least 95% of
   measurements Sideout chooses to emit fall within a published tolerance.
3. Measurement validity, measurement coverage, constraint diagnosis, score
   calibration, and run-to-run stability are separate gates. One cannot offset
   another.
4. The current 17-point skeleton is an evidence layer, not a full anatomical
   model. Missing fingers, hands, heels, feet, and depth must remain unknown.
5. Intermediate and expert are the primary calibration population. Existing
   professional footage remains a regression set, not the main product eval.
6. Player level changes coaching language, priority, and expected improvement.
   It does not change what the camera actually observed.

## Current-state audit

The repository currently proves implementation consistency, not end-to-end
correctness:

- The pose model emits 17 two-dimensional keypoints and maps them into a legacy
  33-slot data shape. Unavailable slots have zero visibility and depth is always
  zero.
- The D-021 validation showed browser output matches a reference decoder within
  pixel tolerances. It did not compare predicted joints with human-annotated
  anatomical ground truth.
- Metric confidence is a heuristic built from keypoint visibility, detector fit,
  and a hand-set reliability factor. A model confidence value is not an observed
  probability that the measurement is correct.
- `serve.contact_height` and `attack.jump_height` include heel landmarks in
  their confidence inputs even though the current model never emits heels. This
  suppresses those measurements and shows why each metric must be audited
  against the actual 17-point topology.
- The coaching prompt currently calls emitted measurements "trusted ground
  truth" before those measurements have passed a real-footage benchmark.
- The eval directory contains 23 professional-footage cases, of which 18 are
  active. All use the pro level, none contain captured measurement blocks, and
  most do not label a weakest constraint. It cannot measure calibration for the
  target population or whether Sideout finds their biggest constraint.
- The skill rubrics use elite execution language while a later prompt block
  re-anchors scores to an amateur ceiling. Conflicting anchors encourage
  severity drift even though the later block tries to correct it.

Research on pose confidence also finds that common keypoint confidence scores
are often miscalibrated relative to actual localization accuracy. Sideout must
calibrate its own thresholds against its own volleyball footage rather than
treat raw confidence as correctness.

## Quality architecture

```text
Capture eligibility
  -> target-player identity
  -> critical-joint localization
  -> derived measurement validity
  -> visible-constraint diagnosis
  -> score calibration
  -> next-action usefulness
```

Every transition has three possible outcomes: pass, omit the uncertain claim,
or ask for a better clip. The pipeline must never turn missing evidence into a
confident coaching statement.

## The 95% contract

Use this as the eventual product claim:

> On clips that meet Sideout's filming requirements, at least 95% of the
> measurements Sideout reports as measured are within the published tolerance.

Do not extend this sentence to the full score, the priority fix, or every frame
of every upload.

### Candidate measurement tolerances

Freeze these tolerances before labeling the locked validation set.

| Claim | Correct when | Release gate |
|---|---|---|
| Target-player identity | The selected athlete remains the tracked athlete | At least 99% of evaluated frames, with identity switches reported separately |
| Critical-joint localization | A visible tracked joint is within 10% of body height of the human label | At least 95% per critical joint group |
| Contact, plant, or landing timing | The event is within 2 frames at 30 fps of the human label | At least 95% of emitted events |
| Two-dimensional joint angle | The value is within 10 degrees of the annotated value from an eligible camera view | At least 95% of emitted angles |
| Body-relative distance | The value is within 0.10 body heights or 0.15 shoulder widths, as applicable | At least 95% of emitted distances |
| Abstention | An unobservable or unsupported checkpoint is omitted or marked unknown | At least 95% |

The final claim requires both an observed success rate of at least 98% and a
95% confidence lower bound of at least 95% across at least 300 annotated,
independently sampled events. Use player-level or clip-level resampling because
adjacent video frames are correlated. Any metric without enough examples remains
experimental and is excluded from the claim.

### Coverage cannot be hidden

Selective emission makes high precision possible, but Sideout must publish
coverage next to validity so it cannot reach 95% by saying almost nothing.

- Measurement validity target: at least 95% within tolerance.
- Eligible-rep coverage target: at least 70% of eligible reps emit two or more
  validated measurements.
- Unsupported-clip behavior: no score presented as measurement-grounded, plus a
  specific filming correction.

## Skeleton and joint pathway

### Treat two failure types differently

| Failure | Meaning | Correct response |
|---|---|---|
| Topology gap | The model does not produce the joint, such as fingers, hands, heels, feet, or depth | Do not draw or measure it. Replace the pose model only if that joint is essential to a validated product claim. |
| Localization gap | The model produces the joint but it drifts from the athlete | Benchmark detector crop, keypoint output, tracking, smoothing, occlusion, and filming angle. |

The skeleton should follow every supported joint accurately. It should not
pretend to follow every anatomical joint. Fine hand shape, wrist snap, foot
plant angle, net penetration, and true three-dimensional rotation cannot be
claimed from the current 17-point, two-dimensional output alone.

### Annotate the pose benchmark

Build a volleyball-specific set with at least 300 sampled frames from at least
12 players. Include:

- all six skills and all three disciplines;
- intermediate and expert players;
- contact, plant, landing, and neutral moments;
- front, side, diagonal, and known-bad views;
- indoor, sun, shade, motion blur, partial occlusion, and multiple players;
- varied clothing, body sizes, camera heights, and camera distances.

Annotate the 17 supported keypoints, target-player identity, visibility, and the
key skill event. Report accuracy by joint, skill, view, lighting, and occlusion.
Never report only a pooled average.

Hold out entire players, not random frames, so nearly identical frames from one
clip cannot appear in both calibration and validation.

### Camera eligibility

Each metric needs an allowed view. Examples:

- side or diagonal view for elbow angle, knee flexion, contact height, approach,
  and landing;
- front or diagonal view for platform angle, base width, and shoulder symmetry;
- no two-dimensional claim for rotation or separation when perspective makes
  the body lines ambiguous;
- no hand-shape or finger-contact claim when the hands are too small to resolve.

An angle classifier or explicit filming guide can increase coverage later. The
first validation should label view eligibility manually.

### Model replacement rule

Do not replace the pose model because a denser skeleton looks better. Replace it
only when a candidate improves validated downstream measurement coverage or
accuracy on the locked volleyball set while preserving target-player tracking,
supported devices, processing time, and privacy.

## Target-user coaching eval

### Dataset structure

Keep the current professional cases as a separate regression suite. Add:

1. Pilot suite: 36 clips, one for every combination of six skills, two target
   levels, and three disciplines.
2. Minimum target suite: 144 scoreable clips, four per combination. Use three
   for calibration and one locked holdout, split by player.
3. Abstention suite: at least 18 unscoreable clips, one per skill and discipline,
   covering missing contact, wrong player, distant athlete, blur, occlusion, and
   wrong action.
4. Repeatability suite: at least 24 locked clips run three times per release.

Use clips from the actual target population. Professional highlight footage is
too clean, too distant, too selectively edited, and too technically strong to
represent the user experience.

### Human labels

Two independent volleyball reviewers label each locked case before seeing the
Sideout output. Resolve disagreements through adjudication and retain the
original labels to measure human-to-human agreement.

Each case should include:

- `analysis_allowed`;
- player level and discipline;
- visible and unobservable checkpoints;
- an expected score midpoint and tolerance;
- one primary constraint and up to two acceptable alternatives;
- strongest observed quality;
- evidence frames for each claim;
- forbidden or unsupported claims;
- an actionability judgment for the recommended fix.

The system should not be held to 95% top-one agreement if qualified reviewers
do not reach 95% with each other. Human agreement is the ceiling and must be
reported beside model agreement.

## Coaching calibration

### One factual analysis, level-aware delivery

Keep a common target-population score scale for intermediate and expert users so
progress remains comparable. Level should alter:

- how much terminology is explained;
- how bluntly the constraint is stated;
- which constraint is developmentally appropriate to attack first;
- expected gain, drill difficulty, and timeframe.

It should not alter the measured joint location or turn the same visible fault
into two different physical facts. Pro remains an explicit separate scoring
standard because the product currently promises that choice.

### Replace conflicting anchors

Create one authoritative scoring block per skill and discipline. Separate:

1. Observable technical evidence.
2. Target-population score anchors.
3. Coaching voice and next-step selection.

A useful target scale is:

| Score | Target-population meaning |
|---|---|
| Below 45 | A missing or repeatedly broken foundation |
| 45 to 59 | Developing intermediate execution with a clear limiting fault |
| 60 to 74 | Functional intermediate execution that breaks under pace or pressure |
| 75 to 84 | Reliable advanced-amateur execution with one meaningful constraint |
| 85 to 91 | Standout advanced-amateur execution |
| 92 and above | Rare, near-flawless execution within the selected standard |

Anchor every band with labeled Sideout clips. Text alone is not enough. Use
paired examples such as "this clip should score above that clip" to expose
severity inversions before tuning exact numbers.

### Define the biggest constraint correctly

The biggest constraint is not always the lowest metric. It is the visible,
trainable issue whose improvement is most likely to raise the player's next
level of performance.

The coach should rank constraints by:

1. evidence strength;
2. effect on the outcome;
3. frequency across reps;
4. dependency, where fixing one issue unlocks others;
5. trainability for the selected player level.

This ranking becomes its own eval. Do not infer it from the minimum numeric
metric after the fact.

## Eval metrics and release gates

Replace the current all-or-nothing pass rate with hard gates plus a diagnostic
scorecard.

| Dimension | Metric | Initial gate |
|---|---|---|
| Evidence honesty | Major unsupported claim rate | No more than 5% of cases |
| Abstention | Correctly declines unscoreable or unobservable evidence | At least 95% |
| Constraint diagnosis | Primary constraint is reviewer top choice | At least 75% |
| Constraint diagnosis | Primary constraint is within reviewer top two or acceptable alternatives | At least 90% |
| Score calibration | Score falls inside adjudicated band | At least 90% |
| Score calibration | Mean absolute error from adjudicated midpoint | No more than 5 points |
| Bias | Mean error by skill, discipline, and target level | Within 3 points when the slice has enough cases |
| Stability | Median three-run overall-score range | No more than 5 points |
| Stability | 95th-percentile three-run range | No more than 8 points |
| Actionability | Reviewers agree the first fix is specific, safe, and useful | At least 90% |

Report every gate by skill, discipline, and level. A strong attack result cannot
hide a weak setting result. The aggregate scorecard is for orientation only.

## Sequenced pathway

### Phase 0: contain unsupported certainty

- Treat the skeleton as tracked landmarks, not proof of biomechanical accuracy.
- Stop treating unvalidated measurements as trusted ground truth in the
  reasoning contract.
- Audit every metric against the 17 actually emitted joints and its allowed
  camera views.
- Keep the existing confidence omission behavior, but label it heuristic until
  calibrated.

Exit: every emitted metric has supported joints, a camera eligibility rule, and
a frozen validation tolerance.

### Phase 1: establish the first real baseline

- Film 18 short clips from three players across all six skills, including at
  least one intermediate and one expert player.
- Annotate about eight critical frames per clip for roughly 144 pose frames.
- Have two reviewers label the score band, biggest constraint, acceptable
  alternative, and evidence frames.
- Run the current pipeline unchanged and record pose, measurement, diagnosis,
  score, and stability failures separately.

Exit: a baseline report identifies which layer causes each failure.

### Phase 2: repair in dependency order

1. Capture and target-player failures.
2. Supported-joint localization and temporal tracking.
3. Derived measurement formulas and confidence thresholds.
4. Constraint selection and evidence citations.
5. Score anchors and coaching voice.

Do not tune the coaching prompt to compensate for bad measurements. Do not
replace the pose model to compensate for a harsh scoring rubric.

Exit: the 36-case pilot suite clears the initial gates or has an explicit,
measured exception.

### Phase 3: lock and validate

- Build the 144-case target suite and 18-case abstention suite.
- Freeze labels, tolerances, prompts, thresholds, and split before the final run.
- Run pose and coaching evaluation on held-out players.
- Publish a versioned internal model card with supported claims, unsupported
  claims, coverage, failure slices, and release gates.

Exit: every objective measurement claim clears its gate. Coaching gates clear
for each supported skill and discipline, not just in aggregate.

### Phase 4: cohort monitoring

- Sample consented real-user analyses for blinded review.
- Track filming rejection rate, measurement coverage, constraint agreement,
  score distribution, retry rate, and whether users return for a second session.
- Re-run the locked suites whenever the pose model, metric formulas, frame
  selection, rubric, or coaching model changes.

Exit: no material regression and no target-user slice below its gate.

## Exact next experiment

Use the already planned calibration filming sprint as the first dependency test:

1. Record 18 clips from three players, one clip per skill per player.
2. Include one intermediate player, one expert player, and one player near the
   boundary between them.
3. Keep the full video, current extracted frames, selected-player track,
   keypoints, measurements, and coaching output together under one case ID.
4. Annotate the supported joints and skill events before reading the coaching
   result.
5. Have two reviewers independently label score bands and biggest constraints.
6. Produce one table that assigns every miss to capture, tracking, keypoints,
   measurements, diagnosis, scoring, or prescription.

Decision rule after that table:

- If keypoint localization is weak, fix capture or pose before touching prompts.
- If keypoints are strong but measurements are wrong, fix formulas and gates.
- If measurements are strong but the wrong constraint is chosen, fix constraint
  reasoning and labels.
- If the right constraint is chosen but scores are too low, calibrate anchors.
- If scores are fair but feedback still feels punishing, adjust voice and change
  sizing without altering the evidence or score.

This experiment produces the first honest baseline and tells Sideout what to
fix next without guessing.

## References

- COCO keypoint evaluation uses scale-normalized keypoint similarity rather than
  treating raw model confidence as accuracy: https://presentations.cocodataset.org/ECCV18/COCO18-Keypoints-Overview.pdf
- Research on human-pose calibration documents that standard keypoint
  confidence can be misaligned with actual pose accuracy:
  https://proceedings.mlr.press/v235/gu24a.html
