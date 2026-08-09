import test from "node:test";
import assert from "node:assert/strict";
import { checkpointRank, checkpointStanding } from "./breakdown-shape.ts";
import { metricKeys } from "../lib/ai/metrics.ts";
import type { AnalysisResult } from "../lib/analysis-types.ts";

// The Advanced tab orders the five checkpoints strongest to weakest. It does
// NOT number them, and these tests exist to keep it that way: `overall_score`
// is a single judgement the model returns about the whole rep and nothing in
// this list feeds it, so a per-row number would describe a sum that does not
// happen. It is also the move that ceiling-pegged the frame path at a median of
// 97 (D-094). Ordering is offered instead because D-099 measured ordering as
// the reliable signal (rank correlation 0.708) while absolute level was not.

const SKILL = "attack" as const;
const KEYS = metricKeys(SKILL);

function result(over: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    overall_score: 74,
    summary: "",
    strengths: [],
    changes: [],
    ...over,
  } as AnalysisResult;
}

test("the ranking runs strengths first, unranked in the middle, changes last", () => {
  const [a, b, c, d, e] = KEYS;
  const ranked = checkpointRank(
    SKILL,
    result({
      strengths: [
        { key: c, title: "c", detail: "" },
        { key: a, title: "a", detail: "" },
      ],
      changes: [{ key: e, title: "e", detail: "" }],
    } as Partial<AnalysisResult>),
  );
  // Strengths keep the model's own order, which is the ranking D-099 trusts.
  assert.deepEqual(ranked.slice(0, 2), [c, a]);
  // Unranked sits between: "not among the best or the worst here" is the middle.
  assert.deepEqual(new Set(ranked.slice(2, 4)), new Set([b, d]));
  assert.equal(ranked.at(-1), e);
});

test("all five rows survive the ordering, whatever the clip showed", () => {
  // The section promises every checkpoint on every rep. That outranks the
  // ordering: a player who opens Advanced to see the five things a coach
  // watches must find five, even on a rep the model barely ranked.
  for (const r of [
    result(),
    result({ strengths: [{ key: KEYS[0], title: "", detail: "" }] } as Partial<AnalysisResult>),
    result({ changes: [{ key: KEYS[1], title: "", detail: "" }] } as Partial<AnalysisResult>),
  ]) {
    const ranked = checkpointRank(SKILL, r);
    assert.equal(ranked.length, KEYS.length);
    assert.deepEqual(new Set(ranked), new Set(KEYS));
  }
});

test("a key the catalog does not name never reaches the list", () => {
  // Same posture as the drill slugs: an invented key is dropped, never rendered
  // as raw machine text and never allowed to displace a real checkpoint.
  const ranked = checkpointRank(
    SKILL,
    result({
      strengths: [{ key: "invented_key", title: "", detail: "" }],
      changes: [{ key: "another_invention", title: "", detail: "" }],
    } as Partial<AnalysisResult>),
  );
  assert.deepEqual(new Set(ranked), new Set(KEYS));
  assert.ok(!ranked.includes("invented_key"));
});

test("a checkpoint is never given a number, only a standing", () => {
  // The guard that matters. `standing` may say worked or change; if it ever
  // grows a score, a per-row number is one render away, and that is the D-094
  // failure arriving through a different door.
  const standing = checkpointStanding(
    SKILL,
    result({
      strengths: [{ key: KEYS[0], title: "", detail: "" }],
      changes: [{ key: KEYS[1], title: "", detail: "" }],
    } as Partial<AnalysisResult>),
  );
  for (const value of Object.values(standing)) {
    assert.ok(
      value === "worked" || value === "change",
      `checkpoint standing must stay categorical, got ${String(value)}`,
    );
    assert.notEqual(typeof value, "number");
  }
});
