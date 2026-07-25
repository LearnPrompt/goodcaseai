import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCasePayload,
  decidePublish,
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
    summary: "Summary",
    prompt_preview: "Preview",
    prompt_full: "Full",
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
  assert.equal(payload.evidence_level, "L2");
  assert.equal(payload.source_like_count, 100);
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
