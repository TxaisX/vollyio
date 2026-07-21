# Pose Model Benchmark and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Benchmark RTMPose-m Body26 and DWPose-m against the current Body17 control, then make the qualified winner replaceable and reversible in production.

**Architecture:** Keep Body17 as the production default while adding model-neutral SimCC decoding and landmark adapters behind the existing worker boundary. A development-only browser lab runs a locked volleyball dataset through both fixed-frame localization and the real full-clip extraction pipeline, then a deterministic scorer applies the published accuracy, coverage, reliability, and device gates. Production changes only by switching one allowlisted model identifier after the result is recorded.

**Tech Stack:** Next.js 16, React 19, TypeScript, ONNX Runtime Web 1.27.0, Web Workers, WebGPU, WASM, Node test runner, existing Sideout kinematics and measurement pipeline.

## Global Constraints

- Raw video, frames, and pose inference remain on device.
- The current person detector, 256x192 crop, preprocessing, target selection, tracking, smoothing, and measurement code stay constant across candidates.
- Body17 remains the production default until a candidate passes every hard gate.
- WebGPU and single-thread WASM fallback must both remain supported.
- Full-clip capture must remain inside `2.5 x clip duration + 20 seconds` in at least 95% of benchmark runs.
- Median effective FPS may not fall more than 10% below the Body17 control on any supported execution tier.
- A pose asset over 75 MB requires a separately documented downstream gain and owner approval.
- No new runtime dependency is allowed for the benchmark or model switch.
- The 95% claim applies only to emitted measurements within frozen tolerances, never to the whole analysis or coaching judgment.
- No attribution, user-facing vendor names, em dashes, new colors, or new fonts.
- Preserve Body17 assets and its registry entry through at least one production release after rollout.

---

## Phases and gates

| Phase | Outcome | Exit gate |
|---|---|---|
| 0. Freeze | Benchmark contract, candidates, and rollback rule cannot drift mid-test | `docs/pose-model-selection.md` and this plan approved |
| 1. Candidate parity | Both candidate models load through the existing runtime and map correctly into the 33-slot contract | Reference decode within 0.75 px and score within 0.005 |
| 2. Ground truth | Volleyball frames and clips are labeled, adjudicated, and cryptographically locked | At least 300 frames, 12 players, 60 eligible reps, all six skills |
| 3. Automated benchmark | One repeatable lab produces raw predictions and a scored report | Unit, type, lint, and browser smoke checks pass |
| 4. Model decision | Accuracy, coverage, stability, and device results select a winner or retain Body17 | Every hard gate passes; no pooled average hides a joint-group failure |
| 5. Preview rollout | The winner runs on an internal preview with production code paths | 25 successful uploads across supported tiers, no rollback trigger |
| 6. Production rollout | One allowlisted identifier changes; Body17 remains immediately restorable | Post-release audit passes after 25 additional eligible uploads |

### Estimated sequence and ownership

| Phase | Working estimate | Primary owner |
|---|---:|---|
| 0. Freeze | Half day | Product and engineering |
| 1. Candidate parity | 2 to 3 engineering days | Engineering |
| 2. Ground truth | 1 to 2 calendar weeks | Two volleyball reviewers plus dataset coordinator |
| 3. Automated benchmark | 2 to 3 engineering days, parallel with labeling | Engineering |
| 4. Model decision | 1 to 2 days | Engineering and both reviewers |
| 5. Preview rollout | 1 day after qualification | Engineering and QA |
| 6. Production rollout | 1 day plus one release-cycle observation | Engineering and product |

The labeling phase is the critical path. Candidate integration and the benchmark lab can proceed while reviewers collect and adjudicate footage, but no locked run starts until labels and thresholds are frozen.

## File structure

### Create

- `scripts/prepare-pose-model.ts`: hash, split, and lock candidate ONNX files without adding a dependency.
- `scripts/prepare-pose-model.test.ts`: deterministic hash and chunk tests.
- `lib/pose/rtm/candidate-models.lock.json`: generated source URL, topology, input, byte count, hash, and chunk metadata.
- `lib/pose/rtm/landmark-adapters.ts`: topology-specific mapping into Sideout's 33-slot contract.
- `lib/pose/rtm/landmark-adapters.test.ts`: Body17, Halpe26, and WholeBody133 mapping tests.
- `lib/pose/rtm/pose-models.ts`: allowlisted model registry and production selection.
- `lib/pose/rtm/pose-models.test.ts`: default, allowlist, and fallback tests.
- `lib/pose/benchmark/types.ts`: locked manifest, prediction, device-run, and report contracts.
- `lib/pose/benchmark/scoring.ts`: PCK, identity, event, angle, coverage, subgroup, and confidence-bound scoring.
- `lib/pose/benchmark/scoring.test.ts`: boundary and aggregation tests.
- `lib/pose/benchmark/run-browser.ts`: DOM-side fixed-frame and full-clip runner.
- `components/pose-benchmark-lab.tsx`: development-only dataset picker and result exporter.
- `app/pose-benchmark/page.tsx`: production-hidden lab route.
- `scripts/score-pose-benchmark.ts`: validate raw result files and write the decision report.
- `evals/pose/README.md`: annotation and execution protocol.
- `evals/pose/manifest.example.json`: valid small example with no personal footage.
- `evals/pose/locked-manifest.json`: pseudonymous labels and file hashes for the final set.

