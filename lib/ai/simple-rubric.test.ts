import { test } from "node:test";
import assert from "node:assert/strict";
import {
  focusInstruction,
  notRatableMessage,
  simpleRatingSchema,
  simpleRubric,
} from "./simple-rubric.ts";
import { SKILLS } from "../skills.ts";

// D-094 is the reason this rubric exists at all: the same model on the same
// clips, given the 120-pointer catalog, told 36 of 36 real players they were
// near-perfect (median 97). The band anchors below are what replaced it, so
// they are load-bearing text and not decoration.
test("the rubric anchors the scale and reserves the top for teaching examples", () => {
  const text = simpleRubric("attack", "indoor", []);
  assert.match(text, /RATING SCALE, 0 to 100/);
  assert.match(text, /95-100/);
  assert.match(text, /belongs in the 60s or 70s/i);
  assert.match(text, /do not award the 90s/i);
});

// The single hardest-won fact about this path (docs/model-findings-2026-08-05):
// it is sampled at about one image per second, and on a clip whose contact was
// hand-verified at 3.42s, six runs answered between 0.27s and 0.60s while
// self-reporting 30fps. A rubric that lets the model volunteer an instant
// produces confident, specific, wrong coaching.
test("the rubric forbids timestamps and says what the model is actually seeing", () => {
  for (const skill of SKILLS) {
    const text = simpleRubric(skill, "beach", []);
    assert.match(text, /one image per second/i);
    assert.match(text, /do not report timestamps/i);
    assert.match(text, /NOT seeing every frame/i);
  }
});

// The abstain lane. Without somewhere to put "I cannot see it", the model puts
// it in a middling score and the player reads it as coaching.
test("the rubric tells the model when to refuse rather than rate", () => {
  const text = simpleRubric("dig", "indoor", []);
  assert.match(text, /WHEN NOT TO RATE/);
  assert.match(text, /ratable to false/i);
  assert.match(text, /honest refusal/i);
});

test("drill guidance closes the slug set, and says so even when it is empty", () => {
  const withDrills = simpleRubric("serve", "indoor", ["float-serve-wall", "toss-consistency"]);
  assert.match(withDrills, /float-serve-wall/);
  assert.match(withDrills, /rather than inventing a slug/i);
  assert.match(simpleRubric("serve", "indoor", []), /empty drill_slugs list/i);
});

// No vendor name may reach a player, and every string here is either shown to
// one or shapes what the model writes to one.
test("nothing in the rubric names a vendor or a model", () => {
  for (const skill of SKILLS) {
    const text = simpleRubric(skill, "indoor", []).toLowerCase();
    for (const name of ["gemini", "google", "openrouter", "anthropic", "claude", "deepseek"]) {
      assert.equal(text.includes(name), false, `${skill} rubric names ${name}`);
    }
  }
});

test("a rating parses with the fields the route reads, and abstention is one of them", () => {
  const abstained = simpleRatingSchema.safeParse({
    ratable: false,
    not_ratable_reason: "The player is out of frame for most of the clip.",
    overall_score: 0,
    confidence: "low",
    strengths: [],
    improvements: [],
    drill_slugs: [],
    summary: "Not enough of the rep is visible to score.",
  });
  assert.equal(abstained.success, true);
});

// The frame path's Change carries target_metric and expected_gain. This one
// must not: they are per-checkpoint quantities and this rubric has no
// checkpoints, so a value there is a number the player would act on that
// nothing measured.
test("an improvement carries no checkpoint it cannot have measured", () => {
  const parsed = simpleRatingSchema.parse({
    ratable: true,
    overall_score: 71,
    confidence: "medium",
    strengths: [{ title: "Clean contact", detail: "Above the forehead, quick wrist." }],
    improvements: [
      { title: "Toss further in front", detail: "About 30cm.", difficulty: "quick", timeframe: "1-2 practices" },
    ],
    drill_slugs: [],
    summary: "Solid rep.",
  });
  assert.equal("target_metric" in parsed.improvements[0], false);
  assert.equal("expected_gain" in parsed.improvements[0], false);
});

test("the focus instruction places the athlete in thirds, never in a false decimal", () => {
  const left = focusInstruction(0.1, 0.8, 2.14);
  assert.match(left, /the left third/);
  assert.match(left, /the lower part/);
  // One decimal, because the sample is about one image per second and the tap
  // was made by a thumb on a scrub bar. More digits would be a claim.
  assert.match(left, /about 2\.1 seconds/);
  assert.doesNotMatch(left, /%/);
  assert.match(focusInstruction(0.5, 0.5, 0).split(",")[0], /the middle/);
  assert.match(focusInstruction(0.9, 0.1, 0), /the right third/);
  assert.match(focusInstruction(0.9, 0.1, 0), /the top/);
});

// A tap that lands on empty court must not make the model refuse or invent: it
// falls back to the athlete performing the rep and says so.
test("the focus instruction has a fallback when nobody is at the tap", () => {
  assert.match(focusInstruction(0.5, 0.5, 1), /If nobody is in that position/);
});

test("a usable refusal reason is passed through and punctuated", () => {
  const msg = notRatableMessage("The player is too far from camera to judge hand shape");
  assert.match(msg, /^The player is too far from camera to judge hand shape\./);
  assert.match(msg, /Nothing was counted against your limit/);
});

// The reason is model output. It is the only model string in the product that
// reaches a player without a schema shaping it, so anything odd is dropped for
// the fixed sentence rather than rendered.
test("an unusable refusal reason falls back rather than rendering model noise", () => {
  for (const bad of [undefined, "", "  ", "no", "<script>alert(1)</script>", "x".repeat(400)]) {
    const msg = notRatableMessage(bad);
    assert.match(msg, /^The rep wasn't clear enough in that clip to score\./);
    assert.match(msg, /Nothing was counted against your limit/);
  }
});

test("no refusal message blames the player or names a vendor", () => {
  const msg = notRatableMessage("The footage is too dark to see the platform").toLowerCase();
  for (const name of ["gemini", "google", "openrouter", "anthropic", "claude"]) {
    assert.equal(msg.includes(name), false);
  }
  assert.match(msg, /nothing was counted/);
});
