# CV Phase 1 Build Spec: Measurement-Grounded Analysis

Status: approved for build (decisions locked 2026-07-10). This spec is the single reference for the Phase 1 implementation. Amendments go through the Decision Log.

## 1. Goal

Replace guesswork with measurement in the analysis pipeline. On-device pose estimation runs during frame extraction, computes biomechanical measurements per rep, and sends them alongside the frames so the coaching service scores against measured values instead of eyeballing 12 JPEGs. Every analysis also banks dense keypoints and a 24-frame set as the future training corpus.

**Non-goals (explicitly deferred):** real ball detection (Phase 1.5), court calibration and metric units (Phase 1.5+), storage-first frame upload past the request cap (Phase 1.5), focus-player identification (Phase 3), live per-rep feedback (Phase 2), native app, any response-schema change.

## 2. Locked decisions

| # | Decision |
|---|---|
| 1 | Ball detection deferred. `ball_track` stays model-sourced; add provenance marker. Contact detection from wrist kinematics. |
| 2 | Two-stage capture: pose on the 24 existing probes finds peaks, dense pose at 24-30fps in windows of about plus/minus 1s around peaks via muted segment playback with `requestVideoFrameCallback`. |
| 3 | Units: body-relative plus absolute seconds. Every metric is `{value, unit, confidence}`. Never fake absolute distances. |
| 4 | All six skills ship with measurements, gated by confidence: any metric below its threshold is omitted entirely, never sent as a weak number. Three rep-detector families: swing (serve, attack), jump (block), platform/posture (pass, dig, set). |
| 5 | Storage: dense keypoints as `keypoints.json` in the `frames` bucket; 24 frames captured and stored permanently as corpus; best 12 sent to the model within the 4MB request cap. |
| 6 | Web application first. Floor: Safari 16.4+ / Chrome 110+ on modern phones. Automatic fallback to the existing luminance pipeline and vision-only scoring everywhere else. Nobody is ever blocked. |
| 7 | Response schema frozen. Measurements are input-only. Existing eval cases pass unmodified. |
| 8 | Training consent: explicit opt-in/opt-out choice at first upload, `profiles.training_consent` default false, changeable later, corpus queries hard-filter on it. |

## 3. Hard prerequisite

Apply `supabase/migrations/005_clips.sql` to the live project before any Phase 1 code merges. Raw clip persistence is assumed by the overlay work and by the corpus. Verify: upload a clip in production, confirm the object lands in the `clips` bucket and `analyses.clip_path` is set.

## 4. Architecture

```
capture/upload (analyze-flow.tsx)
  -> lib/frames.ts extraction
       Stage 1: pose on 24 probes  ->  wrist-velocity peaks     (fallback: luminance scan)
       Stage 2: dense pose in peak windows (rVFC playback)      (fallback: skip, no measurements)
       -> planFrameTimes: 24 stored frames, best 12 for the model
  -> lib/pose/metrics.ts: reps + measurements {value, unit, confidence}, omit below threshold
  -> POST /api/analyze: frames (max 12) + measurements block (optional)
       system: rubric + outputSpec (+ static grounding section, still cached)
       user: frame images + measurements JSON text block + trailing instruction
  -> route stores: result jsonb (+ measurements, + 12-frame keypoints), predetermines
     keypoints_path and stored_frame_paths
  -> client post-upload (browser storage client, non-fatal, same pattern as clip):
     keypoints.json + extra frames 13-24
  -> analysis/[id]: filmstrip skeleton overlay from row; clip player overlay
     lazy-loads keypoints.json via signed URL
```

The pose engine loads lazily on the analyze flow only. Nothing else in the app pays its cost.

## 5. New modules