### Modify

- `.gitignore`: ignore raw pose media, raw device runs, and prepared model chunks.
- `package.json`: add `pose:model`, `pose:score`, and focused test scripts using existing Node.
- `lib/pose/rtm/model-manifest.ts`: preserve detector metadata and delegate pose selection to the registry.
- `lib/pose/rtm/simcc-decode.ts`: require the candidate's keypoint count instead of defaulting to 17.
- `lib/pose/rtm/coco33.ts`: keep a compatibility export for existing imports.
- `lib/pose/pose-worker.ts`: accept model topology and keypoint count, reset tracking state, and dispatch the correct adapter.
- `lib/pose/engine.ts`: cache one engine promise per model identifier and expose a benchmark reset.
- `.env.example`: document the allowlisted production model selector.
- `docs/decisions.md`: record candidate provenance first, then the measured winner.
- `docs/deploy.md`: replace stale model-size notes and add the rollback command path.
- `docs/acceptance.md`: add the model-selection and post-release gates.

---

### Task 1: Lock candidate assets and provenance

**Phase:** 1. Candidate parity

**Files:**
- Create: `scripts/prepare-pose-model.ts`
- Create: `scripts/prepare-pose-model.test.ts`
- Create: `lib/pose/rtm/candidate-models.lock.json`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `docs/decisions.md:455`

**Interfaces:**
- Consumes: a local ONNX file, official source URL, model id, topology, input dimensions, and keypoint count.
- Produces: `CandidateModelLock` entries and 40 MiB chunks named `<file>.<index>` under `.cache/pose-models/parts/`.

- [ ] **Step 1: Write the failing lock and chunk test**

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { prepareModel } from "./prepare-pose-model.ts";

