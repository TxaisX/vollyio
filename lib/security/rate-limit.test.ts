import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeApiQuota } from "./rate-limit.ts";

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
