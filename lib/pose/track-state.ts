// Track continuity over the followed player's landmark timeline. Pure and
// DOM-free: consumes the selected track's frames and labels what happened to
// the player between observations — held, briefly hidden (occluded), or gone
// through a frame edge (off_frame) — plus an overall coverage number.
//
// Honesty rule: dense capture is windowed around motion peaks, so a long gap
// between observations is usually a SAMPLING gap, not player absence. A gap
// is only called an absence when the evidence supports it: short enough that
// the window was still open (occlusion), or preceded by the player moving out
// through a frame edge (off_frame). Everything else is left unlabeled.

import type { LandmarkFrame } from "./types.ts";
import { focusPoint } from "./kinematics.ts";

export type FrameEdge = "left" | "right" | "top" | "bottom";

export type TrackAbsence = {
  kind: "occluded" | "off_frame";
  edge?: FrameEdge;
  startS: number;
  // Next time the player was observed again; null = never seen again.
  returnedAtS: number | null;
};

export type TrackContinuity = {
  // Observed time / (observed time + evidenced absence time), 0..1.
  coverage: number;
  absences: TrackAbsence[];
  // The clip ended (or observations ended) during an unresolved exit.
  lost: boolean;
};

const EDGE_MARGIN = 0.08; // how close to a frame edge counts as "at" it
const OUTWARD_V_MIN = 0.04; // normalized units/s toward the edge
const OCCLUSION_MAX_S = 0.8; // longer unexplained gaps read as sampling gaps
const EXIT_MAX_S = 6.0; // an evidenced exit can span this long and still count
const VELOCITY_WINDOW = 5; // frames used for the least-squares velocity fit

// Least-squares velocity of the focus anchor over the last `n` frames ending
// at index `end` (inclusive). Two-point diffs amplify jitter; the fit does not.
function anchorVelocity(
  frames: LandmarkFrame[],
  end: number,
  n = VELOCITY_WINDOW,
): { vx: number; vy: number } | null {
  const pts: { t: number; x: number; y: number }[] = [];
  for (let i = Math.max(0, end - n + 1); i <= end; i++) {
    const c = focusPoint(frames[i].pts);
    if (c) pts.push({ t: frames[i].t, x: c.x, y: c.y });
  }
  if (pts.length < 3) return null;
  const mt = pts.reduce((a, p) => a + p.t, 0) / pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let stt = 0;
  let stx = 0;
  let sty = 0;
  for (const p of pts) {
    stt += (p.t - mt) ** 2;
    stx += (p.t - mt) * (p.x - mx);
    sty += (p.t - mt) * (p.y - my);
  }
  if (stt < 1e-9) return null;
  return { vx: stx / stt, vy: sty / stt };
}

// The edge the player was moving out through at frame index `end`, if any.
function exitEdge(frames: LandmarkFrame[], end: number): FrameEdge | null {
  const c = focusPoint(frames[end].pts);
  const v = anchorVelocity(frames, end);
  if (!c || !v) return null;
  if (c.x <= EDGE_MARGIN && v.vx < -OUTWARD_V_MIN) return "left";
  if (c.x >= 1 - EDGE_MARGIN && v.vx > OUTWARD_V_MIN) return "right";
  if (c.y <= EDGE_MARGIN && v.vy < -OUTWARD_V_MIN) return "top";
  if (c.y >= 1 - EDGE_MARGIN && v.vy > OUTWARD_V_MIN) return "bottom";
  return null;
}

export function trackContinuity(frames: LandmarkFrame[]): TrackContinuity | null {
  if (frames.length < 8) return null;
  const sorted = [...frames].sort((a, b) => a.t - b.t);

  const dts: number[] = [];
  for (let i = 1; i < sorted.length; i++) dts.push(sorted[i].t - sorted[i - 1].t);
  const medianDt = [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)];
  const gapFloor = Math.max(0.3, medianDt * 4);

  const absences: TrackAbsence[] = [];
  let observed = 0;
  let absent = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].t - sorted[i - 1].t;
    if (gap < gapFloor) {
      observed += gap;
      continue;
    }
    const edge = exitEdge(sorted, i - 1);
    if (edge && gap <= EXIT_MAX_S) {
      absences.push({
        kind: "off_frame",
        edge,
        startS: sorted[i - 1].t,
        returnedAtS: sorted[i].t,
      });
      absent += gap;
    } else if (gap <= OCCLUSION_MAX_S) {
      absences.push({ kind: "occluded", startS: sorted[i - 1].t, returnedAtS: sorted[i].t });
      absent += gap;
    }
    // Anything else is a sampling gap between capture windows: no claim.
  }

  // An exit at the very end of the observations never resolves.
  const lastEdge = exitEdge(sorted, sorted.length - 1);
  let lost = false;
  if (lastEdge) {
    absences.push({
      kind: "off_frame",
      edge: lastEdge,
      startS: sorted[sorted.length - 1].t,
      returnedAtS: null,
    });
    lost = true;
  }

  const denom = observed + absent;
  return {
    coverage: denom > 0 ? Math.min(1, Math.max(0, observed / denom)) : 1,
    absences,
    lost,
  };
}

const EDGE_LABEL: Record<FrameEdge, string> = {
  left: "left",
  right: "right",
  top: "high",
  bottom: "low",
};

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// One human sentence about how the follow went; null when there is nothing
// worth saying (clean follow, no absences).
export function continuityNote(c: TrackContinuity): string | null {
  const first = c.absences[0];
  if (!first) return null;
  const parts: string[] = [];
  if (first.kind === "off_frame") {
    parts.push(`Left frame ${EDGE_LABEL[first.edge ?? "left"]} at ${clock(first.startS)}`);
    parts.push(
      first.returnedAtS != null ? `back by ${clock(first.returnedAtS)}` : "not seen again",
    );
  } else {
    parts.push(`Briefly hidden at ${clock(first.startS)}`);
    if (first.returnedAtS != null) parts.push(`back by ${clock(first.returnedAtS)}`);
  }
  if (c.coverage < 0.995) {
    parts.push(`followed ${Math.round(c.coverage * 100)}% of the tracked play`);
  }
  return parts.join(" · ") + ".";
}