test("prepareModel records exact bytes, sha256, and chunk count", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sideout-pose-"));
  const file = join(dir, "fixture.onnx");
  await writeFile(file, Buffer.from("0123456789"));
  const entry = await prepareModel({
    id: "body26-candidate",
    file,
    source: "https://download.openmmlab.com/fixture.zip",
    topology: "halpe26",
    keypointCount: 26,
    inputWidth: 192,
    inputHeight: 256,
    outputDir: join(dir, "parts"),
    chunkBytes: 4,
  });
  assert.equal(entry.bytes, 10);
  assert.equal(entry.chunks, 3);
  assert.equal(entry.sha256.length, 64);
  assert.deepEqual(await readFile(join(dir, "parts", "fixture.onnx.2")), Buffer.from("89"));
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `npm.cmd test -- scripts/prepare-pose-model.test.ts`

Expected: FAIL with `Cannot find module './prepare-pose-model.ts'`.

- [ ] **Step 3: Implement the deterministic preparation function and CLI**

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export type CandidateModelLock = {
  id: "body26-candidate" | "dwpose-m-candidate";
  file: string;
  source: string;
  topology: "halpe26" | "coco133";
  keypointCount: 26 | 133;
  inputWidth: 192;
  inputHeight: 256;
  bytes: number;
  sha256: string;
  chunks: number;
};

export async function prepareModel(input: {
  id: CandidateModelLock["id"];
  file: string;
  source: string;
  topology: CandidateModelLock["topology"];
  keypointCount: CandidateModelLock["keypointCount"];
  inputWidth: 192;
  inputHeight: 256;
  outputDir: string;
  chunkBytes?: number;
}): Promise<CandidateModelLock> {
  const bytes = await readFile(input.file);
  const chunkBytes = input.chunkBytes ?? 41_943_040;
  await mkdir(input.outputDir, { recursive: true });
  const file = basename(input.file);
  const chunks = Math.ceil(bytes.byteLength / chunkBytes);
  for (let i = 0; i < chunks; i++) {
    await writeFile(
      join(input.outputDir, `${file}.${i}`),
      bytes.subarray(i * chunkBytes, Math.min(bytes.byteLength, (i + 1) * chunkBytes)),
    );
  }
  return {
    id: input.id,
    file,
    source: input.source,
    topology: input.topology,
    keypointCount: input.keypointCount,
    inputWidth: input.inputWidth,
    inputHeight: input.inputHeight,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    chunks,
  };
}
```

The CLI must parse both candidate invocations, reject files over 75 MB, merge entries by `id`, and write stable sorted JSON to `lib/pose/rtm/candidate-models.lock.json`.

- [ ] **Step 4: Add local-only paths and package commands**

```gitignore
/.cache/pose-models/
/evals/pose/work/
/evals/pose/results/
```

```json
"pose:model": "node --experimental-strip-types scripts/prepare-pose-model.ts",
"pose:score": "node --experimental-strip-types scripts/score-pose-benchmark.ts"
```

- [ ] **Step 5: Acquire and prepare both official model archives**

```powershell
New-Item -ItemType Directory -Force .cache\pose-models\downloads | Out-Null
Invoke-WebRequest 'https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605.zip' -OutFile .cache\pose-models\downloads\body26.zip
Invoke-WebRequest 'https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-ucoco_dw-ucoco_270e-256x192-c8b76419_20230728.zip' -OutFile .cache\pose-models\downloads\dwpose-m.zip
Expand-Archive .cache\pose-models\downloads\body26.zip .cache\pose-models\downloads\body26 -Force
Expand-Archive .cache\pose-models\downloads\dwpose-m.zip .cache\pose-models\downloads\dwpose-m -Force
```

Run `npm.cmd run pose:model` once per extracted ONNX file with the exact official URL and topology metadata. Do not upload a chunk or edit the production default until the generated byte counts and hashes are recorded in `docs/decisions.md` under a candidate-only D-023 viability gate.

- [ ] **Step 6: Verify and commit the provenance task**

Run: `npm.cmd test -- scripts/prepare-pose-model.test.ts`

Expected: PASS with one test and no untracked model binaries outside `.cache/pose-models/`.

```powershell
git add .gitignore package.json scripts/prepare-pose-model.ts scripts/prepare-pose-model.test.ts lib/pose/rtm/candidate-models.lock.json docs/decisions.md
git commit -m "chore: lock pose model candidates"
```

---

### Task 2: Add topology-neutral landmark adapters

**Phase:** 1. Candidate parity

**Files:**
- Create: `lib/pose/rtm/landmark-adapters.ts`
- Create: `lib/pose/rtm/landmark-adapters.test.ts`
- Modify: `lib/pose/rtm/coco33.ts:1`

**Interfaces:**
- Consumes: `SimccPoint[]`, source image width and height, and `PoseTopology`.
- Produces: `poseToLandmarks(topology, points, imgW, imgH): Landmark[]`, always exactly 33 slots with unsupported entries at visibility zero.

- [ ] **Step 1: Write failing mapping tests for heels, toes, and unsupported fingers**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { LM } from "../types.ts";
import { poseToLandmarks } from "./landmark-adapters.ts";

const points = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ x: i * 10, y: i * 5, score: 0.9 }));

test("Halpe26 maps heels and big toes into the 33-slot contract", () => {
  const pts = poseToLandmarks("halpe26", points(26), 1000, 500);
  assert.equal(pts[LM.leftHeel].x, 240 / 1000);
  assert.equal(pts[LM.rightHeel].x, 250 / 1000);
  assert.equal(pts[LM.leftFootIndex].x, 200 / 1000);
  assert.equal(pts[LM.rightFootIndex].x, 210 / 1000);
});

test("WholeBody133 maps its six foot points but keeps z at zero", () => {
  const pts = poseToLandmarks("coco133", points(133), 1000, 500);
  assert.equal(pts[LM.leftHeel].x, 190 / 1000);
  assert.equal(pts[LM.rightHeel].x, 220 / 1000);
  assert.equal(pts[LM.leftFootIndex].x, 170 / 1000);
  assert.equal(pts[LM.rightFootIndex].x, 200 / 1000);
  assert.equal(pts[LM.leftWrist].z, 0);
});
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `npm.cmd test -- lib/pose/rtm/landmark-adapters.test.ts`

Expected: FAIL with the missing adapter module.

- [ ] **Step 3: Implement explicit topology maps**

```ts
import { POSE_LANDMARK_COUNT, type Landmark } from "../types.ts";
import type { SimccPoint } from "./simcc-decode.ts";

export type PoseTopology = "coco17" | "halpe26" | "coco133";

const BODY17 = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] as const;
const MAPS: Record<PoseTopology, ReadonlyArray<readonly [number, number]>> = {
  coco17: BODY17.map((target, source) => [source, target] as const),
  halpe26: [
    ...BODY17.map((target, source) => [source, target] as const),
    [20, 31], [21, 32], [24, 29], [25, 30],
  ],
  coco133: [
    ...BODY17.map((target, source) => [source, target] as const),
    [17, 31], [20, 32], [19, 29], [22, 30],
  ],
};

