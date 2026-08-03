import { test } from "node:test";
import assert from "node:assert/strict";
import { profileUpdateFromForm, profileUpdateSchema } from "./profile-update.ts";

test("a single provided field parses and unknown values are rejected", () => {
  assert.deepEqual(profileUpdateSchema.safeParse({ position: "libero" }).success, true);
  assert.deepEqual(profileUpdateSchema.safeParse({ position: "coach" }).success, false);
  assert.deepEqual(profileUpdateSchema.safeParse({ play_frequency: "weekly" }).success, true);
  assert.deepEqual(profileUpdateSchema.safeParse({ discipline: "grass" }).success, true);
  // Settings never re-writes the legacy capture value.
  assert.deepEqual(profileUpdateSchema.safeParse({ discipline: "beach" }).success, false);
});

test("level is editable and bounded to the four the rubric knows", () => {
  // Level drives assignment difficulty, the plan seed, and the coach voice,
  // and it changes as a player improves: freezing it at onboarding was the
  // bug, not a boundary. The database grant always allowed this write
  // (docs/security.md profiles row); the app schema was the only thing in
  // the way.
  assert.equal(profileUpdateSchema.safeParse({ level: "beginner" }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ level: "pro" }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ level: "galactic" }).success, false);
});

test("display_name is trimmed and length-capped", () => {
  const ok = profileUpdateSchema.safeParse({ display_name: "  Txais  " });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.display_name, "Txais");
  assert.equal(profileUpdateSchema.safeParse({ display_name: "   " }).success, false);
  assert.equal(
    profileUpdateSchema.safeParse({ display_name: "x".repeat(41) }).success,
    false,
  );
});

test("an update with no fields at all is rejected", () => {
  assert.equal(profileUpdateSchema.safeParse({}).success, false);
});

test("form extraction keeps only provided non-empty fields", () => {
  const form = new FormData();
  form.set("display_name", "Txais");
  form.set("position", "");
  const parsed = profileUpdateFromForm(form);
  assert.deepEqual(parsed, { display_name: "Txais" });

  const empty = new FormData();
  assert.equal(profileUpdateFromForm(empty), null);

  const bad = new FormData();
  bad.set("discipline", "moon");
  assert.equal(profileUpdateFromForm(bad), null);
});
