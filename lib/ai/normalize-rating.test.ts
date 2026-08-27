import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSimpleRating, simpleRatingSchema } from "./simple-rubric.ts";

// The shapes the free reader actually returned on 2026-08-27 (D-132), each
// of which failed the strict parse as a refunded 502 while meaning the same
// analysis the paid reader would have produced.

test("a score named `rating` and a numeric confidence parse as the schema", () => {
  const parsed = simpleRatingSchema.safeParse(
    normalizeSimpleRating({
      ratable: true,
      rating: 62,
      confidence: 0.62,
      summary: "A full swing on grass.",
      strengths: [{ key: "arm_swing", title: "Full arm swing", detail: "Long path." }],
      improvements: [
        { key: "approach_footwork", title: "Close faster", detail: "Two steps.", difficulty: 2, timeframe: 3 },
      ],
      drill_slugs: [],
      checkpoints: [{ key: "arm_swing", visible: "true", observation: "Elbow high." }],
    }),
  );
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.overall_score, 62);
  assert.equal(parsed.data.confidence, "0.62");
  assert.equal(parsed.data.improvements?.[0]?.difficulty, "2");
  assert.equal(parsed.data.improvements?.[0]?.timeframe, "3");
  assert.equal(parsed.data.checkpoints?.[0]?.visible, true);
});

test("a bare refusal parses and stays a refusal", () => {
  const parsed = simpleRatingSchema.safeParse(
    normalizeSimpleRating({ ratable: false, not_ratable_reason: "Handheld, rotating, no isolated rep." }),
  );
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.ratable, false);
  assert.equal(parsed.data.overall_score, undefined);
});

test("nothing is invented: no score under any name stays no score", () => {
  const out = normalizeSimpleRating({ ratable: true, summary: "x", strengths: [], improvements: [] }) as {
    overall_score?: unknown;
  };
  assert.equal(out.overall_score, undefined);
});

test("a reply that already matches the schema passes through unchanged", () => {
  const input = {
    ratable: true,
    overall_score: 71,
    confidence: "medium",
    strengths: [{ title: "a", detail: "b" }],
    improvements: [{ title: "c", detail: "d", difficulty: "easy", timeframe: "a week" }],
    drill_slugs: ["x"],
    summary: "s",
  };
  assert.deepEqual(normalizeSimpleRating(input), input);
});

test("non-objects are returned as they came", () => {
  assert.equal(normalizeSimpleRating(null), null);
  assert.equal(normalizeSimpleRating("text"), "text");
  assert.deepEqual(normalizeSimpleRating([1]), [1]);
});

test("inverse polarity, keyed checkpoints and `drills` all map onto the schema", () => {
  const parsed = simpleRatingSchema.safeParse(
    normalizeSimpleRating({
      not_ratable: false,
      rating: 58,
      summary: "s",
      checkpoints: {
        approach_footwork: { visible: true, observation: "Three steps." },
        arm_swing: { visible: "false", observation: "" },
      },
      strengths: { "Full swing": "Long path." },
      improvements: [{ title: "Close faster", detail: "d", difficulty: "easy", timeframe: "a week" }],
      drills: [{ slug: "attack-approach-4step" }, "attack-tossed-approach-timing"],
    }),
  );
  assert.equal(parsed.success, true, JSON.stringify(parsed.success ? null : parsed.error.issues));
  if (!parsed.success) return;
  assert.equal(parsed.data.ratable, true);
  assert.equal(parsed.data.overall_score, 58);
  assert.deepEqual(
    parsed.data.checkpoints?.map((c) => [c.key, c.visible]),
    [["approach_footwork", true], ["arm_swing", false]],
  );
  assert.equal(parsed.data.strengths?.[0]?.title, "Full swing");
  assert.deepEqual(parsed.data.drill_slugs, ["attack-approach-4step", "attack-tossed-approach-timing"]);
});