export function poseToLandmarks(
  topology: PoseTopology,
  points: SimccPoint[],
  imgW: number,
  imgH: number,
): Landmark[] {
  const output = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, v: 0 }));
  for (const [source, target] of MAPS[topology]) {
    const point = points[source];
    if (!point || point.score <= 0) continue;
    output[target] = {
      x: point.x / imgW,
      y: point.y / imgH,
      z: 0,
      v: Math.min(1, Math.max(0, point.score)),
    };
  }
  return output;
}
```

Keep `cocoToLandmarks` as a compatibility wrapper that calls `poseToLandmarks("coco17", ...)`.

- [ ] **Step 4: Verify and commit the adapter task**

Run: `npm.cmd test -- lib/pose/rtm/landmark-adapters.test.ts lib/pose/rtm/coco33.test.ts`

Expected: PASS with the new mappings and all existing Body17 assertions unchanged.

```powershell
git add lib/pose/rtm/landmark-adapters.ts lib/pose/rtm/landmark-adapters.test.ts lib/pose/rtm/coco33.ts
git commit -m "feat: add pose topology adapters"
```

---

### Task 3: Make the worker model-selectable without changing production

**Phase:** 1. Candidate parity

**Files:**
- Create: `lib/pose/rtm/pose-models.ts`
- Create: `lib/pose/rtm/pose-models.test.ts`
- Modify: `lib/pose/rtm/model-manifest.ts:1`
- Modify: `lib/pose/rtm/simcc-decode.ts:11`
- Modify: `lib/pose/pose-worker.ts:18`
- Modify: `lib/pose/engine.ts:12`
- Modify: `.env.example`

**Interfaces:**
- Produces: `PoseModelId`, `PoseModelDefinition`, `poseModel(id)`, and `productionPoseModelId(raw)`.
- Changes: `loadPoseEngine({ modelId?, onProgress? })` and adds `PoseEngine.resetTracking()`.
- Preserves: callers that use `loadPoseEngine()` with no model id still load Body17.

- [ ] **Step 1: Write the failing registry test**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { productionPoseModelId, poseModel } from "./pose-models.ts";

test("production stays on Body17 when no approved override exists", () => {
  assert.equal(productionPoseModelId(undefined), "body17-control");
  assert.equal(productionPoseModelId("not-allowlisted"), "body17-control");
  assert.equal(productionPoseModelId("body26-candidate"), "body17-control");
});

test("candidate definitions pin topology and keypoint count", () => {
  assert.equal(poseModel("body26-candidate").topology, "halpe26");
  assert.equal(poseModel("body26-candidate").keypointCount, 26);
  assert.equal(poseModel("dwpose-m-candidate").keypointCount, 133);
});
```

- [ ] **Step 2: Run the registry test and confirm failure**

Run: `npm.cmd test -- lib/pose/rtm/pose-models.test.ts`

Expected: FAIL with the missing registry module.

- [ ] **Step 3: Implement the allowlisted registry**

```ts
import candidateLocks from "./candidate-models.lock.json";
import { POSE_MODEL, type ModelSpec } from "./model-manifest.ts";
import type { PoseTopology } from "./landmark-adapters.ts";

export type PoseModelId = "body17-control" | "body26-candidate" | "dwpose-m-candidate";
export type PoseModelDefinition = {
  id: PoseModelId;
  engineName: string;
  topology: PoseTopology;
  keypointCount: 17 | 26 | 133;
  spec: ModelSpec;
};

type CandidateLock = {
  id: Exclude<PoseModelId, "body17-control">;
  file: string;
  topology: "halpe26" | "coco133";
  keypointCount: 26 | 133;
  inputWidth: 192;
  inputHeight: 256;
  bytes: number;
  sha256: string;
  chunks: number;
};

const ENGINE_NAMES: Record<CandidateLock["id"], string> = {
  "body26-candidate": "rtm-body26-m",
  "dwpose-m-candidate": "dwpose-wholebody-m",
};

function candidateDefinition(raw: unknown): PoseModelDefinition {
  const lock = raw as CandidateLock;
  const validId = lock?.id === "body26-candidate" || lock?.id === "dwpose-m-candidate";
  const validTopology = lock?.topology === "halpe26" || lock?.topology === "coco133";
  const validCount = lock?.keypointCount === 26 || lock?.keypointCount === 133;
  if (
    !validId || !validTopology || !validCount ||
    lock.inputWidth !== 192 || lock.inputHeight !== 256 ||
    !Number.isInteger(lock.bytes) || lock.bytes <= 0 || lock.bytes > 75_000_000 ||
    !/^[a-f0-9]{64}$/.test(lock.sha256) ||
    !Number.isInteger(lock.chunks) || lock.chunks < 1
  ) {
    throw new Error("Invalid candidate pose model lock");
  }
  return {
    id: lock.id,
    engineName: ENGINE_NAMES[lock.id],
    topology: lock.topology,
    keypointCount: lock.keypointCount,
    spec: { file: lock.file, bytes: lock.bytes, sha256: lock.sha256, chunks: lock.chunks },
  };
}

const MODELS: Record<PoseModelId, PoseModelDefinition> = {
  "body17-control": {
    id: "body17-control",
    engineName: "rtm-body17-m",
    topology: "coco17",
    keypointCount: 17,
    spec: POSE_MODEL,
  },
  "body26-candidate": candidateDefinition(candidateLocks["body26-candidate"]),
  "dwpose-m-candidate": candidateDefinition(candidateLocks["dwpose-m-candidate"]),
};

export function poseModel(id: PoseModelId): PoseModelDefinition {
  return MODELS[id];
}

const APPROVED_PRODUCTION_MODELS = new Set<PoseModelId>(["body17-control"]);

export function productionPoseModelId(raw: string | undefined): PoseModelId {
  const id = raw as PoseModelId;
  return APPROVED_PRODUCTION_MODELS.has(id) ? id : "body17-control";
}
```

