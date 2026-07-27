import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRequestSchema } from "./analyze-request.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01, 0xff, 0xd9]).toString(
  "base64",
);

function validBody() {
  return {
    skill: "serve",
    discipline: "indoor",
    source: "video",
    duration_s: 12,
    frames: [
      { index: 0, time_s: 1, data: jpeg },
      { index: 1, time_s: 2, data: jpeg },
    ],
  };
}

test("analysis request accepts a bounded sequential JPEG set", () => {
  assert.equal(analyzeRequestSchema.safeParse(validBody()).success, true);
});

test("analysis request rejects non-JPEG frame data", () => {
  const body = validBody();
  body.frames[0].data = Buffer.from("not a jpeg").toString("base64");
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request rejects non-sequential frame indices", () => {
  const body = validBody();
  body.frames[1].index = 4;
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request rejects a photo sequence", () => {
  const body = validBody();
  body.source = "photos";
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});

test("analysis request rejects impossible durations and timestamps", () => {
  const body = validBody();
  body.duration_s = -1;
  body.frames[0].time_s = -1;
  assert.equal(analyzeRequestSchema.safeParse(body).success, false);
});
