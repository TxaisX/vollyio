import { test } from "node:test";
import assert from "node:assert/strict";
import {
  angleAt,
  buildTracks,
  dedupePersons,
  detectJumpReps,
  detectPlatformReps,
  detectSwingReps,
  segmentFrames,
  smooth,
  standingBaseline,
  stddev,
} from "./kinematics.ts";
import {
  standingFrame,
  serveClip,
  blockClip,
  passClip,
  twoPersonClip,
  onePersonClip,
} from "./test-fixtures.ts";
import type { LandmarkFrame } from "./types.ts";

test("angleAt measures interior joint angles", () => {
  const a = { x: 0, y: 0, z: 0, v: 1 };
  const b = { x: 0, y: 1, z: 0, v: 1 };
  const c = { x: 1, y: 1, z: 0, v: 1 };
  assert.ok(Math.abs(angleAt(a, b, c) - 90) < 1e-6);
  const straight = { x: 0, y: 2, z: 0, v: 1 };
  assert.ok(Math.abs(angleAt(a, b, straight) - 180) < 1e-6);
});

test("smooth is a centered moving average", () => {
  assert.deepEqual(smooth([0, 3, 0], 1).map((v) => Math.round(v * 100) / 100), [1.5, 1, 1.5]);
});

test("stddev of a constant series is zero", () => {
  assert.equal(stddev([2, 2, 2, 2]), 0);
});

test("segmentFrames splits on time gaps", () => {
  const frames = [
    standingFrame(0),
    standingFrame(0.05),
    standingFrame(0.1),
    standingFrame(2.0),
    standingFrame(2.05),
  ];
  const segments = segmentFrames(frames);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].length, 3);
  assert.equal(segments[1].length, 2);
});

test("standingBaseline recovers body proportions from a calm clip", () => {
  const frames = Array.from({ length: 30 }, (_, i) => standingFrame(i / 30));
  const baseline = standingBaseline(frames);
  assert.ok(baseline);
  assert.ok(Math.abs(baseline.bodyHeight - 0.58) < 0.03, `bodyHeight=${baseline.bodyHeight}`);
  assert.ok(Math.abs(baseline.shoulderWidth - 0.12) < 0.02);
  assert.ok(Math.abs(baseline.footY - 0.86) < 0.02);
});

test("swing detector finds exactly one serve swing at contact time", () => {
  const frames = serveClip();
  const baseline = standingBaseline(frames);
  const reps = detectSwingReps(frames, baseline);
  assert.equal(reps.length, 1);
  assert.ok(reps[0].contactS != null);
  assert.ok(Math.abs(reps[0].contactS! - 2.2) < 0.2, `contact=${reps[0].contactS}`);
  assert.ok(reps[0].fit > 0.4);
});

test("swing detector stays silent on a calm clip", () => {
  const frames = Array.from({ length: 90 }, (_, i) => standingFrame(i / 30));
  const reps = detectSwingReps(frames, standingBaseline(frames));
  assert.equal(reps.length, 0);
});

test("jump detector finds the block jump with hands overhead", () => {
  const frames = blockClip();
  const baseline = standingBaseline(frames);
  const reps = detectJumpReps(frames, baseline);
  assert.equal(reps.length, 1);
  assert.ok(Math.abs(reps[0].contactS! - 1.55) < 0.25, `apex=${reps[0].contactS}`);
});

test("platform detector finds the pass and anchors contact at the impulse", () => {
  const frames = passClip();
  const baseline = standingBaseline(frames);
  const reps = detectPlatformReps(frames, baseline);
  assert.equal(reps.length, 1);
  assert.ok(reps[0].contactS! >= 1.55 && reps[0].contactS! <= 1.75, `contact=${reps[0].contactS}`);
});

test("platform detector ignores hanging arms", () => {
  const frames = Array.from({ length: 90 }, (_, i) => standingFrame(i / 30));
  const reps = detectPlatformReps(frames, standingBaseline(frames));
  assert.equal(reps.length, 0);
});

test("buildTracks separates two players and ranks the active one first", () => {
  const tracks = buildTracks(twoPersonClip());
  assert.equal(tracks.length, 2);
  // The serving player (higher motion) ranks first.
  assert.ok(tracks[0].motion > tracks[1].motion,
    `motion ${tracks[0].motion} vs ${tracks[1].motion}`);
  // Association kept the players apart: track centers stay on their sides.
  const meanX = (frames: LandmarkFrame[]) =>
    frames.reduce((a, f) => a + f.pts[23].x, 0) / frames.length;
  const xs = [meanX(tracks[0].frames), meanX(tracks[1].frames)].sort((a, b) => a - b);
  assert.ok(xs[0] < 0.45 && xs[1] > 0.55, `centers ${xs}`);
  // Both tracks cover most of the clip.
  for (const t of tracks) assert.ok(t.frames.length > 60, `frames ${t.frames.length}`);
});

test("buildTracks handles a single player", () => {
  const tracks = buildTracks(onePersonClip());
  assert.equal(tracks.length, 1);
  assert.ok(tracks[0].score > 0.5);
});

test("dedupePersons collapses overlapping detections of one body", () => {
  const base = standingFrame(0).pts;
  const jitter = base.map((p) => ({ ...p, x: p.x + 0.015, v: 0.8 }));
  const far = base.map((p) => ({ ...p, x: p.x + 0.3 }));
  const kept = dedupePersons([base, jitter, far]);
  assert.equal(kept.length, 2);
  // The higher-visibility duplicate survives.
  assert.ok(kept.some((p) => p[0].v > 0.9));
});

test("buildTracks is immune to duplicate detections per frame", () => {
  const doubled = onePersonClip().map((f) => ({
    t: f.t,
    persons: [
      f.persons[0],
      f.persons[0].map((p) => ({ ...p, x: p.x + 0.01, v: 0.7 })),
    ],
  }));
  const tracks = buildTracks(doubled);
  assert.equal(tracks.length, 1, `expected 1 track, got ${tracks.length}`);
});
