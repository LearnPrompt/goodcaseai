export const YOUMIND_INDEX_URL = "https://youmind.com/zh-CN/prompts";

export const meta = {
  id: "youmind",
  displayName: "YouMind 提示词库",
};

function firstString(...values) {
  return (
    values.find((value) => typeof value === "string" && value.trim() !== "")?.trim() ||
    ""
  );
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function typeIncludes(value, expected) {
  return asArray(value).includes(expected);
}

function stripSourceFragment(value) {
  const sourceUrl = firstString(value);
  if (!sourceUrl) {
    return "";
  }

  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function extractJsonLdGraphs(html) {
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const nodes = [];

  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1]);
      const graph = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      nodes.push(...graph.filter((node) => node && typeof node === "object"));
    } catch {
      // Ignore unrelated or damaged structured-data blocks.
    }
  }

  return nodes;
}

function interactionCount(work, actionType) {
  const statistic = asArray(work.interactionStatistic).find((item) =>
    typeIncludes(item?.interactionType?.["@type"], actionType)
  );
  const count = Number(statistic?.userInteractionCount);
  return Number.isFinite(count) && count >= 0 ? Math.round(count) : null;
}

function normalizeMedia(nodes, work) {
  const video =
    nodes.find((node) => typeIncludes(node?.["@type"], "VideoObject")) || null;
  const videoUrl = firstString(video?.contentUrl);
  const images = [
    ...asArray(work.image),
    ...asArray(video?.thumbnailUrl),
  ]
    .map((value) =>
      typeof value === "string"
        ? value
        : firstString(value?.url, value?.contentUrl)
    )
    .filter(Boolean);
  const mediaKind = videoUrl ? "video" : "image";

  return {
    mediaKind,
    mediaUrl: videoUrl || images[0] || "",
    posterUrl: mediaKind === "video" ? images[0] || null : null,
    resultUrls: [...new Set([videoUrl, ...images].filter(Boolean))],
  };
}

function scoreFromInteractions({ views, likes, comments, shares }) {
  const weighted =
    (views || 0) + 8 * (likes || 0) + 20 * (comments || 0) + 24 * (shares || 0);
  if (weighted <= 0) {
    return 0;
  }
  return Math.min(1, Math.log10(weighted + 1) / 6);
}

const VALID_CATEGORIES = new Set(["image", "video", "web"]);

/**
 * 分类判定。
 *
 * 曾经完全依赖 `work.about.applicationCategory`（比如 "WebGenerationApplication"）
 * 来猜这条 case 是不是网页类。这条线本身就是错位的：那个字段描述的是生成时用的
 * 模型/工具（claude-fable-5、Gemini 3 Pro……），不是产出物的类型，youmind 把它从
 * "WebGenerationApplication" 换成 "WebApplication" 之后，这条判断整片失效，
 * `/prompts/webpage` 抓到的条目全部被误判成 image。
 *
 * 真正可靠的信号是抓取时已经知道的入口分类页——`/prompts/video`、`/prompts/webpage`
 * 是 youmind 自己的策展结论，比任何字符串匹配都稳。调用方（fetchYouMindItems）
 * 知道每个详情页是从哪个分类页找到的，通过 sourceCategory 传进来，有值就是唯一判据。
 *
 * sourceCategory 只有在拿不到的时候（比如 `/prompts` 综合页本身就是混合分类，
 * 不能代表单条 case 属于哪一类）才会走到下面的兜底逻辑，而兜底逻辑里的
 * applicationCategory 匹配仍然是不可靠信号，别再把它当成主判据。
 */
function normalizeCategory(work, mediaKind, sourceCategory) {
  if (sourceCategory && VALID_CATEGORIES.has(sourceCategory)) {
    return sourceCategory;
  }
  if (mediaKind === "video") {
    return "video";
  }
  // 兜底：不可靠信号，见上面函数注释。WebApplication / WebGenerationApplication
  // 这两个值 youmind 站点历史上互相替换过，两个都认，但优先级永远低于 sourceCategory。
  if (
    work?.about?.applicationCategory === "WebGenerationApplication" ||
    work?.about?.applicationCategory === "WebApplication"
  ) {
    return "web";
  }
  return "image";
}

export function normalizeYouMindPromptPage(html, pageUrl, { sourceCategory } = {}) {
  const nodes = extractJsonLdGraphs(html);
  const work = nodes.find((node) => typeIncludes(node?.["@type"], "CreativeWork"));
  if (!work) {
    return null;
  }

  const title = firstString(work.name);
  const promptText = firstString(work.text);
  const sourceUrl = stripSourceFragment(work.isBasedOn);
  const author = firstString(work.author?.name);
  const media = normalizeMedia(nodes, work);
  if (
    !title ||
    !promptText ||
    !sourceUrl ||
    !author ||
    media.resultUrls.length === 0
  ) {
    return null;
  }

  const metrics = {
    views: interactionCount(work, "ViewAction"),
    likes: interactionCount(work, "LikeAction"),
    comments: interactionCount(work, "CommentAction"),
    shares: interactionCount(work, "ShareAction"),
  };
  const modelName = firstString(work.about?.name);
  const canonicalPageUrl = firstString(work.url, pageUrl);

  return {
    sourceId: meta.id,
    externalId: canonicalPageUrl,
    origin: meta.id,
    sourceLabel: "YouMind Prompt Library",
    title,
    sourceUrl,
    evidencePageUrl: canonicalPageUrl,
    author,
    authorUrl: firstString(work.author?.url) || null,
    publishedAt: firstString(work.datePublished) || null,
    resultUrls: media.resultUrls,
    mediaKind: media.mediaKind,
    mediaUrl: media.mediaUrl,
    posterUrl: media.posterUrl,
    promptText,
    promptIsPublic: work.isAccessibleForFree === true,
    stepsSummary: "复制公开 Prompt，在对应模型中生成，并按需要替换主体、风格或细节。",
    relevanceScore: scoreFromInteractions(metrics),
    summary: firstString(work.description),
    category: normalizeCategory(work, media.mediaKind, sourceCategory),
    modelName: modelName || null,
    tags: [...new Set(["youmind", modelName].filter(Boolean))],
    sourceLikeCount: metrics.likes,
    sourceCommentCount: metrics.comments,
    sourceShareCount: metrics.shares,
    sourceViewCount: metrics.views,
    raw: work,
  };
}

