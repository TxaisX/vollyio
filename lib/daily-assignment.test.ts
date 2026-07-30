import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentFor,
  needsCourt,
  stableHash,
  targetSkill,
} from "./daily-assignment.ts";
import { SKILLS, type Level, type Skill } from "./skills.ts";
import { DRILLS } from "../content/drills.ts";

const LEVELS: Level[] = ["beginner", "intermediate", "expert", "pro"];
const base = {
  userId: "11111111-2222-3333-4444-555555555555",
  dayKey: "2026-07-29",
  level: "intermediate" as Level,
  ratings: {} as Partial<Record<Skill, number>>,
  weak: null,
};

test("the same player gets the same assignment all day", () => {
  const a = assignmentFor(base);
  const b = assignmentFor(base);
  assert.equal(a.title, b.title);
  assert.equal(a.skill, b.skill);
});

test("a different day can move the assignment, and stays stable within itself", () => {
  const today = assignmentFor(base);
  const tomorrow = assignmentFor({ ...base, dayKey: "2026-07-30" });
  assert.equal(tomorrow.title, assignmentFor({ ...base, dayKey: "2026-07-30" }).title);
  // Not asserting they differ: with a small pool the hash may legitimately land
  // on the same drill twice. Determinism is the contract, novelty is not.
  assert.ok(today.title.length > 0);
});

test("the checkpoint the last breakdown named wins over the rating board", () => {
  const a = assignmentFor({
    ...base,
    ratings: { serve: 20, attack: 90 },
    weak: { skill: "attack", metricKey: null },
  });
  assert.equal(a.skill, "attack");
  assert.equal(a.targeted, true);
});

test("with no breakdown, the lowest rating is the target", () => {
  const a = assignmentFor({
    ...base,
    ratings: { serve: 71, pass: 44, attack: 68 },
  });
  assert.equal(a.skill, "pass");
  assert.equal(a.targeted, true);
});

test("with nothing measured, the choice is stable and does NOT claim to be targeted", () => {
  const a = assignmentFor(base);
  assert.equal(a.targeted, false);
  assert.match(a.why, /nothing measured/i);
});

test("ties in the rating board break on a fixed order, not object key order", () => {
  const forward = targetSkill({ pass: 50, dig: 50 }, null, "seed");
  const reverse = targetSkill({ dig: 50, pass: 50 }, null, "seed");
  assert.equal(forward.skill, reverse.skill);
});

test("a named metric pulls a drill that actually trains it", () => {
  // toss_quality is a serve checkpoint with drills authored against it.
  const a = assignmentFor({
    ...base,
    weak: { skill: "serve", metricKey: "toss_quality" },
  });
  assert.equal(a.kind, "drill");
  assert.ok(a.drill);
  assert.ok(
    a.drill!.focus_metrics.includes("toss_quality"),
    `expected a toss_quality drill, got ${a.drill!.slug} (${a.drill!.focus_metrics.join(", ")})`,
  );
  assert.match(a.why, /toss quality/i);
});

test("an unknown metric key degrades to the skill pool instead of throwing", () => {
  const a = assignmentFor({
    ...base,
    weak: { skill: "serve", metricKey: "not_a_real_checkpoint" },
  });
  assert.equal(a.skill, "serve");
  assert.ok(a.drill || a.studyHref);
});

test("court-free never hands back a drill that needs a partner or a net", () => {
  for (const skill of SKILLS) {
    for (const level of LEVELS) {
      const a = assignmentFor({
        ...base,
        level,
        weak: { skill, metricKey: null },
        courtFree: true,
      });
      if (a.kind === "drill") {
        assert.equal(
          needsCourt(a.drill!),
          false,
          `${skill}/${level} handed back ${a.drill!.slug}, which needs ${a.drill!.equipment.join(", ")}`,
        );
      } else {
        assert.ok(a.studyHref, "a study assignment must say where to read");
      }
    }
  }
});

test("every skill and level combination yields an assignment", () => {
  for (const skill of SKILLS) {
    for (const level of LEVELS) {
      const a = assignmentFor({ ...base, level, weak: { skill, metricKey: null } });
      assert.ok(a.title.length > 0, `${skill}/${level} produced no title`);
      assert.ok(a.why.length > 0, `${skill}/${level} produced no reason`);
      assert.ok(
        a.kind === "study" || a.drill != null,
        `${skill}/${level} claimed a drill and returned none`,
      );
    }
  }
});

test("a drill assignment always comes from the catalog, never invented", () => {
  const slugs = new Set(DRILLS.map((d) => d.slug));
  for (const skill of SKILLS) {
    const a = assignmentFor({ ...base, weak: { skill, metricKey: null } });
    if (a.kind === "drill") assert.ok(slugs.has(a.drill!.slug));
  }
});

test("the hash is stable across runs, which is what keeps the day from reshuffling", () => {
  assert.equal(stableHash("a:2026-07-29"), stableHash("a:2026-07-29"));
  assert.notEqual(stableHash("a:2026-07-29"), stableHash("b:2026-07-29"));
});
