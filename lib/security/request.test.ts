import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasLocalEvalAccess,
  hasTrustedMutationOrigin,
  isJpegPayload,
  isLocalRequest,
  readJsonRequest,
} from "./request.ts";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01, 0xff, 0xd9]).toString(
  "base64",
);

test("readJsonRequest accepts JSON within the byte limit", async () => {
  const request = new Request("https://vollyio.example/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true }),
  });
  assert.deepEqual(await readJsonRequest(request, 64), {
    ok: true,
    value: { ok: true },
  });
});

test("readJsonRequest rejects an unsupported content type", async () => {
  const request = new Request("https://vollyio.example/api/analyze", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.deepEqual(await readJsonRequest(request, 64), {
    ok: false,
    error: "unsupported_media_type",
  });
});

test("readJsonRequest rejects a declared oversized body", async () => {
  const request = new Request("https://vollyio.example/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "65" },
    body: "{}",
  });
  assert.deepEqual(await readJsonRequest(request, 64), {
    ok: false,
    error: "payload_too_large",
  });
});

test("readJsonRequest rejects a streamed body that crosses the limit", async () => {
  const request = new Request("https://vollyio.example/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(80) }),
  });
  assert.deepEqual(await readJsonRequest(request, 32), {
    ok: false,
    error: "payload_too_large",
  });
});

test("readJsonRequest rejects malformed JSON", async () => {
  const request = new Request("https://vollyio.example/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.deepEqual(await readJsonRequest(request, 64), {
    ok: false,
    error: "invalid_json",
  });
});

test("mutation origin must match the request origin", () => {
  assert.equal(
    hasTrustedMutationOrigin(
      new Request("https://vollyio.example/api/coach", {
        headers: { origin: "https://vollyio.example" },
      }),
    ),
    true,
  );
  assert.equal(
    hasTrustedMutationOrigin(
      new Request("https://vollyio.example/api/coach", {
        headers: { origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assert.equal(
    hasTrustedMutationOrigin(new Request("https://vollyio.example/api/coach")),
    false,
  );
});

test("local-only requests reject non-loopback hosts", () => {
  assert.equal(isLocalRequest(new Request("http://localhost:3000/api/eval")), true);
  assert.equal(isLocalRequest(new Request("http://127.0.0.1:3000/api/eval")), true);
  assert.equal(isLocalRequest(new Request("https://preview.example/api/eval")), false);
});

test("local eval access also requires the server-side bearer token", () => {
  const local = new Request("http://localhost:3000/api/eval", {
    headers: { authorization: "Bearer test-eval-token" },
  });
  const missing = new Request("http://localhost:3000/api/eval");
  const remote = new Request("https://preview.example/api/eval", {
    headers: { authorization: "Bearer test-eval-token" },
  });

  assert.equal(hasLocalEvalAccess(local, "test-eval-token"), true);
  assert.equal(hasLocalEvalAccess(local, "wrong-token"), false);
  assert.equal(hasLocalEvalAccess(missing, "test-eval-token"), false);
  assert.equal(hasLocalEvalAccess(remote, "test-eval-token"), false);
  assert.equal(hasLocalEvalAccess(local, undefined), false);
});

test("JPEG payload validation checks type and decoded size", () => {
  assert.equal(isJpegPayload(jpeg, 8), true);
  assert.equal(isJpegPayload(jpeg, 7), false);
  assert.equal(isJpegPayload(Buffer.from("not an image").toString("base64"), 100), false);
  assert.equal(isJpegPayload("%%%%", 100), false);
});

