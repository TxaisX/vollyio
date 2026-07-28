import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeApiQuota, refundApiQuota } from "./rate-limit.ts";

test("consumeApiQuota returns allowed only for a successful true RPC", async () => {
  const allowedClient = {
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, "consume_api_quota");
      assert.deepEqual(args, { p_scope: "analyze" });
      return { data: true, error: null };
    },
  };
  assert.deepEqual(await consumeApiQuota(allowedClient, "analyze"), {
    ok: true,
    allowed: true,
  });

  const limitedClient = {
    rpc: async () => ({ data: false, error: null }),
  };
  assert.deepEqual(await consumeApiQuota(limitedClient, "coach"), {
    ok: true,
    allowed: false,
  });
});

test("the daily coach scope rides the same RPC contract", async () => {
  const client = {
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, "consume_api_quota");
      assert.deepEqual(args, { p_scope: "coach_daily" });
      return { data: false, error: null };
    },
  };
  assert.deepEqual(await consumeApiQuota(client, "coach_daily"), {
    ok: true,
    allowed: false,
  });
});

test("consumeApiQuota fails closed when quota storage is unavailable", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "missing function" } }),
  };
  assert.deepEqual(await consumeApiQuota(client, "coach"), {
    ok: false,
    allowed: false,
  });

  const throwingClient = {
    rpc: async (): Promise<never> => {
      throw new Error("network unavailable");
    },
  };
  assert.deepEqual(await consumeApiQuota(throwingClient, "analyze"), {
    ok: false,
    allowed: false,
  });
});

test("refundApiQuota gives back one unit of the named scope's window", async () => {
  let name: string | undefined;
  let args: unknown;
  const client = {
    rpc: async (rpcName: string, value: unknown) => {
      name = rpcName;
      args = value;
      return { data: null, error: null };
    },
  };
  const userId = "9cecf88f-a582-47bf-a76c-e2514a2977c5";
  assert.equal(await refundApiQuota(client, userId, "analyze"), true);
  assert.equal(name, "refund_api_quota");
  // The subject is passed explicitly because this runs as the SERVICE ROLE,
  // where auth.uid() is null. That is the point: the boundary is the role, not
  // a value a player could obtain and replay (migration 033).
  assert.deepEqual(args, { p_user_id: userId, p_scope: "analyze" });
});

test("refundApiQuota reports failure without throwing (refund is best-effort)", async () => {
  const failing = {
    rpc: async () => ({ data: null, error: { message: "missing function" } }),
  };
  assert.equal(await refundApiQuota(failing, "u-1", "analyze"), false);

  const throwing = {
    rpc: async (): Promise<never> => {
      throw new Error("network unavailable");
    },
  };
  assert.equal(await refundApiQuota(throwing, "u-1", "analyze"), false);

  // No service client at all, which is every deploy without the service key.
  // The slot is not returned, nothing is granted, and nothing throws.
  assert.equal(await refundApiQuota(null, "u-1", "analyze"), false);
});
