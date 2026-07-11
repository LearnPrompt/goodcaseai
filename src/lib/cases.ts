import { access } from "node:fs/promises";
import path from "node:path";
import {
  deriveCreatorsFromCases,
  findCreatorByName,
  findCreatorBySlug,
  type CreatorItem,
} from "@/lib/creators";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";
import { caseItems, type CaseItem } from "@/lib/mock-data";

type DbCaseRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  source_platform: string | null;
  creator_name: string | null;
  summary: string;
  prompt_preview: string | null;
  prompt_full: string | null;
  media_kind: string;
  media_url: string;
  poster_url: string | null;
  remake_count: number;
  stability_score: number;
  favorite_score: number;
  recommended_models: string[] | null;
  cost_band: string;
  created_at: string | null;
};

type ServerSupabase = ReturnType<typeof getServerSupabaseClient>;

type DerivedCaseFields = {
  spreadScore: number;
  spreadScoreNote: string;
  promptPublicNote: string;
  promptLoginNotes: string[];
  promptContributionNotes: string[];
  editorNote: string;
  labNote: string[];
};

export type DisplayCaseItem = CaseItem & DerivedCaseFields;

const MEDIA_PLACEHOLDER = "/media/placeholder.png";

const CATEGORY_LABELS: Record<CaseItem["category"], string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程(UI)",
  copy: "AI 文案",
};

const COST_BAND_LABELS: Record<CaseItem["costBand"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export type CaseFilter = "all" | "video" | "web" | "image";

function applyCaseFilter(list: CaseItem[], filter: CaseFilter) {
  if (filter === "all") {
    return list;
  }

  return list.filter((item) => item.category === filter);
}

export function filterCasesByQuery<T extends Pick<CaseItem, "title" | "summary" | "creator">>(
  list: T[],
  q: string
): T[] {
  const normalized = q.trim().toLowerCase();
  if (!normalized) {
    return list;
  }

  return list.filter((item) =>
    [item.title, item.summary, item.creator].some((field) =>
      field.toLowerCase().includes(normalized)
    )
  );
}

function normalizeCategory(value: string): CaseItem["category"] {
  return value === "image" || value === "video" || value === "web" || value === "copy"
    ? value
    : "image";
}

function normalizeMediaType(value: string, mediaUrl?: string): CaseItem["mediaType"] {
  if (mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl)) {
    return "video";
  }

  return value === "video" ? "video" : "image";
}

function normalizeCostBand(value: string): CaseItem["costBand"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function toPublicAssetPath(rawPath: string | null) {
  if (!rawPath) {
    return MEDIA_PLACEHOLDER;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return normalized;
}

async function resolveUsableMediaPath(rawPath: string | null) {
  const publicPath = toPublicAssetPath(rawPath);
  if (/^https?:\/\//i.test(publicPath)) {
    return publicPath;
  }

  const absolute = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));

  try {
    await access(absolute);
    return publicPath;
  } catch {
    return MEDIA_PLACEHOLDER;
  }
}

function getPromptFocus(category: CaseItem["category"]) {
  if (category === "video") {
    return "镜头连续性、转场逻辑和动作收束是否同时成立";
  }

  if (category === "web") {
    return "页面信息层级、模块顺序和 CTA 是否一口气讲清楚";
  }

  if (category === "copy") {
    return "前三秒钩子、证据段和结尾行动指令能不能稳定复用";
  }

  return "主体、风格和材质约束能不能一起站住";
}

function getLabFocus(category: CaseItem["category"]) {
  if (category === "video") {
    return "镜头长度、转场方式与动作幅度";
  }

  if (category === "web") {
    return "模块顺序、价值主张写法与 CTA 位置";
  }

  if (category === "copy") {
    return "开场句式、证据数量与行动指令强度";
  }

  return "主体描述、风格词强度与布光/材质约束";
}

function getLearningAngle(category: CaseItem["category"]) {
  if (category === "video") {
    return "镜头编排与节奏控制";
  }

  if (category === "web") {
    return "信息架构与转化表达";
  }

  if (category === "copy") {
    return "结构化叙事与口播节奏";
  }

  return "视觉结构与风格控制";
}

function getSpreadScore(item: Pick<CaseItem, "remakeCount" | "favoriteScore" | "likedCount">) {
  // Beta 阶段还没有独立传播数据源，先用复刻数、喜爱分、点赞数做清晰可解释的临时传播势能信号。
  return Math.round(item.remakeCount / 25 + item.favoriteScore * 0.35 + item.likedCount / 240);
}

