import assert from "node:assert/strict";
import { test } from "node:test";
import { ballAtTime, ballMarksForFrames, cleanBallTrack } from "./ball-track.ts";
import type { BallPoint } from "./types.ts";

const p = (t: number, x: number, y: number, score = 0.8): BallPoint => ({ t, x, y, score });

test("cleanBallTrack drops low-confidence and out-of-range detections", () => {
  const track = cleanBallTrack([
    p(0.1, 0.5, 0.5),
    p(0.2, 0.52, 0.48, 0.1),
    p(0.3, 1.4, 0.5),
    p(0.4, 0.55, 0.44),
  ]);
  assert.deepEqual(
    track.map((b) => b.t),
    [0.1, 0.4],
  );
});

test("cleanBallTrack rejects a lone teleport but keeps the path", () => {
  const track = cleanBallTrack([
    p(0.0, 0.2, 0.5),
    p(0.1, 0.25, 0.48),
    p(0.13, 0.9, 0.1), // teleport, never corroborated
    p(0.2, 0.3, 0.46),
  ]);
  assert.deepEqual(
    track.map((b) => b.x),
    [0.2, 0.25, 0.3],
  );
});

test("cleanBallTrack re-locks when two consecutive outliers agree", () => {
  const track = cleanBallTrack([
    p(0.0, 0.2, 0.8),
    p(0.05, 0.21, 0.8),
    // Detector lost the ball for a second; it reappears far away and stays.
    p(1.1, 0.8, 0.2),
    p(1.15, 0.82, 0.21),
    p(1.2, 0.84, 0.22),
  ]);
  assert.equal(track.length, 5);
  assert.equal(track[track.length - 1].x, 0.84);
});

test("cleanBallTrack keeps the higher score among near-simultaneous points", () => {
  const track = cleanBallTrack([p(0.5, 0.4, 0.4, 0.5), p(0.51, 0.42, 0.41, 0.9)]);
  assert.equal(track.length, 1);
  assert.equal(track[0].x, 0.42);
});

test("ballMarksForFrames maps into crop space and flags outside-crop as not visible", () => {
  const track = [p(1.0, 0.5, 0.5), p(2.0, 0.9, 0.2)];
  const marks = ballMarksForFrames(track, [
    { index: 0, time_s: 1.0, crop: { left: 0.25, top: 0.25, width: 0.5, height: 0.5 } },
    { index: 1, time_s: 2.0, crop: { left: 0.25, top: 0.25, width: 0.5, height: 0.5 } },
    { index: 2, time_s: 5.0 },
    { index: 3, time_s: null },
  ]);
  assert.deepEqual(marks[0], { frame_index: 0, x: 0.5, y: 0.5, visible: true });
  assert.equal(marks[1].visible, false); // 0.9,0.2 falls outside the crop
  assert.equal(marks[2].visible, false); // no path point within tolerance
  assert.equal(marks[3].visible, false); // untimed frame
});

test("ballMarksForFrames uses full-frame coords when uncropped", () => {
  const marks = ballMarksForFrames([p(1.0, 0.7, 0.3)], [{ index: 0, time_s: 1.05 }]);
  assert.deepEqual(marks[0], { frame_index: 0, x: 0.7, y: 0.3, visible: true });
});

test("ballAtTime interpolates linearly between neighbors", () => {
  const at = ballAtTime([p(1.0, 0.2, 0.8), p(1.4, 0.6, 0.4)], 1.2);
  assert.ok(at);
  assert.ok(Math.abs(at.x - 0.4) < 1e-9);
  assert.ok(Math.abs(at.y - 0.6) < 1e-9);
});

test("ballAtTime refuses to bridge long gaps or extrapolate", () => {
  const track = [p(1.0, 0.2, 0.8), p(3.0, 0.6, 0.4)];
  assert.equal(ballAtTime(track, 2.0), null);
  assert.equal(ballAtTime(track, 0.5), null);
  assert.equal(ballAtTime(track, 3.5), null);
});
