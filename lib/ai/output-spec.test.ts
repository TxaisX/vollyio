import { test } from "node:test";
import assert from "node:assert/strict";
import { outputSpec } from "./output-spec.ts";

test("MEASURED DATA copy frames values as confidence-weighted, not uniform ground truth", () => {
  const spec = outputSpec("attack", "intermediate");
  assert.ok(!spec.includes("trusted ground truth"), "must not label measurements as trusted ground truth");
  assert.ok(
    !spec.includes("not measured confidently"),
    "must not route present-but-low values to visual-only assessment",
  );
  assert.ok(spec.includes("confidence"), "must instruct weighting by confidence");
  // The honesty floor and never-invent clauses stay.
  assert.ok(spec.includes("never invent measurements"));
});
