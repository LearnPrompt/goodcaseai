import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewPatch,
  parseTags,
  validateReview,
} from "./review-candidate.mjs";

const validCandidate = {
  status: "pending",
  title: "一个真实可复现的 AI Case",
  source_url: "https://example.com/original",
  creator_name: "Case Author",
  summary: "这是一段足够说明作品结果与学习价值的案例摘要。",
  prompt_full: "Use the supplied reference and reproduce the documented result.",
  prompt_preview: null,
  media_url: "/media/example.mp4",
  evidence_level: "L1",
  tags: ["video"],
};

test("approve accepts a pending candidate with L1 evidence", () => {
  const result = validateReview(validCandidate, {
    action: "approve",
    note: "来源和方法已人工核对",
    evidenceLevel: "L1",
  });
  assert.equal(result.ok, true);
});

test("approve accepts a legitimate one-character creator name", () => {
  const result = validateReview(
    { ...validCandidate, creator_name: "K" },
    {
      action: "approve",
      note: "来源和方法已人工核对",
      evidenceLevel: "L1",
    }
  );

  assert.equal(result.ok, true);
});

test("approve rejects L0 and missing provenance", () => {
  const result = validateReview(
    {
      ...validCandidate,
      source_url: null,
      evidence_level: "L0",
    },
    {
      action: "approve",
      note: "准备批准",
      evidenceLevel: "L0",
    }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /source_url/);
  assert.match(result.errors.join("\n"), /L1 或 L2/);
});

test("approve requires a public prompt or reproducible method", () => {
  const result = validateReview(
    {
      ...validCandidate,
      prompt_full: "",
      prompt_preview: "",
    },
    {
      action: "approve",
      note: "来源已核对",
      evidenceLevel: "L1",
    }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Prompt/);
});

test("approve rejects placeholder media", () => {
  const result = validateReview(
    {
      ...validCandidate,
      media_url: "/media/placeholder.png",
    },
    {
      action: "approve",
      note: "来源已核对",
      evidenceLevel: "L1",
    }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /占位图/);
});

test("reject only requires a pending candidate and review note", () => {
  const result = validateReview(
    {
      status: "pending",
    },
    {
      action: "reject",
      note: "作者与原始来源无法确认",
    }
  );
  assert.equal(result.ok, true);
});

test("review cannot mutate an already published candidate", () => {
  const result = validateReview(
    {
      ...validCandidate,
      status: "published",
    },
    {
      action: "reject",
      note: "尝试回退",
    }
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /只有 pending/);
});

test("parseTags trims, deduplicates and removes empty values", () => {
  assert.deepEqual(parseTags("video, prompt,video, , evidence"), [
    "video",
    "prompt",
    "evidence",
  ]);
});

test("buildReviewPatch records an auditable approval", () => {
  const patch = buildReviewPatch(
    validCandidate,
    {
      action: "approve",
      note: "  核对完成  ",
      evidenceLevel: "L2",
      tags: ["verified"],
    },
    "2026-07-23T00:00:00.000Z"
  );
  assert.deepEqual(patch, {
    status: "approved",
    review_note: "核对完成",
    reviewed_at: "2026-07-23T00:00:00.000Z",
    updated_at: "2026-07-23T00:00:00.000Z",
    tags: ["verified"],
    evidence_level: "L2",
  });
});
