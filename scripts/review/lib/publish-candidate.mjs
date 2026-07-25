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
    summary: candidate.summary,
    prompt_preview: candidate.prompt_preview,
    prompt_full: candidate.prompt_full,
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
