import { test } from "node:test";
import assert from "node:assert/strict";
import { createMonotonicClock } from "./types.ts";
import {
  angleAt,
  buildTracks,
  dedupePersons,
  detectJumpReps,
  detectPlatformReps,
  detectSwingReps,
  focusPoint,
  focusRegionAround,
  headPoint,
  pickTargetTrack,
  hipCenter,
  mapRegionPersons,
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

test("mapRegionPersons maps crop landmarks back to full-frame coordinates", () => {
  const region = { left: 0.5, top: 0.25, width: 0.4, height: 0.5 };
  const [mapped] = mapRegionPersons(
    [[{ x: 0.5, y: 0.5, z: 0.1, v: 0.9 }]],
    region,
  );
  assert.ok(Math.abs(mapped[0].x - 0.7) < 1e-9);
  assert.ok(Math.abs(mapped[0].y - 0.5) < 1e-9);
  assert.ok(Math.abs(mapped[0].z - 0.04) < 1e-9);
  assert.equal(mapped[0].v, 0.9);
});

test("focusRegionAround pads the box and clamps to the frame", () => {
  const box = { left: 0.1, top: 0.1, width: 0.1, height: 0.2 };
  const centered = focusRegionAround(0.5, 0.5, box);
  assert.ok(centered.width >= 0.25 && centered.width <= 1, `w=${centered.width}`);
  assert.ok(Math.abs(centered.left + centered.width / 2 - 0.5) < 1e-9);
  const corner = focusRegionAround(0.02, 0.98, box);
  assert.ok(corner.left >= 0 && corner.top + corner.height <= 1 + 1e-9);
  const huge = focusRegionAround(0.5, 0.5, { left: 0, top: 0, width: 0.9, height: 0.9 });
  assert.ok(huge.width <= 1 && huge.height <= 1);
});

test("headPoint finds the nose, falls back to the ears, else null", () => {
  const pts = standingFrame(0).pts;
  const head = headPoint(pts);
  assert.ok(head);
  assert.ok(head!.y < 0.4, `head y=${head!.y} should sit high on the body`);
  const noNose = pts.map((p, i) => (i === 0 ? { ...p, v: 0.1 } : p));
  assert.ok(headPoint(noNose), "ears fallback");
  const faceless = pts.map((p, i) => (i <= 10 ? { ...p, v: 0.1 } : p));
  assert.equal(headPoint(faceless), null);
});

test("hipCenter uses the hips when visible and falls back to the centroid", () => {
  const pts = standingFrame(0).pts;
  const c = hipCenter(pts);
  assert.ok(c);
  assert.ok(Math.abs(c!.x - 0.5) < 0.05);
  const hidden = pts.map((p, i) => (i === 23 || i === 24 ? { ...p, v: 0.1 } : p));
  assert.ok(hipCenter(hidden), "centroid fallback still places the person");
  const invisible = pts.map((p) => ({ ...p, v: 0.1 }));
  assert.equal(hipCenter(invisible), null);
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

test("pickTargetTrack matches the framed player and refuses strangers", () => {
  const tracks = buildTracks(twoPersonClip());
  assert.equal(tracks.length, 2);
  const t = tracks[0].frames[Math.floor(tracks[0].frames.length / 2)];
  const anchor = focusPoint(t.pts)!;
  // A frame dropped on the player's own anchor picks their track.
  const hit = pickTargetTrack(tracks, { x: anchor.x, y: anchor.y, t: t.t });
  assert.equal(hit?.id, tracks[0].id);
  // A frame in empty space matches nobody rather than the nearest stranger.
  assert.equal(pickTargetTrack(tracks, { x: 0.02, y: 0.02, t: t.t }), null);
  // A drawn box buys tolerance: the framed point sits 0.4 below the anchor
  // (outside the bare 0.35 budget) but the anchor is inside the tall drawn
  // box, so the match survives — while the box stays narrow enough in x that
  // the other athlete (0.4 away horizontally) is not captured by it.
  const boxed = pickTargetTrack(tracks, {
    x: anchor.x,
    y: anchor.y + 0.4,
    t: t.t,
    box: { left: anchor.x - 0.1, top: anchor.y - 0.1, width: 0.2, height: 0.6 },
  });
  assert.equal(boxed?.id, tracks[0].id);
});

test("monotonic clock keeps real spacing and rebases on regressions", () => {
  const clock = createMonotonicClock();
  // A monotonic run passes through with true inter-frame deltas.
  const a = clock(1000);
  const b = clock(1033);
  const c = clock(1100);
  assert.equal(b - a, 33);
  assert.equal(c - b, 67);
  // The next capture phase revisits an earlier clip time: output stays
  // strictly increasing, and the run that follows keeps its real deltas.
  const d = clock(500);
  assert.ok(d > c, `expected ${d} > ${c}`);
  const e = clock(540);
  assert.ok(Math.abs(e - d - 40) < 1e-6, `expected 40ms spacing, got ${e - d}`);
  // Identical timestamps never stall the stream.
  const f = clock(540);
  assert.ok(f > e);
});
