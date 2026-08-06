import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { clampTrimWindow, MIN_TRIM_SPAN_S } from "./frame-select.ts";
import { defaultWindowS, SKILL_PROFILES } from "./frame-plan.ts";
import { SKILLS } from "./skills.ts";

// WHAT THIS GUARDS, and what it cost when it was not guarded.
//
// `SKILL_PROFILES[skill].windowS` is 2 to 3 seconds. That number was tuned for
// FRAME EXTRACTION, where the job is to spend a fixed frame budget densely
// around the contact phase, and a tight window is exactly right for it. It is
// wrong for the analysis window, because the analysis window decides how much
// of the rep the model is shown at all.
//
// Measured 2026-08-05 on the owner's own clip: 73 and 66 on the full 5.5
// seconds, and 61 on the first 4.0. On the truncated run the model said he was
// "playing the ball grounded" and told him to start jumping. He jumped. The
// window cut it off. Confident, specific, and wrong, which is worse than no
// coaching, and nothing in the output said the read was partial.
//
// So the analysis window defaults to the WHOLE clip, capped only by what the
// route will accept, and the only thing that narrows it is a player dragging a
// trim handle themselves.

const WHOLE_CLIP_CAP_S = 10; // MAX_CLIP_SECONDS in lib/frames.ts, which is DOM-coupled.

test("the seeded analysis window is the whole clip, not a skill's frame window", () => {
  for (const durationS of [2.2, 4.0, 5.5, 8.0, 9.96]) {
    const seeded = clampTrimWindow(durationS, {
      startS: 0,
      endS: Math.min(durationS, WHOLE_CLIP_CAP_S),
    });
    assert.equal(seeded.startS, 0, `${durationS}s clip must start at zero`);
    assert.equal(
      Math.round(seeded.endS * 100) / 100,
      Math.round(durationS * 100) / 100,
      `${durationS}s clip must be analyzed whole`,
    );
  }
});

test("a clip longer than the cap keeps the cap, still from the start", () => {
  const seeded = clampTrimWindow(32, { startS: 0, endS: WHOLE_CLIP_CAP_S });
  assert.equal(seeded.startS, 0);
  assert.equal(seeded.endS, WHOLE_CLIP_CAP_S);
  assert.ok(seeded.endS - seeded.startS >= MIN_TRIM_SPAN_S);
});

// The specific number that would reintroduce the failure. Every skill's frame
// window is shorter than a real rep clip, which is the whole point of it and
// the whole reason it must not be the analysis window.
test("every skill's frame window is shorter than a real clip, which is why it is not the analysis window", () => {
  for (const skill of SKILLS) {
    assert.ok(
      SKILL_PROFILES[skill].windowS <= 4,
      `${skill} frame window is ${SKILL_PROFILES[skill].windowS}s`,
    );
    assert.ok(defaultWindowS(skill, 30) < WHOLE_CLIP_CAP_S);
  }
});

// The assertion that would actually have caught it. `defaultWindowS` is a
// frame-planning helper and nothing that decides what the model SEES may call
// it. A grep is a weak test in general and the right one here: the failure was
// not a wrong value, it was the right value read by the wrong caller.
test("no product surface seeds the analysis window from the frame planner", async () => {
  for (const file of [
    "../components/analyze-flow.tsx",
    "../app/api/analyze/route.ts",
  ]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      src,
      /defaultWindowS|SKILL_PROFILES/,
      `${file} must not seed the analysis window from the frame planner`,
    );
  }
});

// And the route must never be handed a window at all: the client sends the cut
// clip, so what the model sees is settled before the request exists.
test("the analyze request carries no window for anything to truncate", async () => {
  const src = await readFile(new URL("./analyze-request.ts", import.meta.url), "utf8");
  // Case-sensitive and word-bounded on purpose: /endS/i matches "depends".
  assert.doesNotMatch(src, /\b(startS|endS|trim|TrimWindow)\b/);
});
