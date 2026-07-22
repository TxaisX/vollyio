import { test } from "node:test";
import assert from "node:assert/strict";
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
