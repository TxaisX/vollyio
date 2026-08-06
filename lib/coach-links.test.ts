import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCoachLinks, normalizePhrase, resolveCoachLink } from "./coach-links.ts";
import { stripLongDashes } from "./coach-text.ts";

const MAP = buildCoachLinks({
  drills: [
    { name: "Toss and Freeze", slug: "serve-toss-and-freeze" },
    { name: "Setting", slug: "set-hands-drill" },
  ],
  rehab: [
    {
      name: "Patellar tendinopathy (jumper's knee)",
      slug: "patellar-tendinopathy",
      also_called: ["jumper's knee"],
    },
  ],
  skills: [
    { skill: "attack", label: "Attacking" },
    { skill: "set", label: "Setting" },
    { skill: "dig", label: "Defense" },
  ],
});

test("a drill the coach names by its catalog name becomes a link", () => {
  assert.equal(resolveCoachLink(MAP, "Toss and Freeze"), "/drills/serve-toss-and-freeze");
});

// The coach writes prose, not identifiers. Case, trailing commas that the
// emphasis swallowed, and the word "drill" tacked on all have to still land.
test("matching survives the ways a coach actually writes the name", () => {
  for (const written of ["toss and freeze", "Toss And Freeze", "Toss and Freeze,", "  Toss and Freeze  "]) {
    assert.equal(
      resolveCoachLink(MAP, written),
      "/drills/serve-toss-and-freeze",
      `failed on ${JSON.stringify(written)}`,
    );
  }
});

test("a skill links to its technique page and an injury to its entry", () => {
  assert.equal(resolveCoachLink(MAP, "Attacking"), "/learn/attack");
  assert.equal(resolveCoachLink(MAP, "Defense"), "/learn/dig");
  assert.equal(resolveCoachLink(MAP, "jumper's knee"), "/learn/rehab/patellar-tendinopathy");
  // Apostrophes are dropped rather than turned into a space, so both spellings
  // reach the same entry.
  assert.equal(resolveCoachLink(MAP, "jumpers knee"), "/learn/rehab/patellar-tendinopathy");
});

// A drill named after a skill is the more specific destination and the more
// useful one, so it wins the collision.
test("a drill outranks a skill of the same name", () => {
  assert.equal(resolveCoachLink(MAP, "Setting"), "/drills/set-hands-drill");
});

// "Set" is a skill AND the commonest verb in volleyball coaching. Linking it
// would turn ordinary sentences into a field of links.
test("bare skill verbs are never linked", () => {
  for (const generic of ["set", "Set", "pass", "dig", "hit", "block"]) {
    assert.equal(resolveCoachLink(MAP, generic), null, `${generic} must not link`);
  }
});

// A miss is silent: the phrase still renders bold, it just does not link.
test("an unknown phrase resolves to nothing rather than guessing", () => {
  assert.equal(resolveCoachLink(MAP, "work harder"), null);
  assert.equal(resolveCoachLink(MAP, ""), null);
  assert.equal(resolveCoachLink(MAP, "   "), null);
});

test("normalising is stable and lossy in the ways it claims", () => {
  assert.equal(normalizePhrase("Toss  and-Freeze!"), "toss and freeze");
  assert.equal(normalizePhrase("jumper\u2019s knee"), "jumpers knee");
});

// --- long dashes -----------------------------------------------------------
// House style forbids them in copy, the policy lint enforces that on source,
// and model output is the one path to a player that never passes through a file
// the linter reads.

test("an em dash becomes a comma, which is what the voice would have used", () => {
  assert.equal(
    stripLongDashes("Your toss drifts \u2014 that is the whole problem."),
    "Your toss drifts, that is the whole problem.",
  );
  assert.equal(stripLongDashes("legs\u2014then arms"), "legs, then arms");
});

test("a numeric range keeps its meaning instead of gaining a comma", () => {
  assert.equal(stripLongDashes("Run 8\u201310 reps"), "Run 8-10 reps");
  assert.equal(stripLongDashes("You sit at 70\u201375"), "You sit at 70-75");
});

test("a dash next to punctuation does not double it up", () => {
  assert.equal(stripLongDashes("Stop there, \u2014 then reset."), "Stop there, then reset.");
});

test("no long dash survives, whatever shape it arrived in", () => {
  const messy = "A \u2014 B\u2014C \u2013 D\u2013E, \u2014 F";
  const out = stripLongDashes(messy);
  assert.doesNotMatch(out, /[\u2013\u2014]/);
});

test("text with no long dash is returned untouched", () => {
  const clean = "Toss 30cm further in front, then swing through it.";
  assert.equal(stripLongDashes(clean), clean);
  // An ordinary hyphen is not a long dash and must survive.
  assert.equal(stripLongDashes("a well-timed approach"), "a well-timed approach");
});
