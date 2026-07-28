import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHumanReviewPlan,
  normalizeReviewItems,
  resolveSupersededReviewLabels,
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

test("human review mapping expands report-index decision groups", () => {
  assert.deepEqual(
    normalizeReviewItems(
      "video-v1",
      {
        decisions_by_report_index: {
          approve: [2],
          reject: [1],
          topic_seed: [],
        },
      },
      {
        sourceItems: [
          {
            id: "video-1",
            title: "One",
            sourceUrl: "https://x.com/i/status/1",
          },
          {
            id: "video-2",
            title: "Two",
            sourceUrl: "https://x.com/i/status/2",
          },
        ],
      }
    ),
    [
      {
        reviewKey: "video-v1",
        code: "#2",
        id: "video-2",
        title: "Two",
        sourceUrl: "https://x.com/i/status/2",
        decision: "approve",
      },
      {
        reviewKey: "video-v1",
        code: "#1",
        id: "video-1",
        title: "One",
        sourceUrl: "https://x.com/i/status/1",
        decision: "reject",
      },
    ]
  );
});

test("human review mapping rejects invalid or duplicate report indexes", () => {
  assert.throws(
    () =>
      normalizeReviewItems(
        "video-v1",
        { decisions_by_report_index: { approve: [2] } },
        { sourceItems: [{ id: "video-1" }] }
      ),
    /无效报告编号/
  );
  assert.throws(
    () =>
      normalizeReviewItems(
        "video-v1",
        {
          decisions_by_report_index: {
            approve: [1],
            reject: [1],
          },
        },
        { sourceItems: [{ id: "video-1" }] }
      ),
    /重复报告编号/
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

test("human review mapping only supersedes an exact prior label for the same UUID", () => {
  const id = "a6d67d84-6bb4-4ca1-8e3c-6a48bbb4bc23";
  const prior = {
    reviewKey: "image-v1",
    code: "D01",
    id,
    decision: "borderline",
    sourceUrl: "https://x.com/i/status/123",
  };
  const latest = {
    reviewKey: "image-v2",
    code: "D01",
    id,
    decision: "approve",
    sourceUrl: "https://x.com/i/status/123",
    supersedesReviewKey: "image-v1:D01",
  };

  assert.deepEqual(resolveSupersededReviewLabels([prior, latest]), [latest]);
  assert.throws(
    () =>
      resolveSupersededReviewLabels([
        prior,
        { ...latest, id: "10a4d901-824b-422b-9a02-2dfbf954fe29" },
      ]),
    /UUID 不一致/
  );
  assert.throws(
    () =>
      resolveSupersededReviewLabels([
        prior,
        { ...latest, supersedesReviewKey: "missing:D01" },
      ]),
    /不存在的旧审核/
  );
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
