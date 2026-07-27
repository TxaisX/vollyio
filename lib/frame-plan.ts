// Where the frame budget goes, decided per skill and per source clip.
//
// D-041 deleted the motion-picked sampler because sparse coverage scored a
// standstill jump as an approach jump: the sampler guessed which moments
// mattered and left gaps everywhere else. This is not that. Coverage stays
// CONTINUOUS from end to end; only the stride varies, and the widest gap this
// can ever produce is MAX_EDGE_GAP_S, which is the same 6fps D-041 itself
// shipped. So the failure it guarded against cannot recur here.
//
// The reason to vary stride at all is arithmetic. One request carries 40
// frames. An attack needs about three seconds to show approach through
// landing, which spread evenly is 75ms per frame, while the swing from cocked
// to contact runs 120-160ms and needs four or five frames before its sequence
// reads as motion rather than a slideshow. Evenly spread, the swing gets two.
// Spending most of the budget on the contact phase and the rest on gapless
// context buys the swing without losing the approach.

import type { Skill } from "./skills.ts";
import type { FrameKind, PlannedFrame, TrimWindow } from "./frame-select.ts";

export type SkillProfile = {
  // Whole seconds, per the owner's call to reason in seconds rather than
  // fractions. This is the default analyzed window for the skill.
  windowS: number;
  // The contact phase, covered at the source's own frame rate.
  coreS: number;
  // Where contact sits in the window when the player marked no instant.
  // An attack contacts late (after the approach), a pass nearer the middle.
  corePos: number;
};

export const SKILL_PROFILES: Record<Skill, SkillProfile> = {
  serve: { windowS: 3, coreS: 0.5, corePos: 0.65 },
  pass: { windowS: 2, coreS: 0.4, corePos: 0.55 },
  set: { windowS: 2, coreS: 0.4, corePos: 0.55 },
  attack: { windowS: 3, coreS: 0.8, corePos: 0.7 },
  block: { windowS: 2, coreS: 0.5, corePos: 0.55 },
  dig: { windowS: 2, coreS: 0.5, corePos: 0.55 },
};

// The widest gap any plan may contain. Equal to the uniform 6fps D-041
// shipped, so no plan is ever sparser anywhere than what already worked.
export const MAX_EDGE_GAP_S = 1 / 6;

// Sampling finer than the source only re-decodes the same frame twice, so this
// is the floor on stride regardless of what a skill would like.
const MIN_SOURCE_FPS = 12;
const MAX_SOURCE_FPS = 240;

// The core density worth carving a core out for. 30fps puts 4 to 5 frames
// inside a 120-160ms swing, which is the threshold where a sequence reads as
// motion. It is a viability test, not a cap: once the edges are reserved, the
// core takes the whole remainder and runs at the source rate if it fits.
export const CORE_TARGET_FPS = 30;

// The budget this planner must never do worse than, anywhere. D-041 shipped 40
// uniform frames; every plan since has to be at least that dense at every
// point in the clip, which is what earns the right to move frames around.
export const UNIFORM_BASELINE_FRAMES = 40;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function normalizeFps(fps: number | null | undefined): number {
  if (!fps || !Number.isFinite(fps)) return 30;
  return clamp(fps, MIN_SOURCE_FPS, MAX_SOURCE_FPS);
}

/**
 * Frame rate from two requestVideoFrameCallback readings. Split out from the
 * browser plumbing so the arithmetic is testable headlessly: the callback
 * itself cannot run under node --test, but this is where the mistakes live.
 * Null means the readings cannot support an estimate, and the caller falls
 * back rather than dividing by a near-zero interval and inventing a rate.
 */
export function fpsFromSamples(
  first: { mediaTime: number; presentedFrames: number },
  second: { mediaTime: number; presentedFrames: number },
  minFrames = 8,
): number | null {
  const dt = second.mediaTime - first.mediaTime;
  const df = second.presentedFrames - first.presentedFrames;
  if (!Number.isFinite(dt) || !Number.isFinite(df)) return null;
  if (df < minFrames || dt <= 0) return null;
  return normalizeFps(df / dt);
}

/** Default analyzed window for a skill, in whole seconds, capped by the clip. */
export function defaultWindowS(skill: Skill, maxS: number): number {
  return Math.max(1, Math.min(SKILL_PROFILES[skill].windowS, Math.floor(maxS)));
}

// Pixels vary by role, exactly as stride does, and for the same reason. The
// request budget is a fixed pool of pixels, and spending it evenly is as wrong
// here as spending time evenly was. Contact frames are where hand shape, elbow
// lead, and body angle have to be legible, so they keep full size. Approach and
// recovery frames answer "where is the athlete and what is the body doing", a
// question that survives a smaller frame intact.
//
// This is what lets the budget hold 64 frames instead of 40 without growing:
// 24 core at 1024 plus 40 context at 640 is 41.6M pixels against the 41.9M that
// 40 frames at 1024 already cost.
export const CORE_FRAME_DIM = 1024;
export const CONTEXT_FRAME_DIM = 640;
// The pixel pool D-041 established, and the ceiling every plan must fit.
export const PIXEL_BUDGET = 40 * 1024 * 1024;

export function frameDimForKind(kind: FrameKind): number {
  return kind === "context" ? CONTEXT_FRAME_DIM : CORE_FRAME_DIM;
}

/** Total pixels a plan will render, for asserting it fits the request budget. */
export function planPixelCost(plan: PlannedFrame[]): number {
  return plan.reduce((sum, f) => {
    const d = frameDimForKind(f.kind);
    return sum + d * d;
  }, 0);
}

function uniform(startS: number, endS: number, count: number): number[] {
  const step = (endS - startS) / count;
  return Array.from({ length: count }, (_, i) => startS + step * (i + 0.5));
}