export function extractWeeklyPromptUrls(
  html,
  { indexUrl = YOUMIND_INDEX_URL } = {}
) {
  const start = html.indexOf('id="prompts-weekly-highlights"');
  const end = html.indexOf('id="prompts-media"', Math.max(0, start));
  if (start < 0 || end <= start) {
    throw new Error("YouMind 首页缺少每周最热区块。");
  }

  const section = html.slice(start, end);
  const urls = [];
  const seen = new Set();
  const matches = section.matchAll(
    /href=["']([^"']*\/(?:prompts|video-prompts)\/[^"'?#]+-\d+)(?:[?#][^"']*)?["']/gi
  );

  for (const match of matches) {
    const url = new URL(match[1], indexUrl).toString();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

export function extractPromptUrls(
  html,
  { indexUrl = YOUMIND_INDEX_URL } = {}
) {
  const urls = [];
  const seen = new Set();
  const matches = html.matchAll(
    /href=["']([^"']*\/(?:prompts|video-prompts)\/[^"'?#]+-\d+)(?:[?#][^"']*)?["']/gi
  );

  for (const match of matches) {
    const url = new URL(match[1], indexUrl).toString();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/** `/prompts/<segment>` 分类页的 URL 段到内部 category 枚举的映射。 */
const LISTING_PATH_CATEGORY = {
  video: "video",
  webpage: "web",
  image: "image",
};

/**
 * 从分类页 URL 推断这一页下面的详情页应该归到哪个 category。
 * 只有专属分类页（`/prompts/video`、`/prompts/webpage` ……）才有明确答案；
 * `/prompts` 根首页本身是混合分类的 weekly-highlights，推不出单一 category，
 * 返回 null 交给 normalizeCategory 的兜底逻辑处理。
 */
export function inferSourceCategoryFromListingUrl(listingUrl) {
  const pathname = new URL(listingUrl).pathname.replace(/\/+$/, "");
  const segment = pathname.match(/\/prompts\/([^/]+)$/)?.[1];
  return (segment && LISTING_PATH_CATEGORY[segment]) || null;
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "GoodCaseSupplyShadow/1.0 (+https://goodcase.ai)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`YouMind 请求失败：HTTP ${response.status} ${url}`);
  }
  return response.text();
}

export async function fetchYouMindItems({
  indexUrl = YOUMIND_INDEX_URL,
  indexUrls,
  maxItems = 15,
  timeoutMs = 20_000,
  concurrency = 6,
} = {}) {
  const listingUrls =
    Array.isArray(indexUrls) && indexUrls.length > 0 ? indexUrls : [indexUrl];
  const listingPages = await Promise.all(
    listingUrls.map(async (listingUrl) => ({
      listingUrl,
      html: await fetchText(listingUrl, timeoutMs),
    }))
  );
  const detailUrls = [];
  const detailSourceCategories = new Map();
  const seen = new Set();

  for (const page of listingPages) {
    const pathname = new URL(page.listingUrl).pathname.replace(/\/+$/, "");
    const isRootIndex = /\/prompts$/.test(pathname);
    const pageUrls = isRootIndex
      ? extractWeeklyPromptUrls(page.html, { indexUrl: page.listingUrl })
      : extractPromptUrls(page.html, { indexUrl: page.listingUrl });
    const listingCategory = inferSourceCategoryFromListingUrl(page.listingUrl);
    for (const detailUrl of pageUrls) {
      if (!seen.has(detailUrl)) {
        seen.add(detailUrl);
        detailUrls.push(detailUrl);
        if (listingCategory) {
          detailSourceCategories.set(detailUrl, listingCategory);
        }
      }
    }
  }

  detailUrls.splice(maxItems);
  if (detailUrls.length === 0) {
    throw new Error("YouMind 列表没有可读取的 Prompt 页面。");
  }

  const settled = [];
  for (let index = 0; index < detailUrls.length; index += concurrency) {
    const batch = detailUrls.slice(index, index + concurrency);
    settled.push(
      ...(await Promise.allSettled(
        batch.map(async (detailUrl) =>
          normalizeYouMindPromptPage(await fetchText(detailUrl, timeoutMs), detailUrl, {
            sourceCategory: detailSourceCategories.get(detailUrl),
          })
        )
      ))
    );
  }
  const items = settled
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);

  if (items.length === 0) {
    const firstError = settled.find((result) => result.status === "rejected");
    throw new Error(
      firstError?.reason instanceof Error
        ? firstError.reason.message
        : "YouMind Prompt 详情页没有产出有效候选。"
    );
  }

  return items.sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore;
    }
    return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
  });
}
