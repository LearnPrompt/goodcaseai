import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHumanReviewPlan,
  normalizeReviewItems,
} from "./human-review-mapping.mjs";

function candidate(id, overrides = {}) {
  return {
    id,
    status: "pending",
    source_url: "https://x.com/example/status/123",
    ...overrides,
  };
}

test("human review mapping normalizes array and object label files", () => {
  assert.deepEqual(
    normalizeReviewItems("image-v1", [
      {
        code: "D01",
        id: "1",
        title: "One",
        decision: "approve",
        source_url: "https://example.com/1",
      },
    ])[0],
    {
      reviewKey: "image-v1",
      code: "D01",
      id: "1",
      title: "One",
      decision: "approve",
      sourceUrl: "https://example.com/1",
    }
  );
  assert.equal(
    normalizeReviewItems("web-v1", {
      items: [{ id: "2", human_decision: "reject" }],
    })[0].decision,
    "reject"
  );
});

test("human review mapping requires UUID labels to match the same source URL", () => {
  const id = "a6d67d84-6bb4-4ca1-8e3c-6a48bbb4bc23";
  const labels = [
    {
      reviewKey: "image-v1",
      code: "D01",
      id,
      decision: "approve",
      sourceUrl: "https://x.com/i/status/999",
    },
  ];
  const plan = buildHumanReviewPlan(labels, [
    candidate(id, { source_url: "https://x.com/i/status/123" }),
  ]);

  assert.equal(plan.approve.length, 0);
  assert.equal(plan.unmatched[0].reason, "candidate_id_source_url_mismatch");
});

test("human review mapping canonicalizes X source URLs for non-UUID labels", () => {
  const labels = [
    {
      reviewKey: "web-v1",
      code: "W01",
      id: "x-123",
      decision: "approve",
      sourceUrl: "https://x.com/creator/status/123",
    },
  ];
  const plan = buildHumanReviewPlan(labels, [
    candidate("candidate-1", { source_url: "https://x.com/i/status/123" }),
  ]);

  assert.equal(plan.approve.length, 1);
  assert.equal(plan.approve[0].matchKind, "source_url");
});

test("human review mapping leaves uncertain labels pending", () => {
  const id = "a6d67d84-6bb4-4ca1-8e3c-6a48bbb4bc23";
  const plan = buildHumanReviewPlan(
    [
      {
        reviewKey: "image-v1",
        code: "D01",
        id,
        decision: "borderline",
        sourceUrl: "https://x.com/i/status/123",
      },
    ],
    [candidate(id)]
  );

  assert.equal(plan.hold.length, 1);
  assert.equal(plan.approve.length, 0);
  assert.equal(plan.reject.length, 0);
});

test("human review mapping is idempotent and fails closed on status conflicts", () => {
  const approveId = "a6d67d84-6bb4-4ca1-8e3c-6a48bbb4bc23";
  const rejectId = "10a4d901-824b-422b-9a02-2dfbf954fe29";
  const plan = buildHumanReviewPlan(
    [
      {
        reviewKey: "image-v1",
        code: "D01",
        id: approveId,
        decision: "approve",
        sourceUrl: "https://x.com/i/status/123",
      },
      {
        reviewKey: "image-v1",
        code: "D02",
        id: rejectId,
        decision: "reject",
        sourceUrl: "https://x.com/i/status/456",
      },
    ],
    [
      candidate(approveId, { status: "approved" }),
      candidate(rejectId, {
        status: "approved",
        source_url: "https://x.com/i/status/456",
      }),
    ]
  );

  assert.equal(plan.alreadyApplied.length, 1);
  assert.equal(plan.conflicts[0].reason, "reject_label_conflicts_with_approved");
});
