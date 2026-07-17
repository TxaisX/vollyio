# Pose Model Selection for Sideout

Status: provisional recommendation, 2026-07-16

## Decision

Use **RTMPose-m Body26 at 256x192** as the leading production candidate.
Benchmark it against the current RTMPose-m Body17 model and one challenger,
**DWPose-m WholeBody at 256x192**, before changing production.

Body26 is the best fit for the current product because it adds the missing heel
and toe landmarks while preserving the existing top-down detector, ONNX
runtime, SimCC decoder, input size, and on-device execution pattern. Its
official model archive is approximately the same size as the current 54.3 MB
pose model.

DWPose-m is the challenger because it adds 133 whole-body landmarks and has the
strongest published body, foot, and hand results among the medium 256x192
whole-body candidates reviewed. It should ship only if those extra landmarks
produce a measurable improvement in volleyball analysis, not because its
skeleton looks denser.

This is a model-selection hypothesis, not a production approval. The locked
volleyball benchmark below decides the winner.

## What Sideout actually needs

The current analysis depends primarily on:

- shoulders, elbows, wrists, hips, knees, and ankles;
- heels and toes for landing, base, jump, and foot-contact measurements;
- stable target-player identity through multi-player footage;
- enough temporal density to locate plant, contact, and landing events;
- browser execution through WebGPU with a WASM fallback;
- full-clip processing without uploading raw motion data.

It does not yet have a validated use for 68 face landmarks or 42 finger
landmarks. At Sideout's current 256x192 top-down crop, fine finger location may
also be too uncertain during a fast swing to support a coaching claim. Dense
hand output remains experimental until a downstream hand metric passes the
same accuracy and coverage gates as every other measurement.

## Ranked shortlist

| Rank | Candidate | Joint set | Fit for Sideout | Decision |
|---|---|---:|---|---|
| 1 | RTMPose-m Body26, 256x192 | 26 | Adds heel and toe landmarks with the smallest architectural and asset change | Primary candidate |
| 2 | DWPose-m WholeBody, 256x192 | 133 | Adds hands, face, and feet; published at 2.2 GFLOPs with 0.685 body AP, 0.636 foot AP, 0.527 hand AP, and 0.606 whole-body AP | Benchmark challenger |
| 3 | RTMW-m WholeBody, 256x192 | 133 | Deployment-friendly, but its published medium-resolution accuracy is below DWPose-m on the relevant whole-body groups | Reserve only if DWPose integration fails |
| 4 | RTMW-l or RTMW-x | 133 | Higher whole-body accuracy, but larger models or 384x288 inputs increase browser latency and memory risk | Reconsider for a server or high-performance tier |
| 5 | Current RTMPose-m Body17 | 17 | Proven to run in the existing browser pipeline, but cannot emit heels, toes, hands, fingers, or depth | Benchmark control |

## Why the other model families are not the default

- The previous Sideout shootout already showed that the 33-point browser model
  was effectively single-person and missed fast frames in the test rally.
- A 308-point dense model requires a substantially heavier GPU path and its
  available license is not suitable for the commercial product.
- Common 17-point models do not solve the topology gap that motivated this
  review.
- A point tracker can improve temporal continuity, but it does not know human
  anatomy and cannot replace an accurate pose estimator.
- A monocular 3D model would add inferred depth, not measured depth. It should
  not be introduced until the two-dimensional measurement contract is proven.

## Locked benchmark

### Dataset

Use at least 300 annotated frames from at least 12 players, held out by player.
Include all six skills, all three disciplines, intermediate and expert players,
and balanced examples of:

- plant, contact, landing, and neutral moments;
- front, side, and diagonal views;
- indoor, sun, shade, and motion blur;
- partial occlusion and multiple players;
- close, normal, and distant athlete scale.

