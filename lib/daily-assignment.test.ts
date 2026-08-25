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

// THE LIE THIS PINS. The video engine (D-097/D-099) names its checkpoint in
// `changes[0].key`; the frames engine used `changes[0].target_metric`. The
// dashboard kept selecting `target_metric`, so from 2026-08-06 every current
// row carried a null metric and `weak.metricKey` was always null. The
// assignment then fell into the branch below and told the player the last
// rep's skill was "your lowest rating right now", printing that skill's
// rating, while a genuinely lower one sat two rows down the same screen.
//
// Verified against production before writing this: of 59 stored analyses, the
// 20 written since 2026-08-06 have `key` on 20 of 20 and `target_metric` on 0.
test("the last rep's skill is never described as the lowest rating when it is not", () => {
  const a = assignmentFor({
    ...base,
    // Serve is the last rep and is the player's BEST skill; block is worst.
    ratings: { serve: 82, block: 41 },
    weak: { skill: "serve", metricKey: null },
  });
  assert.equal(a.skill, "serve", "the last rep's skill still leads the day");
  assert.doesNotMatch(
    a.why,
    /lowest rating/i,
    `claimed "lowest rating" about serve 82 while block sits at 41: ${a.why}`,
  );
  assert.match(a.why, /last rep|latest rep|last breakdown/i);
});

test("the lowest-rating line is only used when the skill really is the lowest", () => {
  const a = assignmentFor({
    ...base,
    ratings: { serve: 82, block: 41 },
  });
  assert.equal(a.skill, "block");
  assert.match(a.why, /lowest rating/i);
  assert.match(a.why, /41/);
});

test("a named checkpoint still outranks both, and says so", () => {
  const a = assignmentFor({
    ...base,
    ratings: { serve: 82, block: 41 },
    weak: { skill: "serve", metricKey: "contact" },
  });
  assert.equal(a.skill, "serve");
  assert.match(a.why, /checkpoint/i);
});
