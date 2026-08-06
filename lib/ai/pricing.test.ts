import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { estimateCostUsd } from "./pricing.ts";

const zero = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

test("cost formula prices every token class at its own rate", () => {
  // 1M of each class on claude-opus-4-8 ($5 in / $25 out per MTok):
  // input 5 + cache read 0.5 (0.1x) + cache write 6.25 (1.25x) + output 25.
  const usd = estimateCostUsd(
    {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    },
    "claude-opus-4-8",
  );
  assert.equal(usd, 5 + 0.5 + 6.25 + 25);
});

test("a realistic single analysis lands in the expected range", () => {
  // Shape of one analyze call: mostly cached rubric, a few frames, small output.
  const usd = estimateCostUsd(
    {
      input_tokens: 8_000,
      output_tokens: 2_500,
      cache_read_input_tokens: 12_000,
      cache_creation_input_tokens: 0,
    },
    "claude-opus-4-8",
  );
  assert.ok(usd > 0.05 && usd < 0.25, `got ${usd}`);
});

test("zero tokens cost zero", () => {
  assert.equal(estimateCostUsd(zero, "claude-opus-4-8"), 0);
  assert.equal(estimateCostUsd(zero, "claude-sonnet-5"), 0);
});

test("an unknown model throws instead of silently pricing at zero", () => {
  assert.throws(() => estimateCostUsd(zero, "mock"));
  assert.throws(() => estimateCostUsd(zero, ""));
  assert.throws(() => estimateCostUsd(zero, "claude-nonexistent-9"));
});

// THE GAP THIS CLOSES. `/api/analyze` moved to the gateway and started writing
// `VISION_MODEL` into `analyses.model` while pricing.ts still knew only the
// retired coaching tiers. Nothing failed, because ANALYZE_MONTHLY_BUDGET_USD is
// unset in production (D-077) so the guard never priced anything. Setting that
// one env var would have made `checkAnalyzeBudget` throw on the first real row,
// and the guard fails CLOSED: a calm 503 for every player at once, from a
// variable someone set to be careful with money.
//
// So the constants and the rate table are pinned together. A new model id
// cannot ship without its row.
test("every model the app can call has a rate row (D-098)", async () => {
  // lib/ai/client.ts is server-only and cannot be imported here, so the ids are
  // read out of its source. That is the same shape lib/billing.test.ts uses for
  // the same reason, and it is strictly better than duplicating the strings:
  // a duplicate would go stale silently, whereas this fails the moment a
  // constant changes without its rate row.
  const src = await readFile(new URL("./client.ts", import.meta.url), "utf8");
  const ids = [...src.matchAll(/^export const \w+_MODEL = "([^"]+)";$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 2, `expected two model constants, found ${ids.length}`);
  for (const model of ids) {
    assert.doesNotThrow(
      () => estimateCostUsd(zero, model),
      `${model} is callable but has no pricing row; the budget guard would fail closed`,
    );
  }
});

// Retired tiers stay priced for exactly one reason: rows already in the
// database name them. Dropping a row makes the month-to-date read throw on
// history instead of pricing it.
test("retired model strings stay priced so stored telemetry still reads", () => {
  for (const model of ["claude-opus-5", "claude-opus-4-8", "claude-sonnet-5"]) {
    assert.doesNotThrow(() => estimateCostUsd(zero, model));
  }
});

// Direction matters: an estimate may overstate and must never understate, which
// is what makes the throw above safe to rely on.
test("gateway rates price a real read in the right ballpark", () => {
  // The measured video read: ~2,262 in / ~1,119 out.
  const read = {
    input_tokens: 2262,
    output_tokens: 1119,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  const cost = estimateCostUsd(read, "google/gemini-3.6-flash");
  assert.ok(cost > 0, "a real read must not price at zero");
  assert.ok(cost < 0.05, `a single clip read should be well under 5 cents, got ${cost}`);
});