function buildSpreadScoreNote(item: CaseItem) {
  return `Beta 阶段暂用复刻数 ${item.remakeCount}、喜爱分 ${item.favoriteScore} 与点赞 ${item.likedCount} 派生传播势能，更适合快速发现正在被带着学的内容，不等于真实平台曝光。`;
}

function buildPromptPublicNote(item: CaseItem) {
  return `公开层先给你看预览，并告诉你为什么值得继续看：这条 ${CATEGORY_LABELS[item.category]} case 更适合观察 ${getPromptFocus(item.category)}。`;
}

function buildPromptLoginNotes(item: CaseItem) {
  const models = item.recommendedModels.slice(0, 2).join(" / ");

  return [
    `适用场景：${item.summary}`,
    `点赞解锁后优先先试 ${models}，先判断它在 ${getLearningAngle(item.category)} 上是否成立。`,
    `结构化拆解重点：先看 ${getLabFocus(item.category)}，不要一开始就只盯完整 Prompt。`,
  ];
}

function buildPromptContributionNotes(item: CaseItem) {
  return [
    "点赞解锁层会放出完整 Prompt、负向约束与更完整记录，方便你直接照着复测。",
    "当前 Beta 期把“点赞”当作解锁信号：点一下爱心，就能看到完整 Prompt 与更深材料。",
    `解锁后复看重点：确认 ${getPromptFocus(item.category)} 有没有在完整 Prompt 里被写清楚。`,
  ];
}

function buildEditorNote(item: CaseItem) {
  const strongerSignal = item.favoriteScore >= item.stabilityScore ? "喜爱信号更强" : "稳定信号更强";
  const leadModel = item.recommendedModels[0] || "当前推荐模型";

  return `这是一个适合从 ${getLearningAngle(item.category)} 切进去的 case。当前站内信号里，${strongerSignal}：它拿到了 ${item.favoriteScore} 的喜爱分、${item.stabilityScore} 的稳定分，以及 ${item.remakeCount} 次复刻。Beta 版编辑判断会更建议你把它当成“结构样本”来看，而不只是抄一段 Prompt；先理解它为什么在 ${leadModel} 上容易出结果，再决定要不要投入更高成本继续打磨。`;
}

function buildLabNote(item: CaseItem) {
  const leadModel = item.recommendedModels[0] || "当前推荐模型";
  const backupModel = item.recommendedModels[1] || item.recommendedModels[0] || "备选模型";

  return [
    `第一轮先用 ${leadModel} 建基准版本，再用 ${backupModel} 对照；不要一开始就同时改太多参数。`,
    `这条 case 的稳定分是 ${item.stabilityScore}，更建议你优先盯 ${getLabFocus(item.category)} 这些变量，看输出是否还能保持同一方向。`,
    `当前成本档位是 ${COST_BAND_LABELS[item.costBand]}，适合先做小步复测，再决定要不要放大生成次数。`,
  ];
}

function enrichCaseItem(item: CaseItem): DisplayCaseItem {
  return {
    ...item,
    spreadScore: getSpreadScore(item),
    spreadScoreNote: buildSpreadScoreNote(item),
    promptPublicNote: buildPromptPublicNote(item),
    promptLoginNotes: buildPromptLoginNotes(item),
    promptContributionNotes: buildPromptContributionNotes(item),
    editorNote: buildEditorNote(item),
    labNote: buildLabNote(item),
  };
}

async function getLikeCountsByCaseId(supabase: ServerSupabase, caseIds: string[]) {
  const counts = new Map<string, number>();

  if (!supabase || caseIds.length === 0) {
    return counts;
  }

  // 数据量小，一次拉出相关点赞行在内存聚合，避免每个 case 各查一次的 N+1。
  const { data, error } = await supabase
    .from("case_likes")
    .select("case_id")
    .in("case_id", caseIds);

  if (error || !data) {
    return counts;
  }

  for (const row of data) {
    const caseId = row.case_id;
    if (typeof caseId === "string" && caseId.length > 0) {
      counts.set(caseId, (counts.get(caseId) || 0) + 1);
    }
  }

  return counts;
}

