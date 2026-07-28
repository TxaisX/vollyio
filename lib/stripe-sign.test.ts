import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { formEncode, parseSignatureHeader, verifyWebhookSignature } from "./stripe-sign.ts";

const SECRET = "whsec_test_do_not_use";

function sign(payload: string, timestamp: number, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

function header(payload: string, timestamp: number, secret = SECRET): string {
  return `t=${timestamp},v1=${sign(payload, timestamp, secret)}`;
}

const NOW = 1_785_000_000_000;
const T = Math.floor(NOW / 1000);

test("a correctly signed recent payload verifies", () => {
  const body = '{"id":"evt_1","type":"checkout.session.completed"}';
  assert.equal(verifyWebhookSignature(body, header(body, T), SECRET, NOW), true);
});

test("a tampered payload does not verify", () => {
  const body = '{"id":"evt_1","type":"checkout.session.completed"}';
  const head = header(body, T);
  const tampered = '{"id":"evt_1","type":"customer.subscription.deleted"}';
  assert.equal(verifyWebhookSignature(tampered, head, SECRET, NOW), false);
});

test("a signature from the wrong secret does not verify", () => {
  const body = "{}";
  assert.equal(
    verifyWebhookSignature(body, header(body, T, "whsec_someone_elses"), SECRET, NOW),
    false,
  );
});

test("a replayed payload outside the tolerance window does not verify", () => {
  const body = "{}";
  const old = T - 3600;
  // The signature itself is valid; only the age disqualifies it. Without this
  // check a captured request could be resent forever.
  assert.equal(verifyWebhookSignature(body, header(body, old), SECRET, NOW), false);
  assert.equal(verifyWebhookSignature(body, header(body, T - 60), SECRET, NOW), true);
});

test("a timestamp from the future outside tolerance does not verify", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, header(body, T + 3600), SECRET, NOW), false);
});

test("malformed or absent signature headers fail closed", () => {
  const body = "{}";
  for (const head of [
    "",
    "garbage",
    "t=,v1=",
    `t=${T}`,
    `v1=${sign(body, T)}`,
    `t=notanumber,v1=${sign(body, T)}`,
  ]) {
    assert.equal(verifyWebhookSignature(body, head, SECRET, NOW), false, head);
  }
  assert.equal(verifyWebhookSignature(body, null, SECRET, NOW), false);
});

test("an empty secret can never verify anything", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, header(body, T), "", NOW), false);
});

test("a header carrying several v1 signatures verifies if any one matches", () => {
  // Stripe sends multiple v1 entries while an endpoint secret is being rotated.
  const body = "{}";
  const head = `t=${T},v1=${sign(body, T, "whsec_old")},v1=${sign(body, T)}`;
  assert.equal(verifyWebhookSignature(body, head, SECRET, NOW), true);
  assert.deepEqual(parseSignatureHeader(head)?.signatures.length, 2);
});

test("form encoding flattens nested objects and arrays the way the API expects", () => {
  assert.equal(
    formEncode({ mode: "subscription", client_reference_id: "u_1" }),
    "mode=subscription&client_reference_id=u_1",
  );
  assert.equal(
    formEncode({ line_items: [{ price: "price_1", quantity: 1 }] }),
    "line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1",
  );
  assert.equal(
    formEncode({ metadata: { user_id: "u_1" } }),
    "metadata%5Buser_id%5D=u_1",
  );
});

test("form encoding drops null and undefined instead of sending the string", () => {
  // Sending customer=undefined creates a second customer record for a player
  // who already has one, which then silently splits their billing history.
  assert.equal(
    formEncode({ customer: null, customer_email: undefined, mode: "subscription" }),
    "mode=subscription",
  );
});

test("form encoding escapes values that would otherwise break the body", () => {
  assert.equal(
    formEncode({ success_url: "https://vollyio.com/settings?checkout=done&x=1" }),
    "success_url=https%3A%2F%2Fvollyio.com%2Fsettings%3Fcheckout%3Ddone%26x%3D1",
  );
  assert.equal(formEncode({ name: "a b+c" }), "name=a%20b%2Bc");
});
