import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_RETENTION_DAYS,
  expiredAnonymousIds,
} from "./anonymous-retention.ts";

const NOW = "2026-09-13T12:00:00.000Z";
const OLD = "2026-08-01T12:00:00.000Z"; // 43 days before NOW
const RECENT = "2026-09-10T12:00:00.000Z"; // 3 days before NOW
const ID = "9cecf88f-a582-47bf-a76c-e2514a2977c5";
const OTHER_ID = "1f2e3d4c-5b6a-4798-8a9b-0c1d2e3f4a5b";

const anon = (over: Record<string, unknown> = {}) => ({
  id: ID,
  created_at: OLD,
  is_anonymous: true,
  email: null,
  ...over,
});

test("an expired anonymous session is selected", () => {
  assert.deepEqual(expiredAnonymousIds([anon()], NOW), [ID]);
});

test("a recent anonymous session is left alone", () => {
  assert.deepEqual(expiredAnonymousIds([anon({ created_at: RECENT })], NOW), []);
});

// The one that matters. Everything else here is storage; this one is somebody's
// account and their film.
test("a converted account is never selected, by either signal", () => {
  const converted = [
    anon({ is_anonymous: false }),
    anon({ is_anonymous: false, email: "player@club.com" }),
    // The flag and the address disagreeing is somebody's bug. It must not
    // become somebody's loss: the address wins and the row is kept.
    anon({ is_anonymous: true, email: "player@club.com" }),
  ];
  assert.deepEqual(expiredAnonymousIds(converted, NOW), []);
});

// A listing that stopped returning the field would otherwise read as "everybody
// is anonymous", and this function would propose deleting the user table.
test("a missing anonymous flag is not a false one", () => {
  const rows = [
    { id: ID, created_at: OLD },
    { id: ID, created_at: OLD, is_anonymous: null },
    { id: ID, created_at: OLD, is_anonymous: "true" },
    { id: ID, created_at: OLD, is_anonymous: 1 },
  ];
  assert.deepEqual(expiredAnonymousIds(rows, NOW), []);
});

test("an unreadable row is kept, never guessed at", () => {
  const rows = [
    null,
    undefined,
    "a string",
    42,
    anon({ created_at: "not a date" }),
    anon({ created_at: null }),
    anon({ id: "not-a-uuid" }),
    anon({ id: 123 }),
  ];
  assert.deepEqual(expiredAnonymousIds(rows, NOW), []);
});

// A clock that has slipped is not a retention decision.
test("a row created in the future is never expired", () => {
  assert.deepEqual(
    expiredAnonymousIds([anon({ created_at: "2027-01-01T00:00:00.000Z" })], NOW),
    [],
  );
});

// The typo that would delete everything: a window of zero makes a row created
// one second ago older than its allowance.
test("a nonsense retention window selects nothing rather than everything", () => {
  for (const days of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(expiredAnonymousIds([anon()], NOW, days), [], `days=${days}`);
  }
  assert.deepEqual(expiredAnonymousIds([anon()], "not a date"), []);
  assert.deepEqual(expiredAnonymousIds({ not: "an array" }, NOW), []);
});

test("the boundary is the far side of the window, not the near side", () => {
  const dayMs = 86_400_000;
  const nowMs = Date.parse(NOW);
  const exactly = new Date(nowMs - ANONYMOUS_RETENTION_DAYS * dayMs).toISOString();
  const justOver = new Date(nowMs - ANONYMOUS_RETENTION_DAYS * dayMs - 1000).toISOString();

  // Exactly at the window is still inside it: the row has not yet outlived the
  // promise, and a boundary that deletes is a boundary that surprises.
  assert.deepEqual(expiredAnonymousIds([anon({ created_at: exactly })], NOW), []);
  assert.deepEqual(expiredAnonymousIds([anon({ created_at: justOver })], NOW), [ID]);
});

test("a mixed listing returns only the rows that qualify, in order", () => {
  const rows = [
    anon({ id: OTHER_ID }),
    anon({ created_at: RECENT }),
    anon({ is_anonymous: false }),
    anon({ id: ID }),
  ];
  assert.deepEqual(expiredAnonymousIds(rows, NOW), [OTHER_ID, ID]);
});
