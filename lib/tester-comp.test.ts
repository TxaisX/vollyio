import { test } from "node:test";
import assert from "node:assert/strict";
import { testerCompActions, type TesterCompRow } from "./tester-comp.ts";

const NOW = "2026-08-17T12:00:00.000Z";
const FUTURE = "2026-09-10T12:00:00.000Z";
const PAST = "2026-08-01T12:00:00.000Z";

function row(over: Partial<TesterCompRow>): TesterCompRow {
  return {
    id: "9cecf88f-a582-47bf-a76c-e2514a2977c5",
    email: "tester@club.com",
    isAnonymous: false,
    plan: "free",
    hasSubscription: false,
    testerCompUntil: null,
    ...over,
  };
}

test("a free member with no marker is granted", () => {
  const { grant, revoke } = testerCompActions([row({})], ["tester@club.com"], NOW);
  assert.equal(grant.length, 1);
  assert.equal(revoke.length, 0);
});

test("membership matching is case- and whitespace-insensitive", () => {
  const { grant } = testerCompActions(
    [row({ email: "Tester@Club.com" })],
    ["  TESTER@club.com "],
    NOW,
  );
  assert.equal(grant.length, 1);
});

test("leaving the group revokes a live comp", () => {
  const { grant, revoke } = testerCompActions(
    [row({ plan: "pro", testerCompUntil: FUTURE })],
    [],
    NOW,
  );
  assert.equal(grant.length, 0);
  assert.equal(revoke.length, 1);
  assert.equal(revoke[0].reason, "left_group");
});

test("a comp past its date is revoked even for a standing member", () => {
  const { revoke } = testerCompActions(
    [row({ plan: "pro", testerCompUntil: PAST })],
    ["tester@club.com"],
    NOW,
  );
  assert.equal(revoke.length, 1);
  assert.equal(revoke[0].reason, "expired");
});

test("a member inside their comp window is left alone", () => {
  const { grant, revoke } = testerCompActions(
    [row({ plan: "pro", testerCompUntil: FUTURE })],
    ["tester@club.com"],
    NOW,
  );
  assert.equal(grant.length + revoke.length, 0);
});

test("one comp per account: a marker blocks a re-grant even after rejoining", () => {
  const { grant } = testerCompActions(
    [row({ plan: "free", testerCompUntil: PAST })],
    ["tester@club.com"],
    NOW,
  );
  assert.equal(grant.length, 0);
});

test("a real subscription is never touched in either direction", () => {
  const paidMember = row({ hasSubscription: true, plan: "pro" });
  const paidLeaver = row({
    hasSubscription: true,
    plan: "pro",
    testerCompUntil: PAST,
  });
  const { grant, revoke } = testerCompActions([paidMember, paidLeaver], ["tester@club.com"], NOW);
  assert.equal(grant.length + revoke.length, 0);
});

test("a hand comp with no marker is not this programme's to take back", () => {
  const { revoke } = testerCompActions([row({ plan: "pro" })], [], NOW);
  assert.equal(revoke.length, 0);
});

test("missing email, anonymous rows and junk dates all resolve to no action", () => {
  const rows = [
    row({ email: null }),
    row({ email: "" }),
    row({ isAnonymous: true }),
    row({ plan: "pro", testerCompUntil: "not-a-date" }),
  ];
  const { grant, revoke } = testerCompActions(rows, ["tester@club.com"], NOW);
  assert.equal(grant.length + revoke.length, 0);
});