Annotate the common volleyball-critical points for every model: shoulders,
elbows, wrists, hips, knees, ankles, heels, and big toes. For the current
17-point control, heels and toes are unsupported rather than incorrect. Add a
smaller hand subset only if a specific hand metric is proposed before the
dataset is locked.

### Fair comparison

All candidates must use:

- the same person detector and person boxes;
- the same 256x192 crop and image preprocessing;
- the same target-player selection and track builder;
- no temporal smoothing during the anatomical localization test;
- the same smoothing and event logic during the downstream measurement test;
- identical clips, devices, browser versions, and warm-cache conditions.

This separates pose-model quality from detector, tracking, and browser effects.

### Accuracy gates

| Gate | Required result |
|---|---|
| Target-player identity | Correct in at least 99% of evaluated frames, with identity switches reported separately |
| Critical-joint localization | At least 95% PCK at 0.10 body height for each visible critical joint group |
| Event timing | At least 95% of emitted plant, contact, and landing events within 2 frames at 30 fps |
| Joint angles | At least 95% of emitted angles within 10 degrees of the human annotation |
| Abstention | At least 95% of unsupported or unobservable claims omitted or marked unknown |
| Measurement coverage | At least 70% of eligible reps emit two or more validated measurements |
| Stability | No critical joint group below 93%, even if the pooled result passes |

The eventual public 95% measurement claim still requires an observed success
rate of at least 98% and a player- or clip-resampled 95% confidence lower bound
of at least 95%. Model benchmark AP alone cannot establish that claim.

### Browser and product gates

Run the benchmark on a WebGPU desktop, a WASM desktop, and a representative
mobile device.

| Gate | Required result |
|---|---|
| Full-clip completion | At least 95% of runs finish inside the existing `2.5 x clip duration + 20 seconds` pass budget |
| Temporal density | Median effective FPS no more than 10% below the current control on each execution tier |
| Reliability | No worker crash, out-of-memory failure, or corrupted model load in 100 repeated benchmark runs |
| Pose asset | No more than 75 MB unless a larger model proves a material downstream gain |
| Privacy | Raw video and pose inference remain on device |
| Fallback | A WebGPU failure still falls back to WASM without changing the measurement contract |

Report cold model load separately from warm inference. The 101.4 MB person
detector is already larger than the pose model, so a later performance project
should examine the detector independently rather than blaming all startup cost
on the pose choice.

## Winner rule

1. Ship Body26 if it passes every accuracy and browser gate.
2. Ship DWPose-m instead only if it also passes every gate and improves either
   validated-measurement coverage or critical-joint localization by at least two
   percentage points without reducing effective FPS by more than 10%.
3. Require DWPose-m to enable at least one validated foot or hand measurement
   that Body26 cannot provide. Otherwise its extra landmarks are unused cost.
4. Keep the current Body17 model if neither candidate passes. Missing a
   landmark honestly is better than emitting a less reliable measurement.

## Implementation pathway

1. Add offline adapters for Body26 and DWPose-m without changing production.
2. Confirm ONNX output names, SimCC dimensions, preprocessing, and coordinate
   mapping against reference inference.
3. Run the locked localization benchmark and reject any candidate that misses a
   hard gate.
4. Run the downstream measurement benchmark using the surviving candidates.
5. Run the three-device browser benchmark and repeated-load test.
6. Select the winner with the rule above, then place it behind an internal
   feature flag for shadow comparisons before making it the default.

## Primary sources

- [RTMPose and Body26 model documentation](https://github.com/open-mmlab/mmpose/blob/main/docs/en/user_guides/inference.md)
- [ONNX model zoo for Body26, DWPose, and RTMW](https://github.com/Tau-J/rtmlib)
- [DWPose published results](https://github.com/IDEA-Research/DWPose)
- [DWPose paper](https://arxiv.org/abs/2307.15880)
- [RTMW paper](https://arxiv.org/abs/2407.08634)
- [Sideout analysis validation roadmap](./analysis-validation-roadmap.md)
