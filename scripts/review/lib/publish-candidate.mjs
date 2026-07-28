export function buildCasePayload(candidate) {
  return {
    source_candidate_id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
    category: candidate.category,
    source_platform: candidate.source_platform,
    source_url: candidate.source_url,
    source_like_count: candidate.source_like_count,
    source_comment_count: candidate.source_comment_count,
    source_share_count: candidate.source_share_count,
    source_save_count: candidate.source_save_count,
    source_published_at: candidate.source_published_at,
    source_metrics_captured_at: candidate.source_metrics_captured_at,
    creator_name: candidate.creator_name,
    creator_avatar_url: candidate.creator_avatar_url || null,
    summary: candidate.summary,
    prompt_preview: candidate.prompt_preview,
    prompt_full: candidate.prompt_full,
    content_locale: candidate.content_locale || "zh-CN",
    translations: candidate.translations || {},
    translation_status: candidate.translation_status || "untranslated",
    media_kind: candidate.media_kind,
    media_url: candidate.media_url,
    poster_url: candidate.poster_url,
    remake_count: candidate.remake_count,
    stability_score: candidate.stability_score,
    favorite_score: candidate.favorite_score,
    recommended_models: candidate.recommended_models || [],
    cost_band: candidate.cost_band,
    evidence_level: candidate.evidence_level || "L0",
    tags: candidate.tags || [],
    is_published: true,
  };
}

export function decidePublish({
  candidateId,
  existingByCandidate,
  existingBySlug,
  allowUpdate,
}) {
  if (existingByCandidate) {
    return {
      action: "resume",
      caseId: existingByCandidate.id,
    };
  }

  if (!existingBySlug) {
    return {
      action: "insert",
      caseId: null,
    };
  }

  if (!allowUpdate) {
    return {
      action: "conflict",
      caseId: existingBySlug.id,
      reason: "同 slug Case 已存在；默认不会覆盖",
    };
  }

  if (
    existingBySlug.source_candidate_id &&
    existingBySlug.source_candidate_id !== candidateId
  ) {
    return {
      action: "conflict",
      caseId: existingBySlug.id,
      reason: "同 slug Case 已绑定其他候选，禁止改绑",
    };
  }

  return {
    action: "update",
    caseId: existingBySlug.id,
  };
}

export function validatePublishCandidate(candidate) {
  const errors = [];
  if (candidate.status !== "approved") {
    errors.push(`只有 approved 候选可发布，当前状态=${candidate.status || "unknown"}`);
  }
  if (!["L1", "L2"].includes(candidate.evidence_level)) {
    errors.push("发布必须是 L1 或 L2 证据");
  }
  if (candidate.translation_status !== "confirmed") {
    errors.push("发布前必须人工确认双语内容");
  }
  try {
    const source = new URL(candidate.source_url);
    if (source.protocol !== "http:" && source.protocol !== "https:") {
      errors.push("原始来源必须是 http(s) URL");
    }
  } catch {
    errors.push("缺少有效原始来源");
  }
  if (
    typeof candidate.media_url !== "string" ||
    !candidate.media_url.trim() ||
    candidate.media_url === "/media/placeholder.png"
  ) {
    errors.push("缺少真实媒体");
  }
  if (
    typeof candidate.summary !== "string" ||
    candidate.summary.trim().length < 12
  ) {
    errors.push("摘要不足");
  }
  if (
    !(
      typeof candidate.prompt_full === "string" &&
      candidate.prompt_full.trim().length >= 12
    ) &&
    !(
      typeof candidate.prompt_preview === "string" &&
      candidate.prompt_preview.trim().length >= 12
    )
  ) {
    errors.push("缺少公开 Prompt 或可复现方法");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
