import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_DAYS,
  planDayIndex,
  planIsCurrent,
  planPrompt,
  weekStartKey,
  type StoredPlan,
} from "./weekly-plan.ts";

test("every day of a week maps to the same Monday", () => {
  // 2026-07-27 is a Monday.
  const week = [
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ];
  for (const day of week) {
    assert.equal(weekStartKey(day), "2026-07-27", `${day} landed on the wrong week`);
  }
});

test("Sunday belongs to the week that started six days earlier, not the next one", () => {
  assert.equal(weekStartKey("2026-08-02"), "2026-07-27");
  assert.equal(weekStartKey("2026-08-03"), "2026-08-03");
});

test("the week key crosses a month and a year boundary correctly", () => {
  // 2026-01-01 is a Thursday, so its week started Monday 2025-12-29.
  assert.equal(weekStartKey("2026-01-01"), "2025-12-29");
});

test("the week key is stable across the spring-forward weekend", () => {
  // US clocks go forward on Sunday 2026-03-08. A millisecond-based step back
  // would skip a day here; calendar arithmetic does not.
  assert.equal(weekStartKey("2026-03-08"), "2026-03-02");
  assert.equal(weekStartKey("2026-03-09"), "2026-03-09");
});

test("the day index runs Monday 0 to Sunday 6", () => {
  assert.equal(planDayIndex("2026-07-27"), 0);
  assert.equal(planDayIndex("2026-07-29"), 2);
  assert.equal(planDayIndex("2026-08-02"), 6);
  assert.equal(PLAN_DAYS.length, 7);
});

const stored: StoredPlan = {
  week_start: "2026-07-27",
  plan: { headline: "h", why: "w", days: [] },
  generated_at: "2026-07-27T10:00:00Z",
};

test("a plan is current for its own week and stale for the next", () => {
  assert.equal(planIsCurrent(stored, "2026-07-29"), true);
  assert.equal(planIsCurrent(stored, "2026-08-02"), true);
  assert.equal(planIsCurrent(stored, "2026-08-03"), false);
});

test("no stored plan is never current, so generation is offered", () => {
  assert.equal(planIsCurrent(null, "2026-07-29"), false);
});

test("the prompt carries the player's own numbers and constrains the slugs", () => {
  const prompt = planPrompt({
    position: "outside",
    level: "intermediate",
    playFrequency: "twice a week",
    ratings: [
      { skill: "serve", rating: 61.4 },
      { skill: "attack", rating: 72 },
    ],
    lastFix: { skill: "serve", title: "Toss in front of the shoulder", metricKey: "toss_quality" },
    allowedSlugs: ["serve-toss-and-freeze"],
  });
  assert.match(prompt, /outside/);
  assert.match(prompt, /serve 61/);
  assert.match(prompt, /Toss in front of the shoulder/);
  assert.match(prompt, /toss_quality/);
  assert.match(prompt, /serve-toss-and-freeze/);
});

test("with nothing measured the prompt says so instead of inviting invention", () => {
  const prompt = planPrompt({
    position: null,
    level: "beginner",
    playFrequency: null,
    ratings: [],
    lastFix: null,
    allowedSlugs: ["serve-toss-and-freeze"],
  });
  assert.match(prompt, /no skills rated yet/);
  assert.match(prompt, /not had a breakdown yet/);
});

test("the prompt carries the minor-safety constraints, which are not optional", () => {
  const prompt = planPrompt({
    position: null,
    level: "beginner",
    playFrequency: null,
    ratings: [],
    lastFix: null,
    allowedSlugs: ["serve-toss-and-freeze"],
  });
  // The audience starts at 13 and mostly trains with no coach watching, so
  // these four are the difference between a training feature and a liability.
  // If a refactor drops one, this fails rather than shipping.
  assert.match(prompt, /calorie targets/i);
  assert.match(prompt, /supplement/i);
  assert.match(prompt, /rest or mobility day/i);
  assert.match(prompt, /one-rep max/i);
});
