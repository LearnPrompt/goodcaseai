export const RADAR_FEED_URL =
  "https://learnprompt.github.io/ai-news-radar/data/latest-24h.json";

export const meta = {
  id: "radar",
  displayName: "AI News Radar",
};

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim() || "";
}

function parseXAuthor(source) {
  if (typeof source !== "string") {
    return null;
  }
  const match = source.match(/\(@([A-Za-z0-9_]+)\)/);
  return match ? `@${match[1]}` : null;
}

function normalizeResultUrls(item) {
  const candidates = [
    ...(Array.isArray(item.result_urls) ? item.result_urls : []),
    ...(Array.isArray(item.media_urls) ? item.media_urls : []),
  ];
  return candidates.filter((value) => typeof value === "string" && value.trim() !== "");
}

export function normalizeRadarItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const sourceUrl = firstString(item.url);
  const title = firstString(item.title, item.title_zh, item.title_original);
  if (!sourceUrl || !title) {
    return null;
  }

  return {
    sourceId: meta.id,
    externalId: firstString(item.id) || sourceUrl,
    origin: item.site_id === "aihot" ? "aihot" : firstString(item.site_id, item.source),
    sourceLabel: firstString(item.source, item.site_name),
    title,
    sourceUrl,
    author: firstString(item.author, item.creator) || parseXAuthor(item.source),
    publishedAt: firstString(item.published_at, item.first_seen_at) || null,
    resultUrls: normalizeResultUrls(item),
    promptText: firstString(item.prompt_text),
    promptIsPublic: item.prompt_is_public === true,
    stepsSummary: firstString(item.steps_summary, item.configuration),
    relevanceScore: Number.isFinite(Number(item.ai_score)) ? Number(item.ai_score) : 0,
    summary: firstString(item.summary, item.recommend_reason_zh, item.ai_relevance_reason),
    raw: item,
  };
}

export function normalizeRadarItems(payload) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("Radar feed 缺少 items 数组。");
  }

  return payload.items
    .map(normalizeRadarItem)
    .filter(Boolean)
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
    });
}

export function selectDiversifiedItems(
  items,
  { maxItems = 15, preferredOrigin = "aihot", preferredQuota } = {}
) {
  const limit = Number.isInteger(maxItems) && maxItems > 0 ? maxItems : 15;
  const quota =
    Number.isInteger(preferredQuota) && preferredQuota >= 0
      ? Math.min(preferredQuota, limit)
      : Math.ceil(limit / 2);
  const preferred = items.filter((item) => item.origin === preferredOrigin);
  const other = items.filter((item) => item.origin !== preferredOrigin);
  const selected = [
    ...preferred.slice(0, quota),
    ...other.slice(0, Math.max(0, limit - Math.min(quota, preferred.length))),
  ];

  if (selected.length < limit) {
    selected.push(...preferred.slice(quota, quota + limit - selected.length));
  }

  return selected
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
    })
    .slice(0, limit);
}

export function normalizeRadarFeed(payload, options = {}) {
  return selectDiversifiedItems(normalizeRadarItems(payload), options);
}

export async function fetchRadarItems({
  feedUrl = RADAR_FEED_URL,
  timeoutMs = 20_000,
} = {}) {
  const response = await fetch(feedUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Radar feed 请求失败：HTTP ${response.status}`);
  }

  const payload = await response.json();
  return normalizeRadarItems(payload);
}

export async function fetchRaw(options = {}) {
  const items = await fetchRadarItems(options);
  return selectDiversifiedItems(items, options);
}
