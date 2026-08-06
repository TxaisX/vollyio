import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_BRIEF_SYSTEM,
  fallbackGoalTitle,
  onboardingBriefPrompt,
  onboardingBriefSchema,
} from "./onboarding-brief.ts";

const SEED = {
  skill: "attack" as const,
  level: "club",
  discipline: "indoor",
  position: "outside hitter",
  playFrequency: "3 times a week",
  targetRating: 75,
  timeframeDays: 90,
};

test("the prompt carries only what the player actually told the funnel", () => {
  const p = onboardingBriefPrompt(SEED);
  for (const fact of ["club", "indoor", "outside hitter", "3 times a week", "75", "90"]) {
    assert.ok(p.includes(fact), `prompt is missing ${fact}`);
  }
});

test("the prompt states the player has no analyses, every time", () => {
  // This single line is what stands between a coaching note and a fabricated
  // observation. At signup nothing has been measured, so any claim about how
  // they move would be invented. Do not remove it to shorten the prompt.
  for (const seed of [SEED, { ...SEED, targetRating: null, position: null, playFrequency: null }]) {
    assert.match(onboardingBriefPrompt(seed), /zero analyses/);
    assert.match(onboardingBriefPrompt(seed), /know nothing about their technique/);
  }
});

test("optional answers are omitted rather than guessed at", () => {
  const sparse = onboardingBriefPrompt({
    ...SEED,
    position: null,
    playFrequency: null,
    targetRating: null,
  });
  assert.ok(!sparse.includes("Position:"));
  assert.ok(!sparse.includes("Plays:"));
  assert.match(sparse, /No numeric target chosen/);
});

test("the system prompt forbids inventing observations and numbers", () => {
  for (const rule of [
    "never seen them play",
    "Never invent a number",
    "Never say you have watched",
  ]) {
    assert.ok(
      ONBOARDING_BRIEF_SYSTEM.includes(rule),
      `system prompt lost the rule: ${rule}`,
    );
  }
});

test("the schema bounds both strings so neither can break the layout", () => {
  assert.equal(
    onboardingBriefSchema.safeParse({ goal_title: "abc", focus_note: "x".repeat(50) }).success,
    false,
  );
  assert.equal(
    onboardingBriefSchema.safeParse({
      goal_title: "x".repeat(71),
      focus_note: "x".repeat(50),
    }).success,
    false,
  );
  assert.equal(
    onboardingBriefSchema.safeParse({ goal_title: "Add four inches", focus_note: "short" })
      .success,
    false,
  );
  assert.equal(
    onboardingBriefSchema.safeParse({
      goal_title: "Add four inches to your approach by March",
      focus_note: "You play three times a week as an outside hitter, so approach timing compounds fastest.",
    }).success,
    true,
  );
});

test("the fallback is the exact title that shipped before personalization", () => {
  // The whole design fails open onto this. If it ever stops matching the old
  // deterministic behaviour, a model outage becomes a visible regression rather
  // than an invisible one.
  assert.equal(fallbackGoalTitle("attack", 75), "Attacking to 75");
  assert.equal(fallbackGoalTitle("serve", null), "Work on serving");
  assert.equal(fallbackGoalTitle("serve"), "Work on serving");
});
