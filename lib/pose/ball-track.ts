// DOM-free helpers for the on-device ball track (D-019): clean raw sports-ball
// detections into a physically plausible path, and project that path onto the
// sent analysis frames as ball marks the model and viewer can trust.

import type { BallPoint } from "./types.ts";

// Detections below this confidence are noise more often than ball. Calibrated
// against the repo's real volleyball photo, where the ball detects at 0.22:
// the floor matches the detector threshold and the speed gate downstream
// rejects the stray false positives this admits.
const MIN_SCORE = 0.2;
// Normalized units per second: a serve can cross the full frame in ~0.3s, so
// the gate sits well above that; only teleports (misdetections) exceed it.
const MAX_SPEED = 5;
// Base slack so tiny dt values do not turn jitter into "teleports".
const SPEED_SLACK = 0.06;
// Two consecutive mutually-consistent outliers mean the ball really is
// somewhere new (fast play, missed frames): re-lock there.
const RELOCK_AGREEMENT = 0.12;
// A cleaned track shorter than this says the detector never really found the
// ball; callers should not present such a track as measured.
export const MIN_TRACK_POINTS = 8;
// A sent frame gets a tracked mark when a path point sits within this window.
const FRAME_TOLERANCE_S = 0.2;

/** Sort, de-dupe, confidence-filter, and speed-gate raw ball detections. */
export function cleanBallTrack(raw: BallPoint[]): BallPoint[] {
  const sorted = raw
    .filter(
      (p) =>
        p.score >= MIN_SCORE &&
        Number.isFinite(p.t) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1,
    )
    .sort((a, b) => a.t - b.t);

  // Near-simultaneous detections (multiple windows over the same instant):
  // keep the higher score.
  const deduped: BallPoint[] = [];
  for (const p of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && p.t - last.t < 0.03) {
      if (p.score > last.score) deduped[deduped.length - 1] = p;
    } else {
      deduped.push(p);
    }
  }

  const out: BallPoint[] = [];
  let outlier: BallPoint | null = null;
  for (const p of deduped) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      continue;
    }
    const dt = Math.max(0.016, p.t - last.t);
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist <= MAX_SPEED * dt + SPEED_SLACK) {
      out.push(p);
      outlier = null;
      continue;
    }
    // Too far from the accepted path. One agreeing follow-up point means the
    // path, not this detection, was stale: re-lock onto the new position.
    if (outlier && Math.hypot(p.x - outlier.x, p.y - outlier.y) <= RELOCK_AGREEMENT) {
      out.push(outlier, p);
      outlier = null;
    } else {
      outlier = p;
    }
  }
  return out;
}

export type SentFrameRef = {
  index: number;
  time_s: number | null;
  crop?: { left: number; top: number; width: number; height: number } | null;
};

export type TrackedBallMark = {
  frame_index: number;
  x: number;
  y: number;
  visible: boolean;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Project the cleaned path onto the sent frames, in each frame's own
 * coordinate space (cropped frames carry their window). Frames with no path
 * point nearby, and balls outside a frame's crop, are honest non-measurements:
 * visible false at the 0.5/0.5 convention the model output already uses.
 */
export function ballMarksForFrames(
  track: BallPoint[],
  frames: SentFrameRef[],
): TrackedBallMark[] {
  return frames.map((f) => {
    let best: BallPoint | null = null;
    let bestD = FRAME_TOLERANCE_S;
    if (f.time_s != null) {
      for (const p of track) {
        const d = Math.abs(p.t - f.time_s);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    if (!best) return { frame_index: f.index, x: 0.5, y: 0.5, visible: false };
    const c = f.crop;
    const x = c ? (best.x - c.left) / c.width : best.x;
    const y = c ? (best.y - c.top) / c.height : best.y;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return { frame_index: f.index, x: 0.5, y: 0.5, visible: false };
    }
    return { frame_index: f.index, x: r3(x), y: r3(y), visible: true };
  });
}

/** Linear interpolation along the timed path; null outside it or across gaps. */
export function ballAtTime(
  track: BallPoint[],
  timeS: number,
  maxGapS = 0.6,
): { x: number; y: number } | null {
  if (track.length === 0) return null;
  let before: BallPoint | null = null;
  let after: BallPoint | null = null;
  for (const p of track) {
    if (p.t <= timeS) before = p;
    else {
      after = p;
      break;
    }
  }
  if (before && Math.abs(before.t - timeS) < 0.05) return { x: before.x, y: before.y };
  if (after && Math.abs(after.t - timeS) < 0.05) return { x: after.x, y: after.y };
  if (!before || !after) return null;
  if (after.t - before.t > maxGapS) return null;
  const f = (timeS - before.t) / (after.t - before.t);
  return {
    x: before.x + (after.x - before.x) * f,
    y: before.y + (after.y - before.y) * f,
  };
}