| File | Responsibility |
|---|---|
| `lib/pose/types.ts` | Shared DOM-free types: `LandmarkFrame` (t, 33 landmarks x/y/z/visibility), `RepWindow`, `Measurement`, `MeasurementsBlock` (versioned), constants. Importable by client, server, and tests. |
| `lib/pose/engine.ts` | Main-thread facade for the pose engine: `loadPoseEngine()` (idempotent, lazy, resolves null on unsupported/failed load), `detect(bitmap, timeS)`. Owns the worker handshake and a main-thread fallback when `OffscreenCanvas` is unavailable. |
| `lib/pose/pose-worker.ts` | Hand-rolled web worker (no worker library). Hosts the WASM landmarker, receives transferred `ImageBitmap`s, returns landmark frames. |
| `lib/pose/kinematics.ts` | Pure math, no DOM, `node --test`able: smoothing, per-landmark velocity, joint angles, body-unit normalization (torso length), standing-baseline estimation, the three rep-detector families. |
| `lib/pose/metrics.ts` | Pure, per-skill metric definitions: compute functions, units, confidence model (landmark visibility x detector fit), omission thresholds. Emits the `MeasurementsBlock`. |
| `lib/pose/metrics.test.ts`, `lib/pose/kinematics.test.ts` | Node test suites with recorded landmark fixtures (JSON) per skill, mirroring the `frame-select` testing pattern. |
| `public/pose/` | Self-hosted, pinned WASM runtime and landmarker model (lite variant, roughly 4-6MB total). Never fetched from a third-party CDN at runtime. |
| `supabase/migrations/006_cv_phase1.sql` | Schema additions, section 9. |

## 6. Modified modules

### `lib/frames.ts`
- Stage 1: when the engine loads, `scanMotion` is replaced by `scanPose`: same 24 `buildProbeTimes` seeks and the same `SCAN_TIME_BUDGET_MS` discipline, but each probe runs pose and the motion score becomes normalized wrist speed (max of both wrists). Engine null or budget exceeded: existing luminance scan runs untouched.
- Stage 2 (new): for each peak from `findPeaks`, play the muted video from `peak - 1.2s` to `peak + 1.2s` at native rate, sampling via `requestVideoFrameCallback` with a per-window frame cap and a global dense budget (about 8s wall clock). Collect `LandmarkFrame[]`. Any failure degrades to no dense data for that window.
- Frame planning: `planFrameTimes` gains a `storeCount` (24) alongside the send cap (`MAX_FRAMES`, still 12). Contact instants from kinematics take priority over probe-derived peaks when available, so bursts center on true contact.
- Return type extends with `landmarks: LandmarkFrame[] | null` and `storedFrames: Frame[]` (the 12 extras rendered at the same dimensions). `finalizePlanned` and the body-cap ladder apply to the send set only.

### `lib/frame-select.ts`
Stays pure and DOM-free. `planFrameTimes` signature extends for store-versus-send selection and externally supplied contact times. Existing tests keep passing; new cases cover the extended planning.

### `components/analyze-flow.tsx`
- Consent gate: on first upload (profile has `training_consent_at` null), a blocking opt-in/opt-out dialog before analysis proceeds; writes the choice to `profiles`. Copy goes through `docs/copy.md` per repo convention.
- Passes `measurements`, `has_keypoints`, and `extra_frame_count` to the analyze call.
- After the route responds (same non-fatal pattern as the clip upload at lines 203-214): uploads `keypoints.json` (gzip via `CompressionStream` when available) and extra frames `x12.jpg` through `x23.jpg` with the browser storage client to the paths the route returned.

### `app/api/analyze/route.ts`
- `bodySchema` gains optional `measurements` (validated by `measurementsSchema`), `has_keypoints`, `extra_frame_count` (0-12). Requests without them behave exactly as today, which keeps old clients and all existing eval cases working.
- When measurements are present, the user content gains one text block between the frames and the trailing instruction: `Measured data (computed by on-device motion tracking, trust these values): <json>`. System blocks stay byte-stable and cached.
- Persists `measurements` inside `result` jsonb, plus per-sent-frame keypoints (33 landmarks for each of the 12 frames, a few KB) for the filmstrip overlay, plus `ball_track_source: "model_estimate"`.
- Predetermines and returns `keypointsPath` and `storedFramePaths`; writes them on the `analyses` row (`keypoints_path`, `stored_frame_paths`).
- Response schema and zod `analysisSchema` untouched.

### `lib/ai/output-spec.ts` and `lib/ai/rubrics/index.ts`
- `outputSpec` gains a static grounding section: measured values are ground truth, cite them in metric notes when present, score visually when a checkpoint has no measurement, never contradict a measured value. Static text, so prompt caching is unaffected beyond a one-time cache rewrite at deploy.
- Each of the 12 rubric strings gains a short "measured checkpoints" appendix mapping that skill's metric keys to its scoring anchors. Frozen-prompt discipline: append-only, anchors unchanged.

