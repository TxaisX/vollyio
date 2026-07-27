import test from "node:test";
import assert from "node:assert/strict";
import {
  planFrameTimes,
  frameDimForKind,
  planPixelCost,
  defaultWindowS,
  normalizeFps,
  fpsFromSamples,
  CORE_FRAME_DIM,
  CORE_TARGET_FPS,
  PIXEL_BUDGET,
  MAX_EDGE_GAP_S,
  SKILL_PROFILES,
} from "./frame-plan.ts";
import { SKILLS } from "./skills.ts";
import { MAX_FRAMES } from "./analysis-types.ts";

const MAX = MAX_FRAMES;

function gaps(times: number[]): number[] {
  return times.slice(1).map((t, i) => t - times[i]);
}

// The claim that answers D-041, stated precisely. This does NOT say the plan
// beats uniform everywhere: it cannot, and does not. On a 3s attack window
// uniform is 75ms throughout while this runs the approach near 155ms. What it
// guarantees is a FLOOR, that no part of any clip is ever sampled sparser than
// the uniform 6fps D-041 shipped and validated as enough to catch a standstill
// jump misread as an approach jump. Past ~6.7s even that is unreachable inside
// 40 frames, so the bound relaxes to uniform, which is all anyone can do there.
test("no plan is ever sparser anywhere than the 6fps D-041 shipped", () => {
  for (const skill of SKILLS) {
    for (const fps of [24, 30, 60]) {
      for (const span of [1, 2, 3, 5, 10]) {
        const plan = planFrameTimes({
          window: { startS: 0, endS: span },
          skill,
          sourceFps: fps,
          maxFrames: MAX,
        });
        const widest = Math.max(...gaps(plan.map((f) => f.timeS)));
        const bound = Math.max(MAX_EDGE_GAP_S, span / MAX);
        assert.ok(
          widest <= bound + 1e-6,
          `${skill} ${span}s @${fps}fps opened a ${widest.toFixed(3)}s gap, bound ${bound.toFixed(3)}`,
        );
      }
    }
  }
});

// At the old 40-frame budget this was FALSE and an earlier draft wrongly
// claimed it: a 3s attack ran its approach near 155ms against uniform's 75ms.
// Raising to 64 frames, paid for by rendering context at 640 rather than by
// growing the request, makes it true. Every part of the clip is now sampled at
// least as densely as spreading the OLD budget evenly would have.
test("no part of any plan is sparser than uniform at the old 40-frame budget", () => {
  const OLD_BUDGET = 40;
  for (const skill of SKILLS) {
    for (const fps of [24, 30, 60]) {
      for (const span of [1, 2, 3]) {
        const plan = planFrameTimes({
          window: { startS: 0, endS: span },
          skill,
          sourceFps: fps,
          maxFrames: MAX,
        });
        const t = plan.map((f) => f.timeS);
        const widest = Math.max(...t.slice(1).map((x, i) => x - t[i]));
        // The baseline is what uniform could ACTUALLY have achieved, not what
        // the arithmetic suggests: a 1s window on a 24fps clip holds 24 real
        // frames, so a 40-frame uniform pass would have been requesting
        // duplicates. Where the source is the limit, matching it is the win.
        const achievable = Math.min(OLD_BUDGET, Math.floor(span * fps));
        const bound = Math.max(span / achievable, 1.2 / fps);
        assert.ok(
          widest <= bound + 1e-6,
          `${skill} ${span}s @${fps}fps: widest ${(widest * 1000).toFixed(0)}ms vs bound ${(bound * 1000).toFixed(0)}ms`,
        );
      }
    }
  }
});

test("the contact core is sampled far denser than the edges", () => {
  const plan = planFrameTimes({
    window: { startS: 0, endS: 3 },
    skill: "attack",
    sourceFps: 30,
    maxFrames: MAX,
  });
  const core = plan.filter((f) => f.kind === "burst").map((f) => f.timeS);
  const edge = plan.filter((f) => f.kind === "context").map((f) => f.timeS);
  assert.ok(core.length >= 12, `core got only ${core.length} frames`);
  assert.ok(edge.length > 0, "edges lost all coverage");

  const coreStride = Math.max(...gaps(core));
  assert.ok(coreStride <= 1 / 24, `core stride ${coreStride.toFixed(4)}s is coarser than 24fps`);
});

test("a 140ms swing lands on four or more frames, which uniform sampling could not do", () => {
  const plan = planFrameTimes({
    window: { startS: 0, endS: 3 },
    skill: "attack",
    sourceFps: 30,
    maxFrames: MAX,
  });
  const core = plan.filter((f) => f.kind === "burst").map((f) => f.timeS);
  const contact = core[Math.floor(core.length / 2)];
  const inSwing = plan.filter((f) => Math.abs(f.timeS - contact) <= 0.07).length;
  assert.ok(inSwing >= 4, `only ${inSwing} frames inside the swing`);

  // The same budget spread evenly over the same window.
  const uniformStride = 3 / MAX;
  assert.ok(Math.ceil(0.14 / uniformStride) < 4, "uniform would have sufficed, test is not proving anything");
});

test("the budget is respected and the core is anchored on the marked instant", () => {
  const plan = planFrameTimes({
    window: { startS: 4, endS: 7 },
    skill: "serve",
    sourceFps: 30,
    maxFrames: MAX,
    markT: 5.2,
  });
  assert.ok(plan.length <= MAX, `plan used ${plan.length} frames`);
  const core = plan.filter((f) => f.kind === "burst").map((f) => f.timeS);
  const mid = (core[0] + core[core.length - 1]) / 2;
  assert.ok(Math.abs(mid - 5.2) < 0.1, `core centred at ${mid}, not the mark`);
});

