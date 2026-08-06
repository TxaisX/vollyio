import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRequestSchema } from "./analyze-request.ts";

function validBody() {
  return {
    skill: "serve",
    discipline: "indoor",
    source: "video",
    duration_s: 5.5,
    pending_clip_id: "5f9c1f0e-3a4b-4c2d-8e1f-0a1b2c3d4e5f",
    clip_ext: "mp4",
  };
}

test("analysis request accepts a clip reference", () => {
  assert.equal(analyzeRequestSchema.safeParse(validBody()).success, true);
});

// The route reads the clip out of storage by this id. A caller-shaped string
// here would let a request name a path segment of its own choosing, so the
// UUID shape is the boundary that keeps the read inside the pending prefix.
test("analysis request rejects a clip id that is not a UUID", () => {
  const body = { ...validBody(), pending_clip_id: "../../other-user" };
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request requires a clip", () => {
  const body: Record<string, unknown> = validBody();
  delete body.pending_clip_id;
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

// The extension is concatenated into a storage path, so it is an enum rather
// than a sanitized string: the set of containers the provider dispatches on is
// closed, and anything outside it has no read to perform.
test("analysis request rejects an unlisted clip extension", () => {
  const body = { ...validBody(), clip_ext: "gif" };
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request rejects a photo sequence", () => {
  const body = { ...validBody(), source: "photos" };
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request rejects impossible durations", () => {
  const body = { ...validBody(), duration_s: -1 };
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

// A tap outside the frame is a client bug, not a subject. Bounding it here is
// what keeps the instruction the route composes from carrying a number the
// player's own device made up.
test("analysis request rejects a focus point outside the frame", () => {
  const body = { ...validBody(), focus_point: { x: 1.4, y: 0.5, t_s: 1 } };
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request accepts a focus point inside the frame", () => {
  const body = { ...validBody(), focus_point: { x: 0.42, y: 0.61, t_s: 2.1 } };
  assert.equal(analyzeRequestSchema.safeParse(body).success, true);
});
