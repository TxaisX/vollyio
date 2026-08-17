import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasLocalEvalAccess,
  hasTrustedMutationOrigin,
  isJpegPayload,
  isLocalRequest,
  mutationGate,
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

const ROUTE = "https://vollyio.example/api/analyze";

test("mutationGate keeps the browser's same-origin rule", () => {
  const same = new Request(ROUTE, {
    method: "POST",
    headers: { origin: "https://vollyio.example" },
  });
  const foreign = new Request(ROUTE, {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  const bare = new Request(ROUTE, { method: "POST" });

  assert.deepEqual(mutationGate(same), { mode: "cookie" });
  assert.deepEqual(mutationGate(foreign), { mode: "reject" });
  assert.deepEqual(mutationGate(bare), { mode: "reject" });
});

test("mutationGate admits a bearer token with no Origin at all", () => {
  // The native client, exactly: OkHttp sends no Origin, which is precisely the
  // request the old guard rejected and the whole reason D-120 exists.
  const native = new Request(ROUTE, {
    method: "POST",
    headers: { authorization: "Bearer player-access-token" },
  });
  assert.deepEqual(mutationGate(native), {
    mode: "bearer",
    token: "player-access-token",
  });
});

test("an Authorization header NEVER falls back to the cookie jar", () => {
  // The security property of the whole gate. A hostile page cannot read a real
  // token, but it can certainly send a junk one from a browser that will attach
  // the victim's cookies for free. If a failed bearer parse degraded to the
  // cookie path, that request would arrive past the origin check carrying
  // somebody else's session. Every one of these must reject rather than shrug.
  for (const header of ["Bearer", "Bearer ", "Basic abc123", "Bearer a b"]) {
    const request = new Request(ROUTE, {
      method: "POST",
      headers: { origin: "https://vollyio.example", authorization: header },
    });
    assert.deepEqual(
      mutationGate(request),
      { mode: "reject" },
      `${JSON.stringify(header)} must reject, never fall back to cookies`,
    );
  }
});

test("the bearer scheme is matched case-insensitively", () => {
  const request = new Request(ROUTE, {
    method: "POST",
    headers: { authorization: "bearer player-access-token" },
  });
  assert.deepEqual(mutationGate(request), {
    mode: "bearer",
    token: "player-access-token",
  });
});

test("a valid bearer wins over the Origin header rather than combining with it", () => {
  const request = new Request(ROUTE, {
    method: "POST",
    headers: { origin: "https://evil.example", authorization: "Bearer real-token" },
  });
  // Not a hole: a foreign page cannot obtain a token, and a cross-origin
  // request that sets Authorization is preflighted, which this app answers with
  // no CORS headers. Anyone holding a real token can call from a server anyway,
  // where Origin is whatever they typed, so the header adds nothing here.
  assert.deepEqual(mutationGate(request), { mode: "bearer", token: "real-token" });
});

test("JPEG payload validation checks type and decoded size", () => {
  assert.equal(isJpegPayload(jpeg, 8), true);
  assert.equal(isJpegPayload(jpeg, 7), false);
  assert.equal(isJpegPayload(Buffer.from("not an image").toString("base64"), 100), false);
  assert.equal(isJpegPayload("%%%%", 100), false);
});

