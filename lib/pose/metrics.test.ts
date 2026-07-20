import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMeasurementsBlock,
  confidenceScore,
  detectRepsForSkill,
  keyJointsForSkill,
  NOISE_FLOOR,
  VISIBILITY_ANCHORS,
} from "./metrics.ts";
import { LM } from "./types.ts";
import { attackClip, serveClip, blockClip, passClip, standingFrame } from "./test-fixtures.ts";

test("serve clip yields a grounded measurements block", () => {
  const block = buildMeasurementsBlock("serve", serveClip(), 30);
  assert.ok(block, "expected a measurements block");
  assert.equal(block.version, 1);
  assert.equal(block.reps.length, 1);
  const rep = block.reps[0];
  assert.equal(rep.detector, "swing");

  const contact = rep.metrics.contact_height;
  assert.ok(contact, "contact_height should survive gating on a clean clip");
  assert.equal(contact.unit, "body_heights");
  assert.ok(typeof contact.value === "number");
  // Wrist near y=0.14 over feet at 0.86 with body height 0.58 is ~1.24 bh;
  // sampling can anchor contact a frame early, so accept >= 0.95 (still an
  // above-head contact) up to 1.5.
  assert.ok((contact.value as number) >= 0.95 && (contact.value as number) < 1.5,
    `contact_height=${contact.value}`);
  assert.ok(contact.confidence >= 0.7);

  // Every surviving metric respects the confidence floor semantics.
  for (const [key, m] of Object.entries(rep.metrics)) {
    assert.ok(m.confidence >= NOISE_FLOOR, `${key} confidence=${m.confidence}`);
    assert.ok(!block.omitted_below_confidence.includes(key));
  }
  assert.equal(block.session.rep_count, 1);
});

test("block clip yields jump metrics", () => {
  const block = buildMeasurementsBlock("block", blockClip(), 30);
  assert.ok(block);
  const rep = block.reps[0];
  assert.equal(rep.detector, "jump");
  const jump = rep.metrics.jump_height;
  assert.ok(jump, "jump_height expected");
  // Fixture rises 0.08 image units against a 0.58 body: about 0.14 bh.
  assert.ok((jump.value as number) > 0.08 && (jump.value as number) < 0.2,
    `jump_height=${jump.value}`);
  const spacing = rep.metrics.hand_spacing;
  assert.ok(spacing, "hand_spacing expected");
});

test("pass clip yields platform metrics with a sane platform angle", () => {
  const block = buildMeasurementsBlock("pass", passClip(), 30);
  assert.ok(block);
  const rep = block.reps[0];
  assert.equal(rep.detector, "platform");
  const angle = rep.metrics.platform_angle;
  assert.ok(angle, "platform_angle expected");
  // Elbow (0.54) to wrist (0.62) drop over 0.03 horizontal: steep-ish angle,
  // but bounded to a plausible forearm slope.
  assert.ok((angle.value as number) >= 0 && (angle.value as number) <= 90);
});

test("low visibility collapses confidence and omits metrics rather than lying", () => {
  const dim = serveClip(0.3);
  const block = buildMeasurementsBlock("serve", dim, 30);
  if (block) {
    // If anything survived, it must not include values below the floor and
    // the omission list must be non-empty.
    assert.ok(block.omitted_below_confidence.length > 0);
    for (const rep of block.reps) {
      for (const m of Object.values(rep.metrics)) {
        assert.ok(m.confidence >= NOISE_FLOOR);
      }
    }
  } else {
    assert.equal(block, null);
  }
});

test("calm footage produces no block at all", () => {
  const frames = Array.from({ length: 120 }, (_, i) => standingFrame(i / 30));
  assert.equal(buildMeasurementsBlock("serve", frames, 30), null);
  assert.equal(buildMeasurementsBlock("pass", frames, 30), null);
  assert.equal(buildMeasurementsBlock("block", frames, 30), null);
});

test("too few frames produces no block", () => {
  const frames = Array.from({ length: 5 }, (_, i) => standingFrame(i / 30));
  assert.equal(buildMeasurementsBlock("attack", frames, 30), null);
});

