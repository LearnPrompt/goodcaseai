import { resolveContentLocale } from "./content-locale.mjs";

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
    // 曾经无条件默认 zh-CN，导致大量英文 Prompt 被标成中文、前端触发无意义的机器翻译。
    content_locale: resolveContentLocale(candidate),
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

/**
 * 发布前的媒体一致性校验。
 *
 * 线上出现过两条：category 标成 video，media_kind 却是 image、media_url 是一张 jpg，
 * 用户点进标着 AI 视频的案例只看到静图。这类错配只能在入库这一层拦，
 * 前端无从判断作者到底想放什么。
 */
export function validateMediaConsistency(candidate) {
  const problems = [];
  const url = candidate.media_url || "";
  const looksLikeVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

  if (!url) {
    problems.push("缺少 media_url");
  }

  if (candidate.category === "video" && candidate.media_kind !== "video") {
    problems.push(
      `分类是 video 但 media_kind 是 ${candidate.media_kind || "空"}，详情页放不出视频`
    );
  }

  if (candidate.media_kind === "video" && url && !looksLikeVideo) {
    problems.push("media_kind 是 video 但 media_url 不是视频文件");
  }

  if (candidate.media_kind === "video" && !candidate.poster_url) {
    problems.push("视频缺少 poster_url，列表里会是黑块");
  }

  return problems;
}

export function decidePublish({
  candidateId,
  candidate,
  existingByCandidate,
  existingBySlug,
  allowUpdate,
}) {
  // 媒体错配一律拦在发布前，宁可漏发也不要发出点不开的视频案例。
  if (candidate) {
    const mediaProblems = validateMediaConsistency(candidate);
    if (mediaProblems.length) {
      return {
        action: "blocked",
        caseId: existingBySlug?.id || null,
        reason: `媒体不一致：${mediaProblems.join("；")}`,
      };
    }
  }

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

/**
 * 详情页是构建期全量预渲染的（dynamicParams=false），库里写完不部署就是 404。
 *
 * resume 必须算在内：insert 成功但候选状态更新失败时脚本会抛错退出，那一次
 * 根本走不到部署这步；重跑走 resume 把数据补齐，如果这里不算它，这条 Case
 * 就再也不会触发 Deploy Hook 了。下架后重新发布同样走 resume。
 */
export function shouldTriggerDeploy(counters = {}) {
  return (
    (counters.inserted || 0) +
      (counters.updated || 0) +
      (counters.resumed || 0) >
    0
  );
}
