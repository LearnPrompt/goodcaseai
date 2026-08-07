import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCasePayload,
  decidePublish,
  shouldTriggerDeploy,
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

test("buildCasePayload 按 Prompt 正文判定语言，不再无条件默认 zh-CN", () => {
  const english = buildCasePayload({
    prompt_full:
      "A cinematic wide shot of a lone astronaut on a red dune, shot on 35mm film.",
  });
  assert.equal(english.content_locale, "en");

  const chinese = buildCasePayload({
    prompt_full: "电影感广角镜头，一名宇航员独自穿越红色沙丘，35mm 胶片质感。",
  });
  assert.equal(chinese.content_locale, "zh-CN");

  const previewOnly = buildCasePayload({
    prompt_full: null,
    prompt_preview: "生成一张赛博朋克风格的城市夜景海报。",
  });
  assert.equal(previewOnly.content_locale, "zh-CN");
});

test("buildCasePayload 尊重候选显式声明的 content_locale", () => {
  const payload = buildCasePayload({
    content_locale: "zh-CN",
    prompt_full: "A reproducible English prompt with enough detail to publish.",
  });
  assert.equal(payload.content_locale, "zh-CN");
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

test("a resumed publish still triggers the deploy hook", () => {
  // insert 成功但候选状态更新失败的那次会抛错退出，压根走不到部署这步；
  // 重跑走 resume 补齐数据，这里再不算它，详情页就永远停在 404。
  assert.equal(
    shouldTriggerDeploy({ inserted: 0, updated: 0, resumed: 1 }),
    true
  );
  assert.equal(shouldTriggerDeploy({ inserted: 1, updated: 0, resumed: 0 }), true);
  assert.equal(shouldTriggerDeploy({ inserted: 0, updated: 2, resumed: 0 }), true);
  // 整批都被重复治理拦下时没有任何新内容上线，不该白跑一次部署。
  assert.equal(
    shouldTriggerDeploy({ inserted: 0, updated: 0, resumed: 0, duplicateBlocked: 3 }),
    false
  );
  assert.equal(shouldTriggerDeploy({}), false);
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