test("every frame stays inside the window and in order", () => {
  const plan = planFrameTimes({
    window: { startS: 2, endS: 5 },
    skill: "block",
    sourceFps: 60,
    maxFrames: MAX,
    markT: 3.5,
  });
  for (const f of plan) {
    assert.ok(f.timeS >= 2 && f.timeS <= 5, `frame at ${f.timeS} escaped the window`);
  }
  assert.deepEqual(
    plan.map((f) => f.timeS),
    [...plan.map((f) => f.timeS)].sort((a, b) => a - b),
  );
});

test("a window too long to protect a core degrades to the old uniform pass", () => {
  const plan = planFrameTimes({
    window: { startS: 0, endS: 30 },
    skill: "attack",
    sourceFps: 30,
    maxFrames: MAX,
  });
  assert.ok(
    plan.every((f) => f.kind === "context"),
    "long window should carry no protected core",
  );
});

test("never asks for two frames inside one source frame", () => {
  for (const fps of [24, 30, 60]) {
    const plan = planFrameTimes({
      window: { startS: 0, endS: 1 },
      skill: "set",
      sourceFps: fps,
      maxFrames: MAX,
    });
    const tightest = Math.min(...gaps(plan.map((f) => f.timeS)));
    assert.ok(tightest >= 1 / fps / 2, `@${fps}fps asked for a ${tightest.toFixed(4)}s stride`);
  }
});

// The claim that lets MAX_FRAMES go 40 -> 64 without growing the request: the
// pixel pool is unchanged, only its distribution moved. If this fails, the
// over-budget fallback starts dropping frames and the extra budget is fiction.
test("every skill plan fits the pixel budget 40 frames at 1024 already cost", () => {
  for (const skill of SKILLS) {
    for (const fps of [24, 30, 60]) {
      for (const span of [1, 2, 3, 5]) {
        const plan = planFrameTimes({
          window: { startS: 0, endS: span },
          skill,
          sourceFps: fps,
          maxFrames: MAX,
        });
        const cost = planPixelCost(plan);
        assert.ok(
          cost <= PIXEL_BUDGET,
          `${skill} ${span}s @${fps}fps cost ${(cost / 1e6).toFixed(1)}M of ${(PIXEL_BUDGET / 1e6).toFixed(1)}M`,
        );
      }
    }
  }
});

test("contact frames keep full resolution while context frames give pixels back", () => {
  assert.equal(frameDimForKind("burst"), CORE_FRAME_DIM);
  assert.equal(frameDimForKind("peak"), CORE_FRAME_DIM);
  assert.ok(frameDimForKind("context") < CORE_FRAME_DIM);
});

test("skill windows are whole seconds and fit the clip", () => {
  for (const skill of SKILLS) {
    assert.equal(SKILL_PROFILES[skill].windowS, Math.floor(SKILL_PROFILES[skill].windowS));
    assert.equal(defaultWindowS(skill, 1.4), 1);
    assert.ok(defaultWindowS(skill, 60) <= SKILL_PROFILES[skill].windowS);
  }
});

// The core is not pinned to a rate. It takes whatever the budget leaves once
// the edges are reserved, bounded above by the source (finer would duplicate)
// and expected to clear CORE_TARGET_FPS, which is the density that makes a
// swing read as motion.
test("the contact phase never exceeds the source rate and clears the motion threshold", () => {
  for (const fps of [24, 30, 60, 120]) {
    const plan = planFrameTimes({
      window: { startS: 0, endS: 3 },
      skill: "attack",
      sourceFps: fps,
      maxFrames: MAX,
    });
    const core = plan.filter((f) => f.kind === "burst").map((f) => f.timeS);
    const rate = (core.length - 1) / (core[core.length - 1] - core[0]);
    assert.ok(rate <= fps + 1, `@${fps}fps the core ran at ${rate.toFixed(1)}fps, finer than the source`);
    assert.ok(
      rate >= Math.min(fps, CORE_TARGET_FPS) - 1,
      `@${fps}fps the core ran at ${rate.toFixed(1)}fps, under the motion threshold`,
    );
  }
});

test("frame rate is measured from callback readings, and refuses to guess", () => {
  // 60fps: 30 frames across half a second of media time.
  assert.ok(
    Math.abs(
      fpsFromSamples({ mediaTime: 1, presentedFrames: 100 }, { mediaTime: 1.5, presentedFrames: 130 })! - 60,
    ) < 0.01,
  );
  // Too few frames to trust, and a stalled clock, both abstain.
  assert.equal(fpsFromSamples({ mediaTime: 1, presentedFrames: 100 }, { mediaTime: 1.1, presentedFrames: 103 }), null);
  assert.equal(fpsFromSamples({ mediaTime: 2, presentedFrames: 100 }, { mediaTime: 2, presentedFrames: 120 }), null);
  // A backwards seek mid-measure must not produce a negative rate.
  assert.equal(fpsFromSamples({ mediaTime: 3, presentedFrames: 100 }, { mediaTime: 1, presentedFrames: 130 }), null);
  assert.equal(fpsFromSamples({ mediaTime: 1, presentedFrames: 100 }, { mediaTime: Number.NaN, presentedFrames: 130 }), null);
});

test("an unreadable frame rate falls back rather than producing a garbage stride", () => {
  assert.equal(normalizeFps(null), 30);
  assert.equal(normalizeFps(0), 30);
  assert.equal(normalizeFps(Number.NaN), 30);
  assert.equal(normalizeFps(1000), 240);
  assert.equal(normalizeFps(59.94), 59.94);
});