### `components/clip-viewer.tsx`
- `FramePlayer` and the filmstrip draw a skeleton overlay from the per-frame keypoints in `result` (design tokens only, `chalk`/`teal` strokes, reduced-motion safe since it is per-frame static drawing).
- `ClipPlayer` lazily fetches the signed `keypoints.json` URL (signed server-side in `analysis/[id]/page.tsx` next to the existing clip signing) and interpolates the skeleton over video playback. Absent file: overlay silently off.
- `BallMarker` renders with an "estimated" affordance driven by `ball_track_source`.

### `app/(app)/dashboard`
One settings row: the training-consent toggle (reads and writes `profiles.training_consent`).

## 7. Measurements block (wire shape, version 1)

```json
{
  "version": 1,
  "capture": { "probe_fps": null, "dense_fps": 27, "coverage": "windows", "engine": "pose-landmarker-lite" },
  "units": "body-relative: heights in standing-body-heights, widths in shoulder-widths, angles in degrees, time in seconds",
  "reps": [
    {
      "start_s": 3.2, "contact_s": 4.1, "end_s": 4.9, "detector": "swing",
      "metrics": {
        "contact_height": { "value": 1.28, "unit": "body_heights", "confidence": 0.91 },
        "elbow_angle_at_contact": { "value": 158, "unit": "deg", "confidence": 0.86 },
        "approach_tempo": { "value": [0.61, 0.55, 0.34, 0.3], "unit": "s_between_steps", "confidence": 0.78 },
        "jump_height": { "value": 0.21, "unit": "body_heights", "confidence": 0.83 }
      }
    }
  ],
  "session": { "rep_count": 4, "contact_height_stddev": 0.05 },
  "omitted_below_confidence": ["toss_drift"]
}
```

Rules: metrics below threshold appear only in `omitted_below_confidence` (names, never values). `reps` empty means the block is not sent at all. The server validates with `measurementsSchema` (max sizes on arrays, numeric bounds) and rejects to the no-measurements path on failure rather than 400ing the whole request.

## 8. Metric catalog v1

Confidence thresholds default to 0.7; per-metric overrides live in `lib/pose/metrics.ts`.

| Skill | Detector | Metrics (unit) |
|---|---|---|
| serve | swing | toss_release_height (bh), toss_drift (sw), contact_height (bh), elbow_angle_at_contact (deg), arm_extension_at_contact (deg), follow_through_direction (deg), rep_tempo_consistency (s), body_rotation (deg) |
| attack | swing | approach_tempo (s list), penultimate_step_length (bh), arms_back_on_plant (bool w/ confidence), jump_height (bh), contact_height (bh), elbow_angle_at_contact (deg), landing_knee_flexion (deg) |
| block | jump | jump_height (bh), hand_spacing (sw), verticality_drift (deg), landing_knee_flexion (deg), hands_above_head_duration (s) |
| pass | platform | platform_angle (deg), platform_still_before_contact (s), knee_flexion_at_contact (deg), footwork_pattern (enum shuffle/cross), torso_lean (deg) |
| set | platform | hands_above_forehead (bool), elbow_extension_symmetry (deg delta), leg_to_arm_sequence_lag (s), shoulder_squareness (deg) |
| dig | platform | lunge_depth (bh), platform_angle (deg), recovery_time (s), base_width (sw) |

bh = body heights, sw = shoulder widths. Tier expectations: serve/attack high confidence, block/pass medium, set/dig lower and expected to omit often. That asymmetry is by design.

## 9. Migration `006_cv_phase1.sql`

```sql
alter table public.profiles
  add column training_consent boolean not null default false,
  add column training_consent_at timestamptz;

alter table public.analyses
  add column keypoints_path text,
  add column stored_frame_paths text[] not null default '{}';
```