Keep the candidate registry available to the development lab while the production allowlist contains only Body17. Task 8 adds exactly one qualified candidate to that allowlist after D-023 is final.

- [ ] **Step 4: Thread the selected definition through engine initialization**

Add these fields to the worker init message:

```ts
poseTopology: PoseTopology;
poseKeypointCount: 17 | 26 | 133;
engineName: string;
```

Change pose decode to:

```ts
const points = decodeSimcc(simccX, simccY, crop, poseKeypointCount);
return poseToLandmarks(poseTopology, points, bitmap.width, bitmap.height);
```

Change the engine cache from one global promise to:

```ts
const enginePromises = new Map<PoseModelId, Promise<PoseEngine | null>>();
```

Implement `resetTracking()` as a worker message that clears `boxCache`, resets `lastDetectorMs`, and resets `lastFrameMs`. The benchmark calls it before every labeled localization frame so every model receives a fresh detector box.

- [ ] **Step 5: Upload only hash-locked chunks and verify same-origin retrieval**

Upload the generated chunks to the existing public `models` bucket using the established D-021 storage-admin workflow. Then run a HEAD request against every chunk from the configured model base and confirm the returned content length matches the local chunk.

- [ ] **Step 6: Verify the unchanged default and candidate initialization**

Run:

```powershell
npm.cmd test -- lib/pose/rtm/pose-models.test.ts lib/pose/rtm/rtm-decode.test.ts
npm.cmd run typecheck
```

Expected: all focused tests pass, TypeScript exits 0, and the no-argument engine path still reports the Body17 engine name.

- [ ] **Step 7: Commit the selectable runtime**

```powershell
git add .env.example lib/pose/engine.ts lib/pose/pose-worker.ts lib/pose/rtm/model-manifest.ts lib/pose/rtm/simcc-decode.ts lib/pose/rtm/pose-models.ts lib/pose/rtm/pose-models.test.ts
git commit -m "feat: make pose runtime model selectable"
```

---

### Task 4: Build the benchmark contracts and deterministic scorer

**Phase:** 3. Automated benchmark

**Files:**
- Create: `lib/pose/benchmark/types.ts`
- Create: `lib/pose/benchmark/scoring.ts`
- Create: `lib/pose/benchmark/scoring.test.ts`
- Create: `scripts/score-pose-benchmark.ts`

**Interfaces:**
- Consumes: `PoseBenchmarkManifest` plus one `PoseBenchmarkRun` per model and device.
- Produces: `PoseBenchmarkReport` with pooled and subgroup results, coverage, performance, failures, and a hard-gate verdict.

- [ ] **Step 1: Define the benchmark contract**

```ts
export const CRITICAL_JOINTS = [
  "leftShoulder", "rightShoulder", "leftElbow", "rightElbow",
  "leftWrist", "rightWrist", "leftHip", "rightHip",
  "leftKnee", "rightKnee", "leftAnkle", "rightAnkle",
  "leftHeel", "rightHeel", "leftFootIndex", "rightFootIndex",
] as const;

export type PoseBenchmarkManifest = {
  version: 1;
  lockedAt: string;
  clips: Array<{
    id: string;
    playerId: string;
    file: string;
    sha256: string;
    skill: "serve" | "attack" | "block" | "pass" | "set" | "defense";
    discipline: "indoor" | "beach" | "grass";
    target: { x: number; y: number; t: number };
    frames: Array<{
      timeS: number;
      view: "front" | "side" | "diagonal" | "ineligible";
      bodyHeightPx: number;
      joints: Partial<Record<(typeof CRITICAL_JOINTS)[number], { x: number; y: number; visible: boolean }>>;
    }>;
    reps: Array<{
      contactS: number | null;
      eligible: boolean;
      expected: Array<{ key: string; value: number; unit: "deg" | "body_height" | "shoulder_width" }>;
    }>;
  }>;
};

export type PoseFramePrediction = {
  clipId: string;
  timeS: number;
  targetMatched: boolean;
  pts: Landmark[] | null;
};

export type PoseBenchmarkRun = {
  modelId: PoseModelId;
  deviceId: string;
  engineTier: "webgpu" | "wasm";
  coldLoadMs: number;
  frames: PoseFramePrediction[];
  clips: Array<{
    clipId: string;
    passMs: number;
    effectiveFps: number | null;
    selectedTrack: boolean;
    measurements: MeasurementsBlock | null;
    workerError: string | null;
  }>;
};

export type PoseBenchmarkReport = {
  modelId: PoseModelId;
  pooledPck: number;
  jointPck: Record<string, number>;
  identityRate: number;
  eventRate: number;
  angleRate: number;
  abstentionRate: number;
  coverageRate: number;
  passBudgetRate: number;
  effectiveFpsRatio: number;
  lowerConfidenceBound: number;
  failures: string[];
};
```

