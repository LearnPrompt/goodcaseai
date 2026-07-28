import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreatorAvatarPlan,
  extractXHandle,
  extractXTweetId,
  normalizeCreatorKey,
  normalizeXAvatarUrl,
} from "./creator-avatar-backfill.mjs";

test("extractXHandle accepts status URLs and rejects navigation URLs", () => {
  assert.equal(
    extractXHandle("https://x.com/example_ai/status/123"),
    "example_ai"
  );
  assert.equal(
    extractXHandle("https://twitter.com/Example/status/456?s=20"),
    "Example"
  );
  assert.equal(extractXHandle("https://x.com/i/status/123"), null);
  assert.equal(extractXHandle("https://example.com/user/status/123"), null);
  assert.equal(
    extractXTweetId("https://x.com/i/status/123456?s=20"),
    "123456"
  );
  assert.equal(
    extractXTweetId("https://twitter.com/Example/status/654321"),
    "654321"
  );
});

test("normalizeXAvatarUrl only accepts X profile images and requests 400px", () => {
  assert.equal(
    normalizeXAvatarUrl(
      "https://pbs.twimg.com/profile_images/1/avatar_normal.jpg"
    ),
    "https://pbs.twimg.com/profile_images/1/avatar_400x400.jpg"
  );
  assert.equal(
    normalizeXAvatarUrl("https://cdn.example.com/avatar_normal.jpg"),
    null
  );
});

test("creator avatar planning uses authoritative tweet ids", () => {
  const plan = buildCreatorAvatarPlan([
    {
      id: "1",
      creator_name: "@Example",
      source_url: "https://x.com/example/status/10001",
      creator_avatar_url: null,
    },
    {
      id: "2",
      creator_name: "Example",
      source_url: "https://x.com/i/status/10002",
      creator_avatar_url: null,
    },
    {
      id: "3",
      creator_name: "Conflict",
      source_url: "https://x.com/first/status/10003",
      creator_avatar_url: null,
    },
    {
      id: "4",
      creator_name: "Conflict",
      source_url: "https://x.com/second/status/10004",
      creator_avatar_url: null,
    },
    {
      id: "5",
      creator_name: "Covered",
      source_url: "https://x.com/covered/status/10005",
      creator_avatar_url:
        "https://pbs.twimg.com/profile_images/5/covered.jpg",
    },
  ]);

  assert.equal(normalizeCreatorKey("@Example"), "example");
  assert.deepEqual(plan.counts, {
    creators: 3,
    covered: 1,
    resolvable: 2,
    unresolvable: 0,
  });
  assert.equal(
    plan.groups.find((item) => item.creatorKey === "example")?.caseIds.length,
    2
  );
  assert.deepEqual(
    plan.groups.find((item) => item.creatorKey === "example")?.tweetIds,
    ["10001", "10002"]
  );
});
