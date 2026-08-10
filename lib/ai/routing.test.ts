import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRIVATE_ROUTING, withPrivateRouting } from "./routing.ts";

// WHERE OUR USERS' FOOTAGE IS ALLOWED TO GO.
//
// OpenRouter's `data_collection` defaults to "allow", which permits routing to
// upstreams that retain prompts non-transiently and may train on them. What
// this app sends is video of a person playing a sport, and the declared Play
// audience starts at 13, so the default meant a minor's footage of themselves
// could land on an endpoint that keeps it, decided by routing luck.
//
// A regression here is SILENT: every request still succeeds, the reads are
// unchanged, and nothing in the product looks different. Only these tests fail.

test("the routing floor denies data-collecting providers", () => {
  assert.equal(PRIVATE_ROUTING.data_collection, "deny");
});

test("a pinned upstream keeps its pin AND the floor", () => {
  // The video path pins Vertex because AI Studio takes YouTube links only while
  // Vertex takes base64 data URLs. That pin must not silently replace the
  // privacy setting, which is exactly what a hand-written spread would do.
  const merged = withPrivateRouting({ only: ["google-vertex"] });
  assert.equal(merged.provider.data_collection, "deny");
  assert.deepEqual(merged.provider.only, ["google-vertex"]);

  // And with no preferences at all, the floor still applies.
  assert.equal(withPrivateRouting().provider.data_collection, "deny");
});

test("every model call site sends the floor", async () => {
  // Three bodies reach a provider: the vision read, the streaming coach, and
  // the JSON coach. Adding a fourth without the floor is the regression this
  // catches.
  for (const file of ["vision.ts", "chat.ts"]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    const bodies = src.split("JSON.stringify({").slice(1);
    assert.ok(bodies.length > 0, `${file} has no request body`);
    for (const body of bodies) {
      const head = body.slice(0, 600);
      assert.match(
        head,
        /withPrivateRouting\(/,
        `a request body in ${file} does not set the routing floor`,
      );
    }
  }
});

test("the privacy policy describes what is actually sent", async () => {
  const policy = await readFile(
    new URL("../../app/(legal)/privacy/page.tsx", import.meta.url),
    "utf8",
  );
  // The policy said "still frames from your clip are sent" long after the video
  // path started sending the WHOLE clip. Play cross-checks the policy against
  // the Data safety declaration, so a stale sentence here is a contradiction on
  // the face of the submission, not just bad copy.
  assert.doesNotMatch(policy, /still frames from your clip are sent/);
  assert.match(policy, /the whole clip is sent/);
});
