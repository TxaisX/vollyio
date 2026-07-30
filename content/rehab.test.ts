import test from "node:test";
import assert from "node:assert/strict";
import { REHAB, rehabBySlug } from "./rehab.ts";
import { REGIONS, TRIAGE } from "./rehab-types.ts";
import { SKILLS } from "../lib/skills.ts";

// These are safety regression tests, not style tests. The library is medical
// adjacent content shipped by a product that is not licensed to diagnose or
// prescribe, and the constraints below are the line between education and
// treatment. A refactor, a bulk edit, or a future authoring pass that crosses
// one of them fails here rather than shipping.

test("slugs are unique, since the table is keyed on them", () => {
  const seen = new Set<string>();
  for (const e of REHAB) {
    assert.equal(seen.has(e.slug), false, `duplicate slug: ${e.slug}`);
    seen.add(e.slug);
  }
});

test("every entry carries at least two real red flags", () => {
  for (const e of REHAB) {
    assert.ok(
      e.red_flags.length >= 2,
      `${e.slug} has ${e.red_flags.length} red flag(s), needs 2`,
    );
    for (const flag of e.red_flags) {
      assert.ok(flag.length > 25, `${e.slug} has a filler red flag: "${flag}"`);
    }
  }
});

test("every entry has phases, prevention and return markers", () => {
  for (const e of REHAB) {
    assert.ok(e.phases.length >= 1, `${e.slug} has no phases`);
    assert.ok(e.prevention.length >= 1, `${e.slug} has no prevention`);
    assert.ok(e.return_markers.length >= 1, `${e.slug} has no return markers`);
    for (const p of e.phases) {
      assert.ok(p.markers.length >= 1, `${e.slug} phase "${p.name}" has no markers`);
      assert.ok(p.typical_window.length > 0, `${e.slug} phase "${p.name}" has no window`);
    }
  }
});

test("regions, triage levels and loaded skills are all values the app knows", () => {
  for (const e of REHAB) {
    assert.ok(REGIONS.includes(e.region), `${e.slug}: bad region ${e.region}`);
    assert.ok(TRIAGE.includes(e.triage), `${e.slug}: bad triage ${e.triage}`);
    for (const s of e.loads) {
      assert.ok((SKILLS as readonly string[]).includes(s), `${e.slug}: bad skill ${s}`);
    }
  }
});

// The product cannot recommend a substance. Not a brand, not a generic, not an
// over-the-counter painkiller, not a supplement. This catches an authoring pass
// that drifts into it.
const SUBSTANCES = [
  "ibuprofen", "naproxen", "paracetamol", "acetaminophen", "aspirin", "advil",
  "tylenol", "nurofen", "voltaren", "diclofenac", "cortisone", "corticosteroid",
  "prp", "creatine", "collagen supplement", "nsaid", "codeine", "tramadol",
];

test("no drug, dose or supplement is named anywhere in the library", () => {
  for (const e of REHAB) {
    const blob = JSON.stringify(e).toLowerCase();
    for (const term of SUBSTANCES) {
      assert.equal(
        blob.includes(term),
        false,
        `${e.slug} names a substance: "${term}"`,
      );
    }
  }
});

// `phases` describe what a recovery LOOKS like. The moment they carry sets,
// reps or a load, the product has started prescribing treatment.
test("phases describe recovery rather than prescribing a dose of it", () => {
  const DOSING = [
    /\b\d+\s*(?:x|by)\s*\d+\b/i,        // 3x10
    /\b\d+\s*sets?\b/i,
    /\b\d+\s*reps?\b/i,
    /\b\d+\s*(?:kg|lb|lbs|pounds)\b/i,
  ];
  for (const e of REHAB) {
    const blob = [
      ...e.phases.map((p) => `${p.name} ${p.goal} ${p.markers.join(" ")}`),
    ].join(" ");
    for (const pattern of DOSING) {
      assert.equal(
        pattern.test(blob),
        false,
        `${e.slug} phases carry dosing (${pattern}), which makes it a protocol`,
      );
    }
  }
});

// Triage is the field that decides whether the app gets out of the way. These
// four must never be filed as something a player manages alone.
test("the injuries that need care are not filed as self-managed", () => {
  const MUST_ESCALATE = [
    "achilles-tendon-rupture",
    "sport-related-concussion",
    "acl-sprain-and-rupture",
    "spondylolysis-pars-stress-fracture",
  ];
  for (const slug of MUST_ESCALATE) {
    const entry = rehabBySlug(slug);
    assert.ok(entry, `${slug} is missing from the library`);
    assert.notEqual(
      entry!.triage,
      "self_manage",
      `${slug} is filed self_manage, which routes a serious injury away from care`,
    );
  }
});

test("concussion is urgent and says so", () => {
  const c = rehabBySlug("sport-related-concussion");
  assert.equal(c?.triage, "urgent");
});

test("search terms exist: every entry answers to something a player would type", () => {
  for (const e of REHAB) {
    assert.ok(
      e.also_called.length >= 1,
      `${e.slug} has no plain-language names, so search will never find it`,
    );
  }
});

test("the library covers the injuries this sport actually produces", () => {
  // Not an exhaustive list, a floor. Volleyball without jumper's knee, a rolled
  // ankle and a jammed finger is not a volleyball injury library.
  for (const slug of [
    "patellar-tendinopathy",
    "lateral-ankle-sprain",
    "pip-joint-sprain",
    "rotator-cuff-tendinopathy",
    "achilles-tendinopathy",
  ]) {
    assert.ok(rehabBySlug(slug), `missing a core volleyball injury: ${slug}`);
  }
  assert.ok(REHAB.length >= 25, `only ${REHAB.length} entries, expected a real library`);
});