`PoseBenchmarkRun` must also contain model id, engine tier, device id, cold-load milliseconds, pass milliseconds, effective FPS, selected-track result, raw 33-slot points at labeled frames, emitted measurements, and any worker error.

- [ ] **Step 2: Write failing tests at every hard boundary**

```ts
test("PCK accepts exactly 0.10 body heights", () => {
  assert.equal(withinPck({ x: 10, y: 10 }, { x: 20, y: 10 }, 100), true);
});

test("event timing accepts exactly two frames at 30 fps", () => {
  assert.equal(withinEventTolerance(1, 1 + 2 / 30), true);
});

test("a subgroup below 93 percent fails even when pooled accuracy passes", () => {
  const failures = criticalJointFailures({ leftWrist: 0.92, rightWrist: 0.99 });
  assert.deepEqual(failures, ["leftWrist localization below 93%"]);
});

test("coverage requires two emitted validated measurements", () => {
  assert.equal(repCovered([{ valid: true }, { valid: true }]), true);
  assert.equal(repCovered([{ valid: true }]), false);
});
```

- [ ] **Step 3: Implement the scoring rules as named pure functions**

Implement and export these exact functions:

```ts
withinPck(predicted, expected, bodyHeightPx): boolean
withinEventTolerance(predictedS, expectedS): boolean
withinMeasurementTolerance(predicted, expected, unit): boolean
repCovered(measurements): boolean
criticalJointFailures(jointPck): string[]
clusterBootstrapLowerBound(outcomes, clusterKey, seed, iterations): number
scorePoseRun(manifest, run): PoseBenchmarkReport
hardGateVerdict(report): { pass: boolean; failures: string[] }
```

Use 10% body height for PCK, 2/30 seconds for events, 10 degrees for angles, 0.10 body heights, 0.15 shoulder widths, 10,000 deterministic player-cluster bootstrap iterations, and the gate values in `docs/pose-model-selection.md`.

- [ ] **Step 4: Implement the CLI and report files**

The command:

```powershell
npm.cmd run pose:score -- evals/pose/locked-manifest.json evals/pose/results
```

must reject a manifest with fewer than 300 labeled frames, 12 distinct players, all six skills, or 60 eligible reps. It writes both `pose-model-report.json` and `pose-model-report.md`, lists every failed subgroup, and prints exactly one of:

```text
DECISION: retain body17-control
DECISION: qualify body26-candidate
DECISION: qualify dwpose-m-candidate
```

- [ ] **Step 5: Verify and commit the scorer**

Run: `npm.cmd test -- lib/pose/benchmark/scoring.test.ts`

Expected: all boundary, subgroup, and bootstrap determinism tests pass.

```powershell
git add lib/pose/benchmark scripts/score-pose-benchmark.ts package.json
git commit -m "test: add pose model benchmark scorer"
```

---

### Task 5: Build the development-only browser benchmark lab

**Phase:** 3. Automated benchmark

**Files:**
- Create: `lib/pose/benchmark/run-browser.ts`
- Create: `components/pose-benchmark-lab.tsx`
- Create: `app/pose-benchmark/page.tsx`

**Interfaces:**
- Consumes: local `locked-manifest.json` plus user-selected video files.
- Produces: one downloadable `PoseBenchmarkRun` JSON per model and execution tier.
- Uses: `loadPoseEngine({ modelId })`, `resetTracking()`, `detectPersonsFromVideo()`, and `extractFrames()`.

- [ ] **Step 1: Add a production-hidden route**

```tsx
import { notFound } from "next/navigation";
import { PoseBenchmarkLab } from "@/components/pose-benchmark-lab";

export default function PoseBenchmarkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PoseBenchmarkLab />;
}
```

- [ ] **Step 2: Implement the fixed-frame localization pass**

For every labeled frame, seek the local video to `timeS`, call `resetTracking()`, run detection once, select the person nearest the locked target point, and store all 33 normalized landmarks. Resetting before every frame forces a fresh, shared detector decision and prevents one candidate's box advection from contaminating the anatomical comparison.

```ts
export async function runLocalizationFrames(input: {
  modelId: PoseModelId;
  manifest: PoseBenchmarkManifest;
  files: Map<string, File>;
  onProgress: (done: number, total: number) => void;
}): Promise<PoseFramePrediction[]>;
```

- [ ] **Step 3: Implement the real full-clip pass**

For each clip, create a new engine for the selected candidate, call the existing `extractFrames(file, { pose: { engine, skill, target } })`, and persist:

