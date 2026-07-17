// Synthetic landmark sequences for the kinematics and metrics test suites.
// These encode the geometric shape of each rep family precisely enough to
// exercise detectors, metrics, confidence, and omission. Recorded real-footage
// fixtures replace or extend these as clips become available.

import { LM, POSE_LANDMARK_COUNT, type Landmark, type LandmarkFrame } from "./types.ts";

export const FPS = 30;
const DT = 1 / FPS;

type Overrides = Partial<Record<number, Partial<Landmark>>>;

// Standing figure, camera-facing, normalized image space. Head top ~0.28,
// heels ~0.86, so body height is ~0.58 image units.
export function standingFrame(t: number, overrides: Overrides = {}, visibility = 0.95): LandmarkFrame {
  const pts: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    v: visibility,
  }));
  const put = (i: number, x: number, y: number) => {
    pts[i] = { x, y, z: 0, v: visibility };
  };
  put(LM.nose, 0.5, 0.3);
  put(LM.leftEar, 0.48, 0.28);
  put(LM.rightEar, 0.52, 0.28);
  put(LM.leftShoulder, 0.44, 0.4);
  put(LM.rightShoulder, 0.56, 0.4);
  put(LM.leftElbow, 0.43, 0.5);
  put(LM.rightElbow, 0.57, 0.5);
  put(LM.leftWrist, 0.44, 0.6);
  put(LM.rightWrist, 0.56, 0.6);
  put(LM.leftHip, 0.47, 0.55);
  put(LM.rightHip, 0.53, 0.55);
  put(LM.leftKnee, 0.47, 0.7);
  put(LM.rightKnee, 0.53, 0.7);
  put(LM.leftAnkle, 0.47, 0.85);
  put(LM.rightAnkle, 0.53, 0.85);
  put(LM.leftHeel, 0.47, 0.86);
  put(LM.rightHeel, 0.53, 0.86);
  put(LM.leftFootIndex, 0.46, 0.86);
  put(LM.rightFootIndex, 0.54, 0.86);
  for (const [index, patch] of Object.entries(overrides)) {
    const i = Number(index);
    pts[i] = { ...pts[i], ...patch };
  }
  return { t, pts };
}

function range(startS: number, endS: number): number[] {
  const out: number[] = [];
  for (let t = startS; t < endS - 1e-9; t += DT) out.push(Math.round(t * 1000) / 1000);
  return out;
}

// A right-handed serve: calm stance, off-hand toss, fast overhead swing with
// contact at the wrist's highest, fastest point, then follow-through.
export function serveClip(visibility = 0.95): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  for (const t of range(0, 1.5)) frames.push(standingFrame(t, {}, visibility));
  // Toss: left wrist rises from 0.60 to 0.20 between 1.5s and 2.0s.
  for (const t of range(1.5, 2.0)) {
    const k = (t - 1.5) / 0.5;
    frames.push(
      standingFrame(t, { [LM.leftWrist]: { y: 0.6 - 0.4 * k, x: 0.44 + 0.02 * k } }, visibility),
    );
  }
  // Swing: right wrist accelerates from 0.60 up to 0.14 between 2.0s and
  // 2.2s (quadratic ramp, so peak speed lands at contact), elbow rising.
  for (const t of range(2.0, 2.2)) {
    const k = (t - 2.0) / 0.2;
    frames.push(
      standingFrame(
        t,
        {
          [LM.rightWrist]: { y: 0.6 - 0.46 * k * k, x: 0.56 + 0.03 * k },
          [LM.rightElbow]: { y: 0.5 - 0.22 * k },
          [LM.leftWrist]: { y: 0.2 },
        },
        visibility,
      ),
    );
  }
  // Follow-through: wrist decelerates forward and down.
  for (const t of range(2.2, 2.6)) {
    const k = (t - 2.2) / 0.4;
    frames.push(
      standingFrame(
        t,
        {
          [LM.rightWrist]: { y: 0.14 + 0.3 * k, x: 0.59 + 0.05 * k },
          [LM.rightElbow]: { y: 0.28 + 0.15 * k },
          [LM.leftWrist]: { y: 0.2 + 0.3 * k },
        },
        visibility,
      ),
    );
  }
  // Recovery: arms ease back to the hanging stance continuously so the
  // series has no teleport discontinuities.
  for (const t of range(2.6, 3.0)) {
    const k = (t - 2.6) / 0.4;
    frames.push(
      standingFrame(
        t,
        {
          [LM.rightWrist]: { y: 0.44 + 0.16 * k, x: 0.64 - 0.08 * k },
          [LM.rightElbow]: { y: 0.43 + 0.07 * k },
          [LM.leftWrist]: { y: 0.5 + 0.1 * k },
        },
        visibility,
      ),
    );
  }
  for (const t of range(3.0, 3.4)) frames.push(standingFrame(t, {}, visibility));
  return frames;
}

