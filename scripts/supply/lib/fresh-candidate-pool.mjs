import { canonicalizeUrl } from "./canonical.mjs";

export function selectFreshCandidatePool(
  groups,
  { existingUrls = [], category = "", limit = 70 } = {}
) {
  if (!Array.isArray(groups) || !Array.isArray(existingUrls)) {
    throw new Error("groups 和 existingUrls 必须是数组。");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit 必须是正整数。");
  }

  const seen = new Set(existingUrls.map(canonicalizeUrl).filter(Boolean));
  const items = [];
  const byInput = {};
  let invalidUrls = 0;
  let existingOrLocalDuplicates = 0;

  for (const group of groups) {
    if (!group?.label || !Array.isArray(group.items)) {
      throw new Error("每个 group 必须包含 label 和 items。");
    }
    byInput[group.label] = 0;
    for (const item of group.items) {
      if (category && item.category !== category) continue;
      const sourceUrl = canonicalizeUrl(item.source_url);
      if (!sourceUrl) {
        invalidUrls += 1;
        continue;
      }
      if (seen.has(sourceUrl)) {
        existingOrLocalDuplicates += 1;
        continue;
      }
      seen.add(sourceUrl);
      items.push({ ...item, source_url: sourceUrl });
      byInput[group.label] += 1;
      if (items.length >= limit) {
        return {
          items,
          stats: {
            selected: items.length,
            byInput,
            invalidUrls,
            existingOrLocalDuplicates,
          },
        };
      }
    }
  }

  return {
    items,
    stats: {
      selected: items.length,
      byInput,
      invalidUrls,
      existingOrLocalDuplicates,
    },
  };
}

export function candidateToSourceReviewItem(candidate, index) {
  const promptText = String(
    candidate.prompt_full || candidate.prompt_preview || ""
  ).trim();
  const mediaUrl = String(candidate.media_url || "").trim();
  const creator = String(candidate.creator_name || "").trim();
  const sourceUrl = String(candidate.source_url || "").trim();
  const checks = {
    source: Boolean(sourceUrl),
    author: Boolean(creator),
    result: Boolean(mediaUrl),
    method: Boolean(promptText || candidate.summary),
    prompt: Boolean(promptText),
    license: false,
  };
  return {
    id: candidate.id || `fresh-${index + 1}`,
    sourceId: "youmind",
    sourceLabel: "YouMind Prompt Library",
    sourceUrl,
    title: candidate.title,
    creator,
    creatorUrl: "",
    mediaUrl,
    posterUrl: candidate.poster_url || "",
    mediaKind: candidate.media_kind || "image",
    promptText,
    method: candidate.summary || "",
    model: (candidate.recommended_models || []).join(" · "),
    license: "原始来源与生成模型许可待人工复核",
    notes: "数据库未出现的新来源；GoodCase 尚未复跑。",
    metrics: {
      likes: candidate.source_like_count ?? null,
      comments: candidate.source_comment_count ?? null,
      reposts: candidate.source_share_count ?? null,
      bookmarks: candidate.source_save_count ?? null,
    },
    checks,
    completeness:
      Object.values(checks).filter(Boolean).length / Object.keys(checks).length,
    candidateType:
      checks.source &&
      checks.author &&
      checks.result &&
      checks.method &&
      checks.prompt
        ? "case"
        : "topic_seed",
  };
}