```ts
{
  clipId,
  modelId,
  engine: extraction.pose?.measurements?.capture.engine,
  selectedTrackId: extraction.pose?.selectedTrackId,
  effectiveFps: extraction.pose?.denseFps,
  passMs: extraction.debug?.passMs,
  measurements: extraction.pose?.measurements,
  workerError: null,
}
```

Do not duplicate kinematics, smoothing, event detection, or metric calculation in the lab.

- [ ] **Step 4: Add minimal controls and export**

The lab must provide model selection, manifest selection, multi-file selection, start, cancel, progress, and download. It must display no result as passing; the CLI owns the verdict.

- [ ] **Step 5: Verify the lab in development and production builds**

Run:

```powershell
npm.cmd run dev
```

Expected at `http://localhost:3000/pose-benchmark`: all three models appear, a two-clip example run downloads valid JSON, and no console error occurs.

Then run:

```powershell
npm.cmd run build
npm.cmd run start
```

Expected at `/pose-benchmark`: 404 in the production build.

- [ ] **Step 6: Commit the lab**

```powershell
git add app/pose-benchmark/page.tsx components/pose-benchmark-lab.tsx lib/pose/benchmark/run-browser.ts
git commit -m "feat: add local pose benchmark lab"
```

---

### Task 6: Build and lock the volleyball ground-truth set

**Phase:** 2. Ground truth

