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