// A block: dip, jump with both hands above the head, land.
export function blockClip(): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  for (const t of range(0, 1.0)) frames.push(standingFrame(t));
  // Hands rise overhead.
  for (const t of range(1.0, 1.3)) {
    const k = (t - 1.0) / 0.3;
    frames.push(
      standingFrame(t, {
        [LM.leftWrist]: { y: 0.6 - 0.42 * k, x: 0.46 },
        [LM.rightWrist]: { y: 0.6 - 0.42 * k, x: 0.54 },
        [LM.leftElbow]: { y: 0.5 - 0.2 * k },
        [LM.rightElbow]: { y: 0.5 - 0.2 * k },
      }),
    );
  }
  // Jump: whole body rises 0.08 between 1.3 and 1.55, apex, then lands.
  const lift = (k: number): Overrides => ({
    [LM.leftWrist]: { y: 0.18 - 0.08 * k, x: 0.46 },
    [LM.rightWrist]: { y: 0.18 - 0.08 * k, x: 0.54 },
    [LM.leftElbow]: { y: 0.3 - 0.08 * k },
    [LM.rightElbow]: { y: 0.3 - 0.08 * k },
    [LM.nose]: { y: 0.3 - 0.08 * k },
    [LM.leftEar]: { y: 0.28 - 0.08 * k },
    [LM.rightEar]: { y: 0.28 - 0.08 * k },
    [LM.leftShoulder]: { y: 0.4 - 0.08 * k },
    [LM.rightShoulder]: { y: 0.4 - 0.08 * k },
    [LM.leftHip]: { y: 0.55 - 0.08 * k },
    [LM.rightHip]: { y: 0.55 - 0.08 * k },
    [LM.leftKnee]: { y: 0.7 - 0.08 * k },
    [LM.rightKnee]: { y: 0.7 - 0.08 * k },
    [LM.leftAnkle]: { y: 0.85 - 0.08 * k },
    [LM.rightAnkle]: { y: 0.85 - 0.08 * k },
    [LM.leftHeel]: { y: 0.86 - 0.08 * k },
    [LM.rightHeel]: { y: 0.86 - 0.08 * k },
    [LM.leftFootIndex]: { y: 0.86 - 0.08 * k },
    [LM.rightFootIndex]: { y: 0.86 - 0.08 * k },
  });
  for (const t of range(1.3, 1.55)) frames.push(standingFrame(t, lift((t - 1.3) / 0.25)));
  for (const t of range(1.55, 1.8)) frames.push(standingFrame(t, lift(1 - (t - 1.55) / 0.25)));
  // Land with knee bend.
  for (const t of range(1.8, 2.1)) {
    const k = Math.min(1, (t - 1.8) / 0.15);
    frames.push(
      standingFrame(t, {
        [LM.leftWrist]: { y: 0.18 + 0.3 * k, x: 0.46 },
        [LM.rightWrist]: { y: 0.18 + 0.3 * k, x: 0.54 },
        [LM.leftKnee]: { y: 0.7 + 0.03 * k, x: 0.45 },
        [LM.rightKnee]: { y: 0.7 + 0.03 * k, x: 0.55 },
        [LM.leftHip]: { y: 0.55 + 0.05 * k },
        [LM.rightHip]: { y: 0.55 + 0.05 * k },
      }),
    );
  }
  for (const t of range(2.1, 3.0)) frames.push(standingFrame(t));
  return frames;
}

// A forearm pass: platform forms (wrists together, low), holds still, small
// impulse at contact, then release.
export function passClip(): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  for (const t of range(0, 1.0)) frames.push(standingFrame(t));
  const platform: Overrides = {
    [LM.leftWrist]: { x: 0.49, y: 0.62 },
    [LM.rightWrist]: { x: 0.51, y: 0.62 },
    [LM.leftElbow]: { x: 0.46, y: 0.54 },
    [LM.rightElbow]: { x: 0.54, y: 0.54 },
    [LM.leftKnee]: { y: 0.72 },
    [LM.rightKnee]: { y: 0.72 },
  };
  for (const t of range(1.0, 1.6)) frames.push(standingFrame(t, platform));
  // Contact impulse: platform lifts quickly.
  for (const t of range(1.6, 1.7)) {
    const k = (t - 1.6) / 0.1;
    frames.push(
      standingFrame(t, {
        ...platform,
        [LM.leftWrist]: { x: 0.49, y: 0.62 - 0.08 * k },
        [LM.rightWrist]: { x: 0.51, y: 0.62 - 0.08 * k },
      }),
    );
  }
  for (const t of range(1.7, 2.6)) frames.push(standingFrame(t));
  return frames;
}

// Two-player scene: person A (shifted left) performs the serve, person B
// (shifted right) stands idle. Person order alternates per frame to exercise
// track association.
export function twoPersonClip(): import("./types.ts").PersonFrame[] {
  const shift = (pts: Landmark[], dx: number): Landmark[] =>
    pts.map((p) => ({ ...p, x: p.x + dx }));
  const server = serveClip();
  return server.map((frame, i) => {
    const a = shift(frame.pts, -0.18);
    const b = shift(standingFrame(frame.t).pts, 0.22);
    return { t: frame.t, persons: i % 2 === 0 ? [a, b] : [b, a] };
  });
}

// Single-player scene wrapped in the multi-person shape.
export function onePersonClip(): import("./types.ts").PersonFrame[] {
  return serveClip().map((frame) => ({ t: frame.t, persons: [frame.pts] }));
}

// Two players of the same build at the same depth walking through each other:
// A crosses left to right, B right to left, meeting mid-frame. Rally-realistic
// scale (each ~30% of frame height) so they are distinct bodies, not one blob.
// Position alone cannot resolve the meeting point; only motion can.
export function crossingPlayersClip(): import("./types.ts").PersonFrame[] {
  const place = (cx: number, cy: number, h: number): Landmark[] => {
    const s = h / 0.58;
    return standingFrame(0).pts.map((p) => ({
      ...p,
      x: cx + (p.x - 0.5) * s,
      y: cy + (p.y - 0.57) * s,
    }));
  };
  return range(0, 2).map((t) => {
    const u = t / 2;
    return {
      t,
      persons: [place(0.35 + 0.3 * u, 0.55, 0.3), place(0.65 - 0.3 * u, 0.55, 0.3)],
    };
  });
}