/**
 * Lay the frame budget over the window: every source frame through the contact
 * phase, thinner but gapless either side. Falls back to a single uniform pass
 * when the window is too long to protect a core without opening a gap wider
 * than MAX_EDGE_GAP_S, which keeps long windows behaving exactly as before.
 */
export function planFrameTimes(opts: {
  window: TrimWindow;
  skill: Skill;
  sourceFps: number;
  maxFrames: number;
  markT?: number | null;
}): PlannedFrame[] {
  const { startS, endS } = opts.window;
  const span = Math.max(0.1, endS - startS);
  const fps = normalizeFps(opts.sourceFps);
  const maxFrames = Math.max(4, opts.maxFrames);
  const profile = SKILL_PROFILES[opts.skill];

  const uniformPlan = (): PlannedFrame[] =>
    uniform(startS, endS, Math.max(4, Math.min(maxFrames, Math.ceil(span * fps)))).map((timeS) => ({
      timeS,
      kind: "context" as const,
    }));

  const coreS = Math.min(profile.coreS, span);
  // Anchor on the instant the player marked their athlete when there is one,
  // since that is the moment they cared about, and on the skill's typical
  // contact position otherwise.
  const anchor =
    opts.markT != null && opts.markT >= startS && opts.markT <= endS
      ? opts.markT
      : startS + span * profile.corePos;
  const coreStart = clamp(anchor - coreS / 2, startS, endS - coreS);
  const coreEnd = coreStart + coreS;

  const preS = coreStart - startS;
  const postS = endS - coreEnd;

  // Reserve the edges FIRST, at whatever density spreading the old 40-frame
  // budget evenly would have given, then let the core have everything left.
  // Doing it in this order is what makes "no part is sparser than uniform"
  // structural rather than a happy accident. Capping the core instead was the
  // earlier attempt, and it inverted on short high-fps windows, where a fixed
  // 30fps core came out COARSER than uniform would have been.
  const edgeStrideMax = Math.min(span / UNIFORM_BASELINE_FRAMES, MAX_EDGE_GAP_S);
  const preMin = preS > 0 ? Math.ceil(preS / edgeStrideMax) : 0;
  const postMin = postS > 0 ? Math.ceil(postS / edgeStrideMax) : 0;

  const coreBudget = maxFrames - preMin - postMin;
  // Once the edges have taken what they need, a core that cannot come out
  // meaningfully denser than them is not worth carving out at all.
  if (coreBudget < Math.max(2, coreS * CORE_TARGET_FPS * 0.5)) return uniformPlan();

  const coreCount = clamp(Math.round(coreS * fps), 2, coreBudget);
  let spare = maxFrames - coreCount - preMin - postMin;
  // Hand the leftover to the edges in proportion to how much time each covers.
  const edgeS = preS + postS;
  const preExtra = edgeS > 0 ? Math.round((spare * preS) / edgeS) : 0;
  spare -= preExtra;

  // A region cannot hold more frames than the source actually contains in it.
  // Asking for more returns the same decoded image repeatedly, and worse, the
  // duplicate filter then strips a whole region and opens the very gap this is
  // built to prevent. Leftover budget is better left unspent: a shorter plan
  // buys resolution back through frameDimForCount.
  // The epsilon is load-bearing. Region durations come out of subtraction, so
  // a 0.1s tail arrives as 0.09999999999999998 and a bare floor() drops a whole
  // frame, which on a short tail is the difference between a 33ms and a 50ms
  // stride. The test that compares against uniform caught exactly this.
  const available = (durationS: number) => Math.max(1, Math.floor(durationS * fps + 1e-6));
  const preCount = preS > 0 ? Math.min(preMin + preExtra, available(preS)) : 0;
  const postCount = postS > 0 ? Math.min(postMin + spare, available(postS)) : 0;

  // Frames are not equal in cost, so a frame count that fits says nothing about
  // whether the request does. Core frames render at 1024 and context at 640, so
  // a core taking the whole remainder at a 60fps source can fit the frame
  // budget and still blow the pixel pool. Trim the core, never the edges: the
  // edges are the guarantee, the core is the upgrade.
  const contextPixels = (preCount + postCount) * CONTEXT_FRAME_DIM * CONTEXT_FRAME_DIM;
  const corePixelRoom = Math.max(0, PIXEL_BUDGET - contextPixels);
  const coreFitting = Math.floor(corePixelRoom / (CORE_FRAME_DIM * CORE_FRAME_DIM));
  const finalCore = clamp(Math.min(coreCount, coreFitting), 2, coreCount);

  const plan: PlannedFrame[] = [
    ...(preCount > 0 ? uniform(startS, coreStart, preCount) : []).map((timeS) => ({
      timeS,
      kind: "context" as const,
    })),
    // Marked burst, not context: finalizePlanned drops context frames first
    // when the request runs over budget, so the approach thins before the
    // contact phase ever does.
    ...uniform(coreStart, coreEnd, finalCore).map((timeS) => ({
      timeS,
      kind: "burst" as const,
    })),
    ...(postCount > 0 ? uniform(coreEnd, endS, postCount) : []).map((timeS) => ({
      timeS,
      kind: "context" as const,
    })),
  ].sort((a, b) => a.timeS - b.timeS);

  // Two requests inside one source frame render the same image twice. Compare
  // against the last frame KEPT, not the last one seen: comparing to the raw
  // predecessor lets a run of tight frames drop wholesale and tear a hole.
  const minGap = 1 / fps / 2;
  const kept: PlannedFrame[] = [];
  for (const f of plan) {
    if (kept.length === 0 || f.timeS - kept[kept.length - 1].timeS >= minGap) kept.push(f);
  }
  return kept;
}
