import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFailureStatus } from "./analyze-status.ts";

test("503 stays the calm unavailable state", () => {
  const s = analyzeFailureStatus(503, null);
  assert.equal(s.kind, "unavailable");
  assert.match(s.message, /wasn't counted/);
});

test("429 hourly limit reads as calm, not as a failure", () => {
  const s = analyzeFailureStatus(429, null);
  assert.equal(s.kind, "unavailable");
  assert.match(s.message, /hourly/i);
});

test("402 free cap reads as calm, not as a failure", () => {
  const s = analyzeFailureStatus(402, null);
  assert.equal(s.kind, "unavailable");
  assert.match(s.message, /free analysis/i);
});

test("server copy wins over the fallback when present", () => {
  for (const status of [503, 429, 402, 502]) {
    assert.equal(analyzeFailureStatus(status, "Server says so.").message, "Server says so.");
  }
});

test("blank server copy falls back", () => {
  assert.notEqual(analyzeFailureStatus(503, "").message, "");
  assert.notEqual(analyzeFailureStatus(502, "   ").message.trim(), "");
});

test("conflicts and unknown failures stay the coral error state", () => {
  assert.equal(analyzeFailureStatus(409, "An analysis is already running.").kind, "error");
  assert.equal(analyzeFailureStatus(502, null).kind, "error");
  assert.equal(analyzeFailureStatus(500, null).kind, "error");
  assert.equal(analyzeFailureStatus(400, null).kind, "error");
});
