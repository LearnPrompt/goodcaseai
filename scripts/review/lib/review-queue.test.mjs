import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendationReviewPlan,
  buildDailyReviewQueue,
  filterCandidatesByIds,
  reviewReadinessIssues,
  sourceInteractionCount,
} from "./review-queue.mjs";

function candidate(overrides = {}) {
  return {
    id: "candidate-1",
    status: "pending",
    evidence_level: "L1",
    title: "完整的 AI 图像 Case",
    creator_name: "Creator A",
    summary: "可直接判断结果和用途的摘要。",
    prompt_full: "Create the documented result with these constraints.",
    prompt_preview: null,
    source_url: "https://x.com/example/status/1",
    media_url: "https://example.com/result.jpg",
    source_like_count: 10,
    source_comment_count: 2,
    source_share_count: 1,
    source_save_count: null,
    source_metrics_captured_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

test("interaction count uses the cross-platform raw sum", () => {
  assert.equal(sourceInteractionCount(candidate()), 13);
});

test("readiness rejects missing provenance, media and prompt", () => {
  const issues = reviewReadinessIssues(
    candidate({
      source_url: "",
      media_url: null,
      prompt_full: "",
      prompt_preview: "",
    })
  );

  assert.deepEqual(issues, ["prompt", "source_url", "media_url"]);
});

test("daily queue prioritizes interaction while excluding incomplete rows", () => {
  const queue = buildDailyReviewQueue(
    [
      candidate({ id: "low", source_like_count: 10 }),
      candidate({ id: "high", creator_name: "Creator B", source_like_count: 500 }),
      candidate({
        id: "incomplete",
        creator_name: "Creator C",
        source_like_count: 1_000,
        source_url: null,
      }),
    ],
    { limit: 2 }
  );

  assert.deepEqual(
    queue.rows.map((item) => item.id),
    ["high", "low"]
  );
  assert.equal(queue.totalExcluded, 1);
});

test("daily queue caps repeated creators", () => {
  const queue = buildDailyReviewQueue(
    [
      candidate({ id: "a-1", source_like_count: 500 }),
      candidate({
        id: "a-2",
        source_url: "https://x.com/example/status/2",
        source_like_count: 400,
      }),
      candidate({
        id: "b-1",
        creator_name: "Creator B",
        source_url: "https://x.com/example/status/3",
        source_like_count: 300,
      }),
    ],
    { limit: 3, maxPerCreator: 1 }
  );

  assert.deepEqual(
    queue.rows.map((item) => item.id),
    ["a-1", "b-1"]
  );
});

test("candidate id filter keeps the requested review subset", () => {
  const rows = [
    candidate({ id: "a" }),
    candidate({ id: "b" }),
    candidate({ id: "c" }),
  ];

  assert.deepEqual(
    filterCandidatesByIds(rows, ["c", "a"]).map((item) => item.id),
    ["a", "c"]
  );
  assert.equal(filterCandidatesByIds(rows).length, 3);
});

test("recommendation review plan maps decisions and respects group order", () => {
  const plan = buildRecommendationReviewPlan(
    [
      { id: "reject-1", recommendation: "pre_reject", rule: "generic_portrait" },
      { id: "border-1", recommendation: "borderline", rule: "needs_visual_check" },
      { id: "approve-1", recommendation: "review_first", rule: "reusable_template" },
    ],
    ["borderline", "pre_reject"]
  );

  assert.deepEqual(plan, [
    {
      id: "border-1",
      recommendation: "borderline",
      recommended_decision: "borderline",
      rule: "needs_visual_check",
    },
    {
      id: "reject-1",
      recommendation: "pre_reject",
      recommended_decision: "reject",
      rule: "generic_portrait",
    },
  ]);
});

test("recommendation review plan rejects duplicate ids", () => {
  assert.throws(
    () =>
      buildRecommendationReviewPlan([
        { id: "same", recommendation: "pre_reject" },
        { id: "same", recommendation: "borderline" },
      ]),
    /id 重复/
  );
});