**Files:**
- Create: `evals/pose/README.md`
- Create: `evals/pose/manifest.example.json`
- Create: `evals/pose/locked-manifest.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: the exact `PoseBenchmarkManifest` consumed by Task 4 and Task 5.

- [ ] **Step 1: Collect the minimum balanced set**

Collect at least 60 eligible reps and 300 labeled frames from at least 12 pseudonymous players. Cover every skill with at least 10 reps, both intermediate and expert levels, all three disciplines, and front, side, diagonal, motion-blurred, occluded, distant, and multi-player examples. Hold out by player, never by adjacent frame.

- [ ] **Step 2: Label only supported evidence**

For each visible critical joint, label image-space x and y, visibility, body height, view eligibility, target-player point, plant/contact/landing time, and any frozen measurement ground truth. Mark heels and toes unsupported for Body17 rather than incorrect.

- [ ] **Step 3: Double-label and adjudicate**

Two volleyball reviewers independently label all event times and at least 20% of joint frames. Adjudicate disagreements before locking. Record human-to-human agreement beside the system result; if reviewers do not meet a gate, treat that measure as experimental rather than lowering the model gate after seeing results.

- [ ] **Step 4: Hash the media and lock the manifest**

Store raw media only under `evals/pose/work/`. Put each file's SHA-256 in the committed manifest, sort clips and frames deterministically, and refuse benchmark execution when any local hash differs.

- [ ] **Step 5: Validate the locked set**

Run:

```powershell
npm.cmd run pose:score -- evals/pose/locked-manifest.json evals/pose/results
```

Expected before model results exist: the manifest passes composition validation and the CLI exits with `No complete model runs found`.

- [ ] **Step 6: Commit labels without media**

```powershell
git add .gitignore evals/pose/README.md evals/pose/manifest.example.json evals/pose/locked-manifest.json
git commit -m "test: lock volleyball pose benchmark"
```

---

### Task 7: Execute the locked benchmark and record the decision

**Phase:** 4. Model decision

**Files:**
- Create after execution: `evals/pose/results/pose-model-report.json`
- Create after execution: `evals/pose/results/pose-model-report.md`
- Modify: `docs/decisions.md`
- Modify: `docs/pose-model-selection.md`

**Interfaces:**
- Consumes: three complete model runs on each supported device tier.
- Produces: one explicit qualify-or-retain decision with every failure visible.

- [ ] **Step 1: Run every model under identical conditions**

Run Body17, Body26, and DWPose-m on:

1. Supported desktop Chrome with WebGPU.
2. The same desktop forced to WASM.
3. The representative mobile performance floor.

Capture one cold load, three warm full-dataset runs, effective FPS per clip, pass budget completion, worker errors, memory failures, and model cache behavior. Do not tune thresholds or labels after viewing candidate output.

- [ ] **Step 2: Generate the scored report**

Run:

```powershell
npm.cmd run pose:score -- evals/pose/locked-manifest.json evals/pose/results
```

Expected: one decision line, pooled and per-joint PCK, player-cluster lower bounds, identity rate, event rate, angle rate, abstention, coverage, effective FPS ratio, pass-budget rate, and reliability results.

- [ ] **Step 3: Apply the winner rule without discretion drift**

- Qualify Body26 when it passes every gate.
- Qualify DWPose-m only when it passes every gate, improves validated-measurement coverage or critical-joint localization by at least two percentage points over Body26, stays within the 10% FPS limit, and enables at least one validated measurement Body26 cannot provide.
- Retain Body17 when neither candidate passes.
- Never average away a joint, skill, view, device, or player-level failure.

- [ ] **Step 4: Record the measured decision**

Append the exact dataset hash, model hashes, device identifiers, browser versions, result-table path, failed gates, and selected model to D-023. Change `docs/pose-model-selection.md` status from provisional only if a candidate qualifies.

- [ ] **Step 5: Commit the decision artifact without raw runs**

Commit the compact report and decision record. Keep per-device raw outputs ignored if they contain local device or media metadata.

```powershell
git add docs/decisions.md docs/pose-model-selection.md evals/pose/results/pose-model-report.json evals/pose/results/pose-model-report.md
git commit -m "docs: record pose model benchmark decision"
```

---

### Task 8: Roll out the qualified winner with one-step rollback

**Phase:** 5 and 6. Preview and production rollout

**Files:**
- Modify only if a candidate qualifies: `.env.example`
- Modify only if a candidate qualifies: `lib/pose/rtm/pose-models.ts`
- Modify: `docs/deploy.md`
- Modify: `docs/acceptance.md`

**Interfaces:**
- Consumes: approved `PoseModelId` from D-023.
- Produces: an environment-selected production default with Body17 fallback.

- [ ] **Step 1: Add the explicit environment selector test**

```ts
test("only the D-023 approved model can override Body17", () => {
  assert.equal(productionPoseModelId("body26-candidate"), "body26-candidate");
  assert.equal(productionPoseModelId("dwpose-m-candidate"), "body17-control");
});
```

The accepted candidate in this test must match D-023. A retained-Body17 decision makes this task a documentation-only closeout.

- [ ] **Step 2: Make the approved id the preview environment value**

Set `NEXT_PUBLIC_POSE_MODEL_ID` only on the preview deployment. Do not remove Body17, its chunks, its hash, or its tests.

- [ ] **Step 3: Run the preview acceptance set**

Complete 25 eligible uploads covering all six skills, both execution tiers, multiple players, and at least five multi-player clips. Trigger rollback if any occurs:

- worker initialization or model hash failure;
- crash or out-of-memory failure;
- median effective FPS more than 10% below the locked control;
- fewer than 70% of eligible reps with two validated measurements;
- identity, event, angle, or joint accuracy below its locked gate;
- any supported device loses WASM fallback.

- [ ] **Step 4: Promote or roll back**

Promote by setting the same allowlisted id in production and deploying the already-verified commit. Roll back by setting `NEXT_PUBLIC_POSE_MODEL_ID=body17-control` and redeploying. No code revert, model deletion, or data migration is part of rollback.

- [ ] **Step 5: Run the post-release audit**

Repeat the same checks after 25 additional eligible production-path uploads. Keep Body17 and candidate assets available until this audit passes and one full release cycle completes.

- [ ] **Step 6: Commit rollout documentation**

```powershell
git add .env.example lib/pose/rtm/pose-models.ts docs/deploy.md docs/acceptance.md
git commit -m "feat: roll out qualified pose model"
```

---

### Task 9: Run the full release gate

**Phase:** 6. Production rollout

**Files:**
- Verify all files changed in Tasks 1 through 8.

**Interfaces:**
- Produces: evidence that the selected default did not regress the rest of Sideout.

- [ ] **Step 1: Run focused pose and benchmark tests**

```powershell
npm.cmd test -- lib/pose/rtm/landmark-adapters.test.ts lib/pose/rtm/pose-models.test.ts lib/pose/benchmark/scoring.test.ts scripts/prepare-pose-model.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run the full repository gate**

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: every command exits 0. Record the actual test count and build result in D-023.

- [ ] **Step 3: Verify production behavior manually**

Confirm on a clean-cache supported browser:

1. The approved model downloads from the same-origin bucket and hash verification passes.
2. WebGPU loads first where supported.
3. Forced WebGPU failure falls back to WASM.
4. A multi-player clip offers the same target selection.
5. A full trimmed clip completes and emits the approved engine id.
6. Setting `NEXT_PUBLIC_POSE_MODEL_ID=body17-control` restores the control without code changes.

- [ ] **Step 4: Review the final diff and commit only scoped work**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: no whitespace errors, no raw footage or ONNX binaries staged, no unrelated files, and no attribution trailers.

## Stop conditions

Stop and retain Body17 when any of these is true:

- candidate license or provenance cannot be verified;
- extracted ONNX exceeds the 75 MB cap without prior approval;
- reference output parity fails;
- a critical joint group falls below 93%;
- emitted measurement validity falls below 95%;
- eligible-rep coverage falls below 70%;
- target identity falls below 99%;
- effective FPS regresses more than 10% on any supported tier;
- full-clip completion falls below 95%;
- any supported device crashes, runs out of memory, or loses fallback;
- the locked dataset or thresholds changed after candidate output was viewed.

Passing a public model benchmark, drawing more joints, or looking smoother is never sufficient to override a stop condition.