Storage: no new buckets or policies. `keypoints.json` and `x*.jpg` live under the existing `frames` bucket at `${user.id}/${analysisId}/`, covered by the existing own-folder RLS (the route already uploads under the user's auth context; verify the insert policy also admits the browser client, which uses the same auth context, during M0).

Corpus queries are `analyses join profiles on user_id where training_consent`, with skill, discipline, confidences, and paths all already on the row. No separate corpus table.

## 10. Degradation matrix

| Condition | Behavior |
|---|---|
| Engine assets fail to load, unsupported browser, old device | Luminance scan, no measurements, vision-only scoring. Identical to today. |
| Stage 1 pose exceeds scan budget | Fall back to luminance scan mid-flight (existing throw path). |
| Stage 2 dense capture fails or exceeds budget | Keep Stage 1 peaks, send no measurements (or partial reps that passed), frames still improve via pose peaks. |
| Zero reps detected by all detectors | No measurements block, uniform/context frame plan as today. |
| Measurements fail server validation | Log, proceed as a no-measurements request. Never fail the analysis over telemetry. |
| Keypoints/extra-frames upload fails | Non-fatal, same as clip upload today. Row keeps the paths; overlay handles absence. |

Invariant: no Phase 1 code path may make an analysis fail that would have succeeded before Phase 1.

## 11. Decision Log entries to record (drafts)

**D-008 pose engine dependency.** Admit `@mediapipe/tasks-vision` (publisher: Google, Apache-2.0, pinned exact version) under the D-001 10.5 gate. Scope: analyze flow only, lazy-loaded; WASM and model assets self-hosted under `public/pose/` (no runtime third-party fetch, keeps the PWA offline story and avoids CDN CSP surface). Clarification recorded in the same entry: the no-vendor-names rule governs UI, user-visible errors, and marketing surfaces; `package.json`, imports, and engineering docs (this file, decisions.md) may name dependencies, since the D-001 gate itself requires naming publishers. UI copy refers to the capability as "motion tracking".

**D-009 training corpus and consent.** 24 frames plus keypoints stored permanently per analysis as a future training corpus. Explicit opt-in/opt-out at first upload, `profiles.training_consent` default false, settings toggle, corpus access hard-filtered on the flag. Youth-footage rationale recorded.

## 12. Testing and verification

- `node --test` on `lib/pose/kinematics.ts` and `lib/pose/metrics.ts` with recorded landmark fixtures per skill (a made serve, a shank, an occluded dig) asserting values, confidences, and omission behavior.
- `lib/frame-select.ts` extended tests for store/send planning.
- Eval harness: all existing cases in `evals/cases/` pass byte-identically (schema frozen). New cases added that carry measurement blocks, replayed through `/api/eval`, comparing grounded vs ungrounded runs on the same frames as the quality signal for M7 sign-off.
- `AI_MOCK=true` path unchanged; mock ignores measurements.
- Manual device matrix before merge: recent iPhone Safari, recent Android Chrome, one old device to prove the fallback, desktop Chrome/Safari. Verify wall-clock added extraction time p50 under ~12s on a mid-tier phone and graceful budget degradation.
- Full `npm run build` plus the repo quality-floor checks at every milestone.

## 13. Build order

| M | Deliverable | Gate |
|---|---|---|
| M0 | Apply 005 live; verify clip persistence and frames-bucket client insert policy | Live upload shows clip + client-side test object |
| M1 | D-008/D-009 entries; engine + worker + self-hosted assets; feature-detect and load | Landmarks render in a dev harness on desktop + phone |
| M2 | kinematics + metrics pure libs with fixtures | `node --test` green; omission rule proven in tests |
| M3 | frames.ts two-stage integration; 24/12 planning; degradation paths | Old pipeline byte-identical when engine absent; budgets hold on phone |
| M4 | Route: measurements input, prompt grounding, storage paths, migration 006 | Existing evals pass; new measurement evals added; build green |
| M5 | Overlays (filmstrip + clip player) and ball-track provenance | Visual QA on real clips; reduced-motion pass |
| M6 | Consent dialog + settings toggle + copy.md entries | Flag persisted; corpus query filters verified |
| M7 | Eval comparison run, device matrix, quality-floor sweep | Grounded ≥ ungrounded on eval set; no regression anywhere |

Each milestone is a commit; M0 and M4 (migration) flag deploy-order notes in `docs/deploy.md`.

## 14. Acceptance criteria

1. A serve or attack clip on a modern phone produces a measurements block with at least contact, tempo, and jump metrics at confidence ≥ 0.7, and the returned analysis cites measured values in metric notes.
2. All six skills produce keypoints and skeleton overlays; low-confidence metrics are absent from the payload, not present with low values.
3. An old browser or failed engine load produces today's exact behavior with no user-visible error.
4. 24 frames and keypoints.json exist in storage for a fresh analysis; `stored_frame_paths` and `keypoints_path` are set; corpus query returns only consented rows.
5. Every pre-existing eval case passes unmodified; the grounded eval run scores at or above the ungrounded baseline.
6. No new colors, fonts, or vendor names in UI; request body stays under the cap; hand-rolled worker and service worker only.
