import assert from "node:assert/strict";
import test from "node:test";

import { appContentPayload, APP_CONTENT_VERSION } from "./app-content.ts";
import { SKILLS } from "./skills.ts";

test("the payload carries the whole corpus, keyed by the shared vocabulary", () => {
  const payload = appContentPayload();

  assert.equal(payload.version, APP_CONTENT_VERSION);
  assert.deepEqual(
    payload.skills.map((s) => s.key),
    [...SKILLS],
  );
  for (const s of payload.skills) {
    assert.ok(s.label.length > 0, `${s.key}: label`);
    assert.ok(s.blurb.length > 0, `${s.key}: blurb`);
  }

  // Every skill has drills to point at and a technique entry to teach from.
  for (const skill of SKILLS) {
    assert.ok(
      payload.drills.some((d) => d.skill === skill),
      `${skill}: at least one drill`,
    );
    assert.ok(payload.technique[skill], `${skill}: technique entry`);
  }

  assert.ok(payload.rehab.entries.length > 0);
  for (const entry of payload.rehab.entries) {
    assert.ok(
      entry.region in payload.rehab.region_labels,
      `${entry.slug}: region has a label`,
    );
    assert.ok(
      entry.triage in payload.rehab.triage_labels,
      `${entry.slug}: triage has a label`,
    );
  }
});

test("the payload is plain JSON, so the wire cannot lose anything", () => {
  const payload = appContentPayload();
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});