async function mapDbCaseRowToCaseItem(
  row: DbCaseRow,
  likeCounts: Map<string, number>
): Promise<CaseItem> {
  const likedCount = likeCounts.get(row.id) || 0;
  const mediaUrl = await resolveUsableMediaPath(row.media_url);
  const posterUrl = await resolveUsableMediaPath(row.poster_url);
  const mediaType = normalizeMediaType(row.media_kind, row.media_url);

  return {
    slug: row.slug,
    title: row.title,
    category: normalizeCategory(row.category),
    source: row.source_platform || "未知来源",
    creator: row.creator_name || "匿名作者",
    summary: row.summary,
    promptPreview: row.prompt_preview || "该案例暂未提供 Prompt 预览。",
    promptFull: row.prompt_full || row.prompt_preview || "该案例暂未提供完整 Prompt。",
    mediaType,
    mediaUrl,
    posterUrl: mediaType === "video" ? posterUrl : undefined,
    likedCount,
    remakeCount: row.remake_count,
    stabilityScore: row.stability_score,
    favoriteScore: row.favorite_score,
    recommendedModels:
      row.recommended_models && row.recommended_models.length > 0
        ? row.recommended_models
        : ["待补充模型"],
    costBand: normalizeCostBand(row.cost_band),
    createdAt: row.created_at || undefined,
  };
}

async function fetchPublishedCases(filter: CaseFilter = "all"): Promise<DisplayCaseItem[] | null> {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  let query = supabase
    .from("cases")
    .select(
      "id, slug, title, category, source_platform, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, created_at"
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (filter !== "all") {
    query = query.eq("category", filter);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return null;
  }

  const rows = data as DbCaseRow[];
  const likeCounts = await getLikeCountsByCaseId(
    supabase,
    rows.map((item) => item.id)
  );

  const items = await Promise.all(rows.map((item) => mapDbCaseRowToCaseItem(item, likeCounts)));
  return items.map(enrichCaseItem);
}

export async function getCaseListData(filter: CaseFilter = "all") {
  const fromDb = await fetchPublishedCases(filter);
  if (fromDb) {
    return fromDb;
  }

  return applyCaseFilter(caseItems, filter).map(enrichCaseItem);
}

export async function getCaseDetailData(slug: string) {
  const supabase = getServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("cases")
      .select(
        "id, slug, title, category, source_platform, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, created_at"
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!error && data) {
      const likeCounts = await getLikeCountsByCaseId(supabase, [data.id]);
      const item = await mapDbCaseRowToCaseItem(data as DbCaseRow, likeCounts);
      return enrichCaseItem(item);
    }
  }

  const fallback = caseItems.find((item) => item.slug === slug);
  return fallback ? enrichCaseItem(fallback) : null;
}

export async function getCaseSlugs() {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return caseItems.map((item) => item.slug);
  }

  const { data, error } = await supabase.from("cases").select("slug").eq("is_published", true);

  if (error || !data || data.length === 0) {
    return caseItems.map((item) => item.slug);
  }

  return data
    .map((item) => item.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

export async function getHomeData() {
  const list = await getCaseListData("all");
  const creators = deriveCreatorsFromCases(list);

  const featuredCase = list[0] || enrichCaseItem(caseItems[0]);
  const spread = [...list].sort((a, b) => b.spreadScore - a.spreadScore).slice(0, 10);
  const favorite = [...list].sort((a, b) => b.favoriteScore - a.favoriteScore).slice(0, 10);
  const stability = [...list].sort((a, b) => b.stabilityScore - a.stabilityScore).slice(0, 10);

  return {
    featuredCase,
    totalCaseCount: list.length,
    totalCreatorCount: creators.length,
    featuredCreators: creators.slice(0, 4),
    spreadLeaderboard: spread,
    favoriteLeaderboard: favorite,
    stabilityLeaderboard: stability,
  };
}

export async function getCreatorListData() {
  const list = await getCaseListData("all");
  return deriveCreatorsFromCases(list);
}

export async function getCreatorDetailData(slug: string) {
  const creators = await getCreatorListData();
  return findCreatorBySlug(creators, slug);
}

export async function getCreatorForCase(slug: string) {
  const [item, creators] = await Promise.all([
    getCaseDetailData(slug),
    getCreatorListData(),
  ]);

  if (!item) {
    return null;
  }

  return findCreatorByName(creators, item.creator);
}

export type { CreatorItem };
