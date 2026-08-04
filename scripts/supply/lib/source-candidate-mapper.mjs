import { resolveContentLocale } from "../../review/lib/content-locale.mjs";

function normalizeMetric(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function concise(value, maximum) {
  const normalized = sanitizeSourceText(value).replace(/\s+/g, " ").trim();
  return normalized.length > maximum
    ? `${normalized.slice(0, maximum - 1)}…`
    : normalized;
}

export function sanitizeSourceText(value) {
  return String(value ?? "")
    .replaceAll("&nbsp;", " ")
    .replace(
      /((?:微信|wechat|weixin|联系方式|联系作者|qq)\s*[:：]?\s*)[a-z0-9_+-]{5,}/gi,
      "$1[已省略]"
    )
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[已省略邮箱]"
    )
    .trim();
}

export function mapSourceSampleToCandidate(item) {
  const method = sanitizeSourceText(item.method);
  const prompt = sanitizeSourceText(item.promptText);
  const reproducibleText = prompt || method;
  const tags = [
    `source-${item.sourceId}`,
    prompt ? "prompt-public" : "workflow-method",
    "not-rerun",
  ];

  if (!item.checks?.license) {
    tags.push("license-review");
  }

  return {
    title: String(item.title ?? "").trim(),
    category: item.mediaKind === "video" ? "video" : "image",
    source_platform: String(item.sourceLabel ?? item.sourceId ?? "").trim(),
    source_url: String(item.sourceUrl ?? "").trim(),
    source_like_count: normalizeMetric(item.metrics?.likes),
    source_comment_count: normalizeMetric(item.metrics?.comments),
    source_share_count: normalizeMetric(
      item.metrics?.shares ?? item.metrics?.reposts
    ),
    source_save_count: normalizeMetric(
      item.metrics?.bookmarks ?? item.metrics?.saves
    ),
    creator_name: String(item.creator ?? "").trim(),
    summary: concise(
      [method || prompt, item.notes, `许可：${item.license || "待复核"}`]
        .filter(Boolean)
        .join(" "),
      900
    ),
    prompt_preview: concise(reproducibleText, 240) || null,
    prompt_full: reproducibleText || null,
    // 按 Prompt 正文判定，而不是跟着来源站点或创作者的语言走。
    content_locale: resolveContentLocale({ prompt_full: reproducibleText }),
    media_kind: item.mediaKind === "video" ? "video" : "image",
    media_url: String(item.mediaUrl ?? "").trim(),
    poster_url: null,
    remake_count: 0,
    stability_score: 0,
    favorite_score: 0,
    recommended_models: item.model ? [String(item.model).trim()] : [],
    cost_band: "medium",
    evidence_level: "L1",
    tags,
  };
}

export function selectSourceCandidates(
  items,
  { sourceIds = [], maxPerSource = 5 } = {}
) {
  if (!Number.isInteger(maxPerSource) || maxPerSource < 1) {
    throw new Error("maxPerSource 必须是正整数");
  }

  const selected = [];
  for (const sourceId of sourceIds) {
    const sourceItems = items
      .filter(
        (item) =>
          item.sourceId === sourceId &&
          item.candidateType === "case" &&
          item.sourceUrl &&
          item.creator &&
          item.mediaUrl &&
          (item.promptText || item.method)
      )
      .sort(
        (left, right) =>
          Number(right.completeness || 0) - Number(left.completeness || 0) ||
          String(left.title).localeCompare(String(right.title))
      );
    const creatorKeys = new Set();
    const diverse = [];
    const repeated = [];

    for (const item of sourceItems) {
      const creatorKey = String(item.creator).trim().toLocaleLowerCase();
      if (!creatorKeys.has(creatorKey)) {
        creatorKeys.add(creatorKey);
        diverse.push(item);
      } else {
        repeated.push(item);
      }
    }

    selected.push(...[...diverse, ...repeated].slice(0, maxPerSource));
  }

  return selected;
}
