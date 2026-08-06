import { test } from "node:test";
import assert from "node:assert/strict";
import { consensusPointers, enforceEvidence, UNANSWERABLE_POINTERS } from "./pointers.ts";

const runs = (...statuses: string[][]) =>
  statuses.map((run) => run.map((s, i) => ({ key: `p${i}`, status: s })));

function statusOf(out: { key: string; status: string }[], key: string) {
  return out.find((p) => p.key === key)?.status;
}

test("a met that every run agrees on survives", () => {
  const out = consensusPointers(runs(["met"], ["met"], ["met"]));
  assert.equal(statusOf(out, "p0"), "met");
});

test("a met that only one run of three claims falls to the strictest judged verdict", () => {
  const out = consensusPointers(runs(["met"], ["partial"], ["partial"]));
  assert.equal(statusOf(out, "p0"), "partial");
});

test("two of three is a strict majority and keeps met", () => {
  const out = consensusPointers(runs(["met"], ["met"], ["partial"]));
  assert.equal(statusOf(out, "p0"), "met");
});

test("a missed anywhere outranks partial when met has no majority", () => {
  const out = consensusPointers(runs(["met"], ["partial"], ["missed"]));
  assert.equal(statusOf(out, "p0"), "missed");
});

// The regression this file exists for. not_visible EXCLUDES a pointer from the
// score, so treating it as the strict fallback silently raises the number:
// measured 2026-08-05, runs of 95/97/98 consensused to 100.
test("a lone not_visible does not drag a judged pointer out of the score", () => {
  const out = consensusPointers(runs(["met"], ["partial"], ["not_visible"]));
  assert.equal(
    statusOf(out, "p0"),
    "partial",
    "one run failing to see it must not remove the pointer from the arithmetic",
  );
});

test("abstention needs its own majority", () => {
  const out = consensusPointers(runs(["not_visible"], ["not_visible"], ["met"]));
  assert.equal(statusOf(out, "p0"), "not_visible");
});

test("consensus can never invent a verdict no run reported", () => {
  const out = consensusPointers(runs(["partial"], ["partial"], ["partial"]));
  assert.equal(statusOf(out, "p0"), "partial");
});

// The direction matters more than the fact of degrading. not_visible EXCLUDES
// a pointer, so degrading toward it RAISES the score; partial keeps the pointer
// in the denominator at half credit, which is what "harsher" actually means.
test("an uncited met degrades to partial, not out of the score", () => {
  const out = enforceEvidence([{ key: "under_the_ball", status: "met" }], 12);
  assert.equal(out[0].status, "partial");
});

test("a met cited outside the sent frames degrades to partial", () => {
  const out = enforceEvidence([{ key: "under_the_ball", status: "met", frame: 99 }], 12);
  assert.equal(out[0].status, "partial");
});

test("an uncited partial stays partial and is never excluded", () => {
  const out = enforceEvidence([{ key: "under_the_ball", status: "partial" }], 12);
  assert.equal(out[0].status, "partial");
});

test("a properly cited met survives", () => {
  const out = enforceEvidence([{ key: "under_the_ball", status: "met", frame: 4 }], 12);
  assert.equal(out[0].status, "met");
});

test("enforcement can never raise a score", () => {
  // Every degradation must move toward LESS credit. met -> partial is half
  // credit; met -> not_visible would be full exclusion, which is more credit.
  const before = [{ key: "under_the_ball", status: "met" }];
  const after = enforceEvidence(before, 12);
  assert.notEqual(after[0].status, "not_visible");
  assert.equal(after[0].status, "partial");
});

test("a question the footage cannot answer is refused even when cited", () => {
  for (const key of UNANSWERABLE_POINTERS) {
    const out = enforceEvidence([{ key, status: "met", frame: 3 }], 12);
    assert.equal(out[0].status, "not_visible", `${key} must never be met`);
  }
});

test("enforcement only ever moves a verdict toward abstention", () => {
  const out = enforceEvidence([{ key: "under_the_ball", status: "not_visible", frame: 2 }], 12);
  assert.equal(out[0].status, "not_visible");
});
