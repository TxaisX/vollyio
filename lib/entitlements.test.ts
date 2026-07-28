import { test } from "node:test";
import assert from "node:assert/strict";
import {
  releaseAnalysisEntitlement,
  reserveAnalysisEntitlement,
} from "./entitlements.ts";

test("billing-disabled analysis still reserves an opaque cleanup token", async () => {
  const reservationId = "9cecf88f-a582-47bf-a76c-e2514a2977c5";
  let args: unknown;
  const client = {
    rpc: async (_name: string, value: unknown) => {
      args = value;
      return {
        data: { allowed: true, reason: null, reservation_id: reservationId },
        error: null,
      };
    },
  };

  assert.deepEqual(await reserveAnalysisEntitlement(client, false), {
    ok: true,
    allowed: true,
    reservationId,
  });
  assert.deepEqual(args, { p_enforce_free: false });
});

test("entitlement reservation fails closed on RPC errors or malformed data", async () => {
  const failed = { rpc: async () => ({ data: null, error: new Error("offline") }) };
  const malformed = { rpc: async () => ({ data: { allowed: true }, error: null }) };

  assert.deepEqual(await reserveAnalysisEntitlement(failed, true), {
    ok: false,
    allowed: false,
  });
  assert.deepEqual(await reserveAnalysisEntitlement(malformed, true), {
    ok: false,
    allowed: false,
  });

  const throwing = {
    rpc: async (): Promise<never> => {
      throw new Error("network unavailable");
    },
  };
  assert.deepEqual(await reserveAnalysisEntitlement(throwing, true), {
    ok: false,
    allowed: false,
  });
});

test("entitlement reservation returns atomic denial and reservation states", async () => {
  const reservationId = "9cecf88f-a582-47bf-a76c-e2514a2977c5";
  const allowed = {
    rpc: async () => ({
      data: { allowed: true, reason: null, reservation_id: reservationId },
      error: null,
    }),
  };
  const denied = {
    rpc: async () => ({
      data: { allowed: false, reason: "in_progress", reservation_id: null },
      error: null,
    }),
  };

  assert.deepEqual(await reserveAnalysisEntitlement(allowed, true), {
    ok: true,
    allowed: true,
    reservationId,
  });
  assert.deepEqual(await reserveAnalysisEntitlement(denied, true), {
    ok: true,
    allowed: false,
    reason: "in_progress",
  });
});

test("an exhausted month carries the numbers the upsell needs", async () => {
  const client = {
    rpc: async () => ({
      data: {
        allowed: false,
        reason: "month_exhausted",
        reservation_id: null,
        plan: "free",
        allowance: 3,
        used: 3,
        resets_at: "2026-08-01T00:00:00+00:00",
      },
      error: null,
    }),
  };

  assert.deepEqual(await reserveAnalysisEntitlement(client, true), {
    ok: true,
    allowed: false,
    reason: "month_exhausted",
    detail: {
      plan: "free",
      allowance: 3,
      used: 3,
      resetsAt: "2026-08-01T00:00:00+00:00",
    },
  });
});

test("an exhausted month without usable numbers still denies cleanly", async () => {
  // A reply missing the detail fields must deny, not crash and not allow. The
  // client can still say "you're out" without being able to say "of 3".
  const partial = {
    rpc: async () => ({
      data: { allowed: false, reason: "month_exhausted", reservation_id: null },
      error: null,
    }),
  };
  assert.deepEqual(await reserveAnalysisEntitlement(partial, true), {
    ok: true,
    allowed: false,
    reason: "month_exhausted",
    detail: null,
  });
});

test("the superseded lifetime-one reason still denies during a deploy window", async () => {
  // Migration 026 replaces 'used' with 'month_exhausted'. If code lands before
  // the migration does, the old reason must still read as exhausted rather than
  // as a malformed reply, or a free player gets a 503 instead of an upsell.
  const legacy = {
    rpc: async () => ({
      data: { allowed: false, reason: "used", reservation_id: null },
      error: null,
    }),
  };
  assert.deepEqual(await reserveAnalysisEntitlement(legacy, true), {
    ok: true,
    allowed: false,
    reason: "month_exhausted",
    detail: null,
  });
});

test("entitlement release is scoped to its opaque reservation", async () => {
  let args: unknown;
  const client = {
    rpc: async (_name: string, value: unknown) => {
      args = value;
      return { data: null, error: null };
    },
  };
  const reservationId = "9cecf88f-a582-47bf-a76c-e2514a2977c5";

  assert.equal(await releaseAnalysisEntitlement(client, reservationId), true);
  assert.deepEqual(args, { p_reservation_id: reservationId });
});
