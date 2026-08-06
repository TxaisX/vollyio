import test from "node:test";
import assert from "node:assert/strict";
import {
  META_EVENTS,
  buildCapiEvent,
  metaEventId,
  readMetaCookies,
} from "./events.ts";

// Built through the real helper rather than a hand-written string, so the
// fixture cannot pass an id the production path would never produce.
const BASE = {
  event: META_EVENTS.SIGNUP,
  eventId: metaEventId(META_EVENTS.SIGNUP, "acct-1"),
  eventTimeS: 1_754_200_000,
  cookies: { fbp: "fb.1.123.456" },
} as const;

test("an event with no identifier at all is dropped, not sent empty", () => {
  assert.equal(buildCapiEvent({ ...BASE, cookies: {} }), null);
  assert.equal(
    buildCapiEvent({ ...BASE, cookies: { fbp: null, fbc: null } }),
    null,
  );
});

test("any single identifier is enough to carry the event", () => {
  assert.ok(buildCapiEvent({ ...BASE, cookies: { fbc: "fb.1.1.abc" } }));
  assert.ok(buildCapiEvent({ ...BASE, cookies: {}, clientIp: "203.0.113.4" }));
  assert.ok(buildCapiEvent({ ...BASE, cookies: {}, userAgent: "Mozilla/5.0" }));
});

test("NO personal data can reach the payload, whatever the caller passes", () => {
  const event = buildCapiEvent({
    ...BASE,
    clientIp: "203.0.113.4",
    userAgent: "Mozilla/5.0",
    // Fields a future caller might reasonably think are supported. The builder
    // takes no such inputs, so they cannot appear on the wire; this pins that.
    ...({ email: "kid@example.com", userId: "acct-1", name: "A Player" } as object),
  } as Parameters<typeof buildCapiEvent>[0]);
  const wire = JSON.stringify(event);
  for (const forbidden of ["kid@example.com", "acct-1", "A Player", "em", "ph"]) {
    if (forbidden === "em" || forbidden === "ph") {
      assert.equal(
        Object.keys(event!.user_data).includes(forbidden),
        false,
        `user_data must not carry the ${forbidden} hash field`,
      );
      continue;
    }
    assert.equal(wire.includes(forbidden), false, `${forbidden} leaked`);
  }
  assert.deepEqual(Object.keys(event!.user_data).sort(), [
    "client_ip_address",
    "client_user_agent",
    "fbp",
  ]);
});

test("value rides on the subscription event and nothing else", () => {
  const lead = buildCapiEvent({ ...BASE, valueUsd: 9.99 });
  assert.equal(lead?.custom_data, undefined, "a free signup has no revenue");

  const sub = buildCapiEvent({
    ...BASE,
    event: META_EVENTS.SUBSCRIBED,
    valueUsd: 9.99,
  });
  assert.deepEqual(sub?.custom_data, { value: 9.99, currency: "USD" });
});

test("a nonsense value is dropped rather than reported as revenue", () => {
  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const sub = buildCapiEvent({
      ...BASE,
      event: META_EVENTS.SUBSCRIBED,
      valueUsd: bad,
    });
    assert.equal(sub?.custom_data, undefined, `${bad} must not become revenue`);
  }
});

test("event_time is whole seconds, never fractional", () => {
  const event = buildCapiEvent({ ...BASE, eventTimeS: 1_754_200_000.87 });
  assert.equal(event?.event_time, 1_754_200_000);
  assert.equal(Number.isInteger(event?.event_time), true);
});

test("both halves of one conversion derive the same id without talking", () => {
  assert.equal(
    metaEventId(META_EVENTS.SIGNUP, "acct-1"),
    metaEventId(META_EVENTS.SIGNUP, "acct-1"),
  );
  assert.notEqual(
    metaEventId(META_EVENTS.SIGNUP, "acct-1"),
    metaEventId(META_EVENTS.ACTIVATED, "acct-1"),
    "two different moments must not collapse into one conversion",
  );
  assert.notEqual(
    metaEventId(META_EVENTS.SIGNUP, "acct-1"),
    metaEventId(META_EVENTS.SIGNUP, "acct-2"),
    "two accounts must not collapse into one conversion",
  );
});

test("the shared id does not carry the raw subject id onto the wire", () => {
  // The regression this pins: `${event}.${subjectId}` deduplicated correctly
  // and still leaked a stable per-account token to the ad network.
  const id = metaEventId(META_EVENTS.SIGNUP, "8f14e45f-ea1a-4c2b-9f3d-000000000001");
  assert.equal(id.includes("8f14e45f"), false);
  assert.equal(id.includes("-"), false, "no fragment of a UUID survives");
  assert.ok(id.startsWith("Lead."), "the event name stays readable for debugging");
});

test("cookie parsing survives the shapes a real Cookie header arrives in", () => {
  assert.deepEqual(readMetaCookies("_fbp=fb.1.1.a; _fbc=fb.1.1.b"), {
    fbp: "fb.1.1.a",
    fbc: "fb.1.1.b",
  });
  // Padding, unrelated cookies, and a value containing '=' all appear live.
  assert.deepEqual(
    readMetaCookies("sb-access-token=x==; _fbp=fb.1.1.a ;other=1"),
    { fbp: "fb.1.1.a" },
  );
  assert.deepEqual(readMetaCookies(""), {});
  assert.deepEqual(readMetaCookies(null), {});
  assert.deepEqual(readMetaCookies("_fbp="), {}, "an empty value is not an id");
});

test("the optimization target is the activation event, not the signup", () => {
  // Pinned because it is the expensive mistake: every SIGNUP costs
  // SIGNUP_GRANT analyses of real money whether or not the account ever
  // uploads a clip, so delivery must be aimed at the event that follows one.
  assert.equal(META_EVENTS.ACTIVATED, "CompleteRegistration");
  assert.notEqual(META_EVENTS.ACTIVATED, META_EVENTS.SIGNUP);
});
