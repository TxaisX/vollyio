import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCoachingError } from "./errors.ts";

test("credit-balance and spend-cap refusals are the capacity class", () => {
  // The two shapes seen in production: a 400 "credit balance is too low" and a
  // usage/spend cap. Both happen before any billable work, so the analysis can
  // be retried later for free.
  assert.equal(
    classifyCoachingError({
      status: 400,
      message: "Your credit balance is too low to access the API.",
    }),
    "capacity",
  );
  assert.equal(
    classifyCoachingError({
      status: 429,
      message: "This request would exceed your organization's monthly usage limit.",
    }),
    "capacity",
  );
  assert.equal(
    classifyCoachingError({ status: 402, message: "insufficient credit" }),
    "capacity",
  );
});

test("a plain rate limit or overload is the busy class, not capacity", () => {
  assert.equal(
    classifyCoachingError({ status: 429, message: "rate limit exceeded" }),
    "busy",
  );
  assert.equal(
    classifyCoachingError({ status: 529, message: "Overloaded" }),
    "busy",
  );
});

test("everything else is unknown, and a capacity word alone is not enough", () => {
  assert.equal(
    classifyCoachingError({ status: 500, message: "internal server error" }),
    "unknown",
  );
  // A capacity-sounding message with an implausible status must not trigger a
  // refund: the class requires both signals.
  assert.equal(
    classifyCoachingError({ status: 500, message: "credit balance is too low" }),
    "unknown",
  );
  assert.equal(
    classifyCoachingError({ status: null, message: null }),
    "unknown",
  );
});
