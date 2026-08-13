import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeDay } from "./relative-day.ts";

// A fixed local noon to measure from, so the calendar-day boundary below is
// being tested and not the machine's clock.
const NOON = new Date(2026, 7, 13, 12, 0, 0).getTime();
const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m, d, h, 0, 0).toISOString();

test("the boundary is the calendar day, not twenty-four elapsed hours", () => {
  // The defect this replaced: dividing elapsed milliseconds by a day called
  // 11pm last night "Today" until 11pm tonight.
  assert.equal(relativeDay(at(2026, 7, 12, 23), NOON), "Yesterday");
  assert.equal(relativeDay(at(2026, 7, 13, 0), NOON), "Today");
  assert.equal(relativeDay(at(2026, 7, 13, 23), NOON), "Today");
});

test("a future timestamp reads as Today rather than a negative count", () => {
  assert.equal(relativeDay(at(2026, 7, 14), NOON), "Today");
});

test("days, then weeks, then the date itself", () => {
  assert.equal(relativeDay(at(2026, 7, 10), NOON), "3d ago");
  assert.equal(relativeDay(at(2026, 7, 7), NOON), "6d ago");
  assert.equal(relativeDay(at(2026, 7, 6), NOON), "1w ago");
  assert.equal(relativeDay(at(2026, 6, 20), NOON), "3w ago");
  // Past about a month the arithmetic stops being useful and the date is the
  // more informative answer.
  assert.equal(
    relativeDay(at(2026, 5, 20), NOON),
    new Date(2026, 5, 20, 12).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  );
});

test("the compact vocabulary is the one a list row has room for", () => {
  // "3d ago", never "3 days ago": the coach rail's old wording lost to the
  // dashboard's when the two merged, because a row in a compact list is where
  // this now renders everywhere.
  assert.match(relativeDay(at(2026, 7, 11), NOON), /^\d+d ago$/);
});