test("new load metrics stay in physical ranges or are omitted", () => {
  // Same swing family as attack: the serve fixture exercises plant + separation.
  const serveBlock = buildMeasurementsBlock("serve", serveClip(), 30);
  assert.ok(serveBlock);
  const sep = serveBlock.reps[0].metrics.shoulder_hip_separation;
  if (sep) {
    assert.ok((sep.value as number) >= 0 && (sep.value as number) <= 180, `sep=${sep.value}`);
  } else {
    assert.ok(serveBlock.omitted_below_confidence.includes("shoulder_hip_separation"));
  }

  const attackBlock = buildMeasurementsBlock("attack", serveClip(), 30);
  assert.ok(attackBlock);
  const knee = attackBlock.reps[0].metrics.knee_flexion_at_plant;
  if (knee) {
    assert.ok((knee.value as number) > 0 && (knee.value as number) <= 180, `knee=${knee.value}`);
  } else {
    assert.ok(attackBlock.omitted_below_confidence.includes("knee_flexion_at_plant"));
  }
});

test("clean attack footage keeps leg and hip checkpoints instead of omitting them", () => {
  // Visibility is read at the engine's own scale — see VISIBILITY_ANCHORS.
  // Hard-coding a level here is what made this test engine-specific in the
  // first place, so it now derives from the same anchors the gate does.
  const block = buildMeasurementsBlock("attack", attackClip(VISIBILITY_ANCHORS.cleanVis), 30);
  assert.ok(block, "expected an attack measurements block on clean footage");
  const rep = block.reps[0];

  for (const key of ["knee_flexion_at_plant", "shoulder_hip_separation", "jump_height"]) {
    assert.ok(rep.metrics[key], `${key} should survive gating at clean visibility`);
    assert.ok(!block.omitted_below_confidence.includes(key), `${key} wrongly omitted`);
    assert.ok(rep.metrics[key].confidence >= NOISE_FLOOR, `${key} conf=${rep.metrics[key].confidence}`);
  }

  // Every surviving metric carries a real confidence at or above the floor.
  for (const [key, m] of Object.entries(rep.metrics)) {
    assert.ok(m.confidence >= NOISE_FLOOR, `${key} confidence=${m.confidence}`);
  }
});

test("occluded attack footage still fails closed below the noise floor", () => {
  const block = buildMeasurementsBlock("attack", attackClip(0.4), 30);
  if (block) {
    for (const key of ["knee_flexion_at_plant", "shoulder_hip_separation", "jump_height"]) {
      assert.ok(
        !block.reps[0].metrics[key],
        `${key} should not survive on occluded footage`,
      );
    }
    for (const rep of block.reps) {
      for (const m of Object.values(rep.metrics)) {
        assert.ok(m.confidence >= NOISE_FLOOR);
      }
    }
  } else {
    assert.equal(block, null);
  }
});

// The calibration of confidenceScore itself is pinned in
// confidence-calibration.test.ts, which owns the anchors, the monotonicity and
// attenuation properties, and the engine-coverage guard. Duplicating those
// assertions here would let the two copies drift apart, which is the failure
// mode that file exists to prevent — so this file only checks that the gate is
// wired into block assembly, above and below.
test("high visibility clamps rather than overflowing", () => {
  assert.ok(confidenceScore(1, 1, 1) <= 1);
  assert.ok(confidenceScore(2, 1, 1) <= 1);
});

test("keyJointsForSkill derives the landmark set from the skill's metric defs", () => {
  const joints = keyJointsForSkill("attack");
  assert.ok(joints.length > 0);
  // Sorted, de-duplicated indices.
  assert.deepEqual(joints, [...new Set(joints)].sort((a, b) => a - b));
  // Attack scores leg and ankle checkpoints, so those joints must be present.
  assert.ok(joints.includes(LM.leftKnee) && joints.includes(LM.leftAnkle));
});

test("detectRepsForSkill maps skills to families", () => {
  const { reps } = detectRepsForSkill("serve", serveClip());
  assert.equal(reps.length, 1);
  assert.equal(reps[0].detector, "swing");
  const jump = detectRepsForSkill("block", blockClip());
  assert.equal(jump.reps[0]?.detector, "jump");
  const platform = detectRepsForSkill("dig", passClip());
  assert.equal(platform.reps[0]?.detector, "platform");
});
