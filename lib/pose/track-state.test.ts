import { test } from "node:test";
import assert from "node:assert/strict";
import { trackContinuity, continuityNote } from "./track-state.ts";
import { standingFrame } from "./test-fixtures.ts";
import type { LandmarkFrame } from "./types.ts";

// A person standing at horizontal offset dx from their fixture position.
function shifted(t: number, dx: number): LandmarkFrame {
  const f = standingFrame(t);
  return { t, pts: f.pts.map((p) => ({ ...p, x: Math.min(1, Math.max(0, p.x + dx)) })) };
}

function run(fromS: number, toS: number, dx = 0, fps = 30): LandmarkFrame[] {
  const out: LandmarkFrame[] = [];
  for (let t = fromS; t <= toS + 1e-9; t += 1 / fps) {
    out.push(shifted(Math.round(t * 1000) / 1000, dx));
  }
  return out;
}

test("a clean continuous follow reports full coverage and nothing else", () => {
  const c = trackContinuity(run(0, 4));
  assert.ok(c);
  assert.ok(c.coverage > 0.99, `coverage=${c.coverage}`);
  assert.equal(c.absences.length, 0);
  assert.equal(c.lost, false);
  assert.equal(continuityNote(c), null);
});

test("a short mid-play hole away from any edge reads as occlusion", () => {
  const frames = [...run(0, 1.5), ...run(2.1, 4)];
  const c = trackContinuity(frames);
  assert.ok(c);
  assert.equal(c.absences.length, 1);
  assert.equal(c.absences[0].kind, "occluded");
  assert.ok(Math.abs(c.absences[0].startS - 1.5) < 0.05);
  assert.ok(Math.abs((c.absences[0].returnedAtS ?? 0) - 2.1) < 0.05);
  assert.ok(c.coverage < 1);
  assert.equal(c.lost, false);
  assert.match(continuityNote(c) ?? "", /hidden/i);
});

test("moving out through the right edge then vanishing reads as an exit", () => {
  // Slide toward the right edge over the last second, then a 1.5s gap.
  const approach: LandmarkFrame[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = 1 + i / 30;
    approach.push(shifted(t, 0.25 + (i / 30) * 0.25));
  }
  const frames = [...run(0, 1), ...approach, ...run(3.5, 5)];
  const c = trackContinuity(frames);
  assert.ok(c);
  const exit = c.absences.find((a) => a.kind === "off_frame");
  assert.ok(exit, `expected an off_frame absence, got ${JSON.stringify(c.absences)}`);
  assert.equal(exit.edge, "right");
  assert.ok(Math.abs(exit.startS - 2) < 0.08);
  assert.ok(Math.abs((exit.returnedAtS ?? 0) - 3.5) < 0.08);
  assert.match(continuityNote(c) ?? "", /left frame right/i);
});

test("an exit that never resolves marks the track lost", () => {
  const approach: LandmarkFrame[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = 1 + i / 30;
    approach.push(shifted(t, 0.25 + (i / 30) * 0.25));
  }
  const c = trackContinuity([...run(0, 1), ...approach]);
  assert.ok(c);
  assert.equal(c.lost, true);
  const last = c.absences[c.absences.length - 1];
  assert.equal(last.kind, "off_frame");
  assert.equal(last.returnedAtS, null);
  assert.match(continuityNote(c) ?? "", /not seen again/i);
});

test("a long unexplained gap is a sampling gap, not an absence", () => {
  // Two capture windows 3s apart with the player mid-frame throughout.
  const c = trackContinuity([...run(0, 1.5), ...run(4.5, 6)]);
  assert.ok(c);
  assert.equal(c.absences.length, 0);
  assert.ok(c.coverage > 0.99);
});
