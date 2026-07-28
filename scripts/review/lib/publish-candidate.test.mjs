import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCasePayload,
  decidePublish,
  validatePublishCandidate,
} from "./publish-candidate.mjs";

test("buildCasePayload carries the source candidate id and evidence", () => {
  const payload = buildCasePayload({
    id: "candidate-1",
    slug: "case-1",
    title: "Case 1",
    category: "video",
    source_platform: "x.com",
    source_url: "https://x.com/example/status/1",
    source_like_count: 100,
    source_comment_count: 10,
    source_share_count: 5,
    source_save_count: null,
    source_published_at: "2026-07-20T00:00:00.000Z",
    source_metrics_captured_at: "2026-07-21T00:00:00.000Z",
    creator_name: "Example",
    creator_avatar_url: "https://pbs.twimg.com/profile_images/1/example.jpg",
    summary: "Summary",
    prompt_preview: "Preview",
    prompt_full: "Full",
    content_locale: "en",
    translations: {
      "zh-CN": {
        title: "案例 1",
        summary: "摘要",
        promptFull: "完整提示语",
      },
    },
    translation_status: "confirmed",
    media_kind: "video",
    media_url: "/media/example.mp4",
    poster_url: "/media/example.jpg",
    remake_count: 2,
    stability_score: 80,
    favorite_score: 90,
    recommended_models: ["Model"],
    cost_band: "medium",
    evidence_level: "L2",
    tags: ["verified"],
  });

  assert.equal(payload.source_candidate_id, "candidate-1");
  assert.equal(
    payload.creator_avatar_url,
    "https://pbs.twimg.com/profile_images/1/example.jpg"
  );
  assert.equal(payload.evidence_level, "L2");
  assert.equal(payload.source_like_count, 100);
  assert.equal(payload.content_locale, "en");
  assert.equal(payload.translation_status, "confirmed");
  assert.equal(payload.translations["zh-CN"].title, "案例 1");
  assert.equal(payload.source_save_count, null);
  assert.equal(
    payload.source_metrics_captured_at,
    "2026-07-21T00:00:00.000Z"
  );
  assert.equal(payload.is_published, true);
});

test("publish inserts a new candidate when no case exists", () => {
  assert.deepEqual(
    decidePublish({
      candidateId: "candidate-1",
      existingByCandidate: null,
      existingBySlug: null,
      allowUpdate: false,
    }),
    {
      action: "insert",
      caseId: null,
    }
  );
});

test("publish resumes after case insert when candidate status update failed", () => {
  assert.deepEqual(
    decidePublish({
      candidateId: "candidate-1",
      existingByCandidate: { id: "case-1" },
      existingBySlug: { id: "case-1", source_candidate_id: "candidate-1" },
      allowUpdate: false,
    }),
    {
      action: "resume",
      caseId: "case-1",
    }
  );
});

test("publish refuses to overwrite an existing slug by default", () => {
  const result = decidePublish({
    candidateId: "candidate-1",
    existingByCandidate: null,
    existingBySlug: { id: "case-1", source_candidate_id: null },
    allowUpdate: false,
  });
  assert.equal(result.action, "conflict");
});

test("allow-update can update an unbound matching slug", () => {
  assert.deepEqual(
    decidePublish({
      candidateId: "candidate-1",
      existingByCandidate: null,
      existingBySlug: { id: "case-1", source_candidate_id: null },
      allowUpdate: true,
    }),
    {
      action: "update",
      caseId: "case-1",
    }
  );
});

test("allow-update cannot steal a case owned by another candidate", () => {
  const result = decidePublish({
    candidateId: "candidate-1",
    existingByCandidate: null,
    existingBySlug: { id: "case-1", source_candidate_id: "candidate-2" },
    allowUpdate: true,
  });
  assert.equal(result.action, "conflict");
  assert.match(result.reason, /禁止改绑/);
});

test("publishing requires approved, traceable, non-placeholder evidence", () => {
  const valid = {
    status: "approved",
    evidence_level: "L1",
    source_url: "https://example.com/original",
    media_url: "/media/example.mp4",
    summary: "这是一段足够说明价值的案例摘要。",
    prompt_full: "A reproducible prompt with enough detail.",
    prompt_preview: null,
    translation_status: "confirmed",
  };
  assert.equal(validatePublishCandidate(valid).ok, true);

  const invalid = validatePublishCandidate({
    ...valid,
    status: "pending",
    evidence_level: "L0",
    source_url: null,
    media_url: "/media/placeholder.png",
    translation_status: "untranslated",
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join("\n"), /approved/);
  assert.match(invalid.errors.join("\n"), /L1 或 L2/);
  assert.match(invalid.errors.join("\n"), /原始来源/);
  assert.match(invalid.errors.join("\n"), /真实媒体/);
  assert.match(invalid.errors.join("\n"), /双语内容/);
});
