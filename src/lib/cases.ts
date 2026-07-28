import { access } from "node:fs/promises";
import path from "node:path";
import {
  deriveCreatorsFromCases,
  findCreatorByName,
  findCreatorBySlug,
  type CreatorItem,
} from "@/lib/creators";
import {
  CATEGORY_LABELS,
  MISSING_PROMPT_PREVIEW,
} from "@/lib/case-presentation";
import { scoreSourceHeat, type SourceHeatFields } from "@/lib/source-heat";
import { getServerSupabaseClient, withTimeout } from "@/lib/supabase/server-client";
import { caseItems, creatorAvatarUrls, type CaseItem } from "@/lib/mock-data";
import { getRelatedCases, MISSING_MODEL } from "@/lib/related-cases";
import {
  formatStabilityScore,
  hasMeasuredStability,
} from "@/lib/stability";
import {
  deriveSkillCatalog,
  findSkillBySlug,
  getCaseSkillLinks,
  getCreatorMethods,
} from "@/lib/skills";
import type { Locale } from "@/i18n/config";
import { getEnglishCaseTranslation } from "@/i18n/content";

type DbCaseRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  source_platform: string | null;
  source_url: string | null;
  source_like_count: number | null;
  source_comment_count: number | null;
  source_share_count: number | null;
  source_save_count: number | null;
  source_published_at: string | null;
  source_metrics_captured_at: string | null;
  creator_name: string | null;
  summary: string;
  prompt_preview: string | null;
  prompt_full: string | null;
  content_locale: string | null;
  translations: unknown;
  translation_status: string | null;
  media_kind: string;
  media_url: string;
  poster_url: string | null;
  remake_count: number;
  stability_score: number;
  favorite_score: number;
  recommended_models: string[] | null;
  cost_band: string;
  evidence_level: string | null;
  tags: string[] | null;
  created_at: string | null;
};

type StoredCaseTranslation = {
  title?: string;
  summary?: string;
  promptFull?: string;
  resultBreakdown?: [string, string, string];
};

type BaseDerivedCaseFields = {
  promptPublicNote: string;
  promptLoginNotes: string[];
  promptContributionNotes: string[];
  editorNote: string;
  labNote: string[];
};

type DerivedCaseFields = BaseDerivedCaseFields &
  SourceHeatFields & {
    spreadScore: number | null;
    spreadScoreNote: string;
  };

export type DisplayCaseItem = CaseItem & DerivedCaseFields;

const MEDIA_PLACEHOLDER = "/media/placeholder.png";

const COST_BAND_LABELS: Record<CaseItem["costBand"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export type CaseFilter =
  | "all"
  | "video"
  | "web"
  | "image"
  | "copy"
  | "hardware";

function applyCaseFilter<T extends CaseItem>(list: T[], filter: CaseFilter): T[] {
  if (filter === "all") {
    return list;
  }

  return list.filter((item) => item.category === filter);
}

export function filterCasesByQuery<
  T extends Pick<
    CaseItem,
    "title" | "summary" | "creator" | "recommendedModels" | "tags"
  >
>(list: T[], q: string): T[] {
  const normalized = q.trim().toLowerCase();
  if (!normalized) {
    return list;
  }

  return list.filter((item) =>
    [
      item.title,
      item.summary,
      item.creator,
      ...item.recommendedModels,
      ...(item.tags ?? []),
    ].some((field) => field.toLowerCase().includes(normalized))
  );
}

function normalizeCategory(value: string): CaseItem["category"] {
  return value === "image" ||
    value === "video" ||
    value === "web" ||
    value === "copy" ||
    value === "hardware"
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

function readStoredTranslation(
  value: unknown,
  locale: Locale
): StoredCaseTranslation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[locale];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const resultBreakdown =
    Array.isArray(record.resultBreakdown) &&
    record.resultBreakdown.length === 3 &&
    record.resultBreakdown.every((item) => typeof item === "string")
      ? (record.resultBreakdown as [string, string, string])
      : undefined;

  return {
    title: typeof record.title === "string" ? record.title.trim() : undefined,
    summary:
      typeof record.summary === "string" ? record.summary.trim() : undefined,
    promptFull:
      typeof record.promptFull === "string"
        ? record.promptFull.trim()
        : undefined,
    resultBreakdown,
  };
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

function getPromptFocus(
  category: CaseItem["category"],
  locale: Locale
) {
  if (locale === "en") {
    if (category === "video") return "camera continuity, transition logic, and action resolution";
    if (category === "web") return "information hierarchy, module order, and CTA clarity";
    if (category === "copy") return "the opening hook, evidence section, and closing action";
    if (category === "hardware") return "the physical action, software response, privacy boundary, and device chain";
    return "the subject, style, and material constraints";
  }

  if (category === "video") {
    return "镜头连续性、转场逻辑和动作收束是否同时成立";
  }

  if (category === "web") {
    return "页面信息层级、模块顺序和 CTA 是否一口气讲清楚";
  }

  if (category === "copy") {
    return "前三秒钩子、证据段和结尾行动指令能不能稳定复用";
  }

  if (category === "hardware") {
    return "按下动作、软件反馈、隐私边界与真实设备链路是否同时成立";
  }

  return "主体、风格和材质约束能不能一起站住";
}

function getLabFocus(category: CaseItem["category"], locale: Locale) {
  if (locale === "en") {
    if (category === "video") return "shot length, transitions, and motion amplitude";
    if (category === "web") return "module order, value proposition, and CTA placement";
    if (category === "copy") return "opening structure, evidence count, and CTA strength";
    if (category === "hardware") return "trigger action, end-to-end latency, false triggers, and privacy fallback";
    return "subject description, style intensity, lighting, and material constraints";
  }

  if (category === "video") {
    return "镜头长度、转场方式与动作幅度";
  }

  if (category === "web") {
    return "模块顺序、价值主张写法与 CTA 位置";
  }

  if (category === "copy") {
    return "开场句式、证据数量与行动指令强度";
  }

  if (category === "hardware") {
    return "按键动作、端到端延迟、误触处理与隐私降级";
  }

  return "主体描述、风格词强度与布光/材质约束";
}

function getLearningAngle(category: CaseItem["category"], locale: Locale) {
  if (locale === "en") {
    if (category === "video") return "shot planning and pacing";
    if (category === "web") return "information architecture and conversion copy";
    if (category === "copy") return "structured storytelling and spoken rhythm";
    if (category === "hardware") return "physical interaction, software feedback, and privacy";
    return "visual structure and style control";
  }

  if (category === "video") {
    return "镜头编排与节奏控制";
  }

  if (category === "web") {
    return "信息架构与转化表达";
  }

  if (category === "copy") {
    return "结构化叙事与口播节奏";
  }

  if (category === "hardware") {
    return "实体交互、软件闭环与隐私设计";
  }

  return "视觉结构与风格控制";
}

function getEditableVariables(category: CaseItem["category"], locale: Locale) {
  if (locale === "en") {
    if (category === "video") return "the subject, scene, camera movement, and final action";
    if (category === "web") return "the product name, audience, page modules, and primary button";
    if (category === "copy") return "the audience, pain point, evidence, and call to action";
    if (category === "hardware") return "the trigger, software feedback, failure fallback, and privacy cue";
    return "the subject, scene, material, and color palette";
  }

  if (category === "video") {
    return "主体、场景、镜头运动和结尾动作";
  }

  if (category === "web") {
    return "产品名称、目标用户、页面模块和主按钮";
  }

  if (category === "copy") {
    return "受众、痛点、证据和行动指令";
  }

  if (category === "hardware") {
    return "触发动作、软件反馈、失败降级和隐私提示";
  }

  return "主体、场景、材质和配色";
}

function buildPromptPublicNote(item: CaseItem, locale: Locale) {
  if (locale === "en") {
    return `The useful part of this case is not one “magic phrase,” but how it turns ${getPromptFocus(item.category, locale)} into constraints that can be adjusted and tested.`;
  }
  return `这条 ${CATEGORY_LABELS[item.category]} Case 值得学的不是某一句“魔法词”，而是它怎样把 ${getPromptFocus(item.category, locale)} 写成一组可以反复调整的约束。`;
}

function buildPromptLoginNotes(item: CaseItem, locale: Locale) {
  const models = item.recommendedModels.slice(0, 2).join(" / ");

  if (locale === "en") {
    return [
      "Keep it unchanged first: run the complete prompt once to establish a baseline.",
      `Replace only ${getEditableVariables(item.category, locale)} while keeping the rest of the structure fixed.`,
      `Compare next: start with ${models} and change only one variable per run.`,
    ];
  }

  return [
    "先不改：完整复制提示语，生成一版基线结果。",
    `只替换：先改 ${getEditableVariables(item.category, locale)}，其余结构保持不动。`,
    `再对比：优先用 ${models} 起步，每次只改一个变量。`,
  ];
}

function buildPromptContributionNotes(item: CaseItem, locale: Locale) {
  if (locale === "en") {
    const translated = getEnglishCaseTranslation(item.slug);
    if (translated?.resultBreakdown) {
      return translated.resultBreakdown;
    }
    return [
      `Check whether ${getPromptFocus(item.category, locale)} all hold in the final result.`,
      `Extract “target result → ${getEditableVariables(item.category, locale)} → constraints” as a reusable template for similar work.`,
      `Run single-variable comparisons around ${getLabFocus(item.category, locale)}. Record the model, cost, and failures; turn it into a Skill only after it repeats reliably.`,
    ];
  }

  if (item.resultBreakdown) {
    return item.resultBreakdown;
  }

  return [
    `观察最终结果里，${getPromptFocus(item.category, locale)} 是否同时成立。`,
    `把“目标结果 → ${getEditableVariables(item.category, locale)} → 约束条件”抽成模板，后续可复用到同类任务。`,
    `围绕 ${getLabFocus(item.category, locale)} 做单变量对照，并记录模型、成本和失败结果；重复成立后再沉淀为 Skill。`,
  ];
}

function buildEditorNote(item: CaseItem, locale: Locale) {
  const leadModel = item.recommendedModels[0] || "当前推荐模型";
  const evidenceLevel = item.evidenceLevel || "L0";

  if (locale === "en") {
    return `This case is best approached through ${getLearningAngle(item.category, locale)}. Its current evidence level is ${evidenceLevel}, with a stability reference of ${formatStabilityScore(item.stabilityScore)}. Source heat is calculated separately from the original-post snapshot. Treat it as a structural sample rather than a prompt to copy: understand why it works with ${leadModel} before investing in more expensive iterations.`;
  }
  return `这是一个适合从 ${getLearningAngle(item.category, locale)} 切进去的 case。当前证据等级为 ${evidenceLevel}，稳定性参考为 ${formatStabilityScore(item.stabilityScore)}；来源互动热度单独按原帖快照计算，不和编辑判断混在一起。更建议你把它当成“结构样本”来看，而不只是抄一段 Prompt；先理解它为什么在 ${leadModel} 上容易出结果，再决定要不要投入更高成本继续打磨。`;
}

function buildLabNote(item: CaseItem, locale: Locale) {
  const leadModel = item.recommendedModels[0] || "当前推荐模型";
  const backupModel = item.recommendedModels[1] || item.recommendedModels[0] || "备选模型";

  if (locale === "en") {
    const cost = {
      low: "low",
      medium: "medium",
      high: "high",
    }[item.costBand];
    return [
      `Build a baseline with ${leadModel}, then compare it with ${backupModel}. Do not change many parameters at once.`,
      `The stability reference is ${formatStabilityScore(item.stabilityScore)}. Focus first on ${getLabFocus(item.category, locale)} and check whether the output stays in the same direction.`,
      `The current cost band is ${cost}. Start with small retests before increasing the number of generations.`,
    ];
  }

  return [
    `第一轮先用 ${leadModel} 建基准版本，再用 ${backupModel} 对照；不要一开始就同时改太多参数。`,
    `这条 case 的稳定参考是 ${formatStabilityScore(item.stabilityScore)}，更建议你优先盯 ${getLabFocus(item.category, locale)} 这些变量，看输出是否还能保持同一方向。`,
    `当前成本档位是 ${COST_BAND_LABELS[item.costBand]}，适合先做小步复测，再决定要不要放大生成次数。`,
  ];
}

function enrichCaseItemBase(
  item: CaseItem,
  locale: Locale
): CaseItem & BaseDerivedCaseFields {
  const translation = getEnglishCaseTranslation(item.slug);
  const localizedItem =
    locale === "en" && translation
      ? { ...item, ...translation }
      : {
          ...item,
          promptTranslationZh:
            translation?.promptTranslationZh || item.promptTranslationZh,
        };

  return {
    ...localizedItem,
    contentLocale: item.contentLocale || "en",
    promptTranslationZh:
      translation?.promptTranslationZh || item.promptTranslationZh,
    creatorAvatarUrl: item.creatorAvatarUrl || creatorAvatarUrls[item.creator],
    likedCount: 0,
    promptPublicNote: buildPromptPublicNote(localizedItem, locale),
    promptLoginNotes: buildPromptLoginNotes(localizedItem, locale),
    promptContributionNotes: buildPromptContributionNotes(localizedItem, locale),
    editorNote: buildEditorNote(localizedItem, locale),
    labNote: buildLabNote(localizedItem, locale),
  };
}

function enrichCaseItems(
  items: CaseItem[],
  locale: Locale = "zh-CN"
): DisplayCaseItem[] {
  return scoreSourceHeat(items.map((item) => enrichCaseItemBase(item, locale))).map((item) => ({
    ...item,
    spreadScore: item.sourceHeatScore,
    spreadScoreNote:
      item.sourceHeatScore === null
        ? locale === "en"
          ? "No verifiable source-interaction snapshot is available, so momentum is not scored."
          : "尚无可核验的来源互动快照，传播势能暂不评分。"
        : locale === "en"
          ? "Momentum currently follows source heat: interactions and velocity are normalized within each platform before cross-platform comparison."
          : "传播势能当前沿用来源热度：先按平台内互动与互动速度归一，再跨平台比较。",
  }));
}

function enrichCaseItem(
  item: CaseItem,
  locale: Locale = "zh-CN"
): DisplayCaseItem {
  return enrichCaseItems([item], locale)[0];
}

async function mapDbCaseRowToCaseItem(
  row: DbCaseRow,
  locale: Locale
): Promise<CaseItem> {
  const fallbackEditorial = caseItems.find((item) => item.slug === row.slug);
  const contentLocale: Locale =
    row.content_locale === "en" ? "en" : "zh-CN";
  const localized = readStoredTranslation(row.translations, locale);
  const chinese = readStoredTranslation(row.translations, "zh-CN");
  const english = readStoredTranslation(row.translations, "en");
  const mediaUrl = await resolveUsableMediaPath(row.media_url);
  const posterUrl = await resolveUsableMediaPath(row.poster_url);
  const mediaType = normalizeMediaType(row.media_kind, row.media_url);

  return {
    slug: row.slug,
    title: localized?.title || row.title,
    category: normalizeCategory(row.category),
    source: row.source_platform || "未知来源",
    sourceUrl: row.source_url || undefined,
    sourceLikeCount: row.source_like_count ?? undefined,
    sourceCommentCount: row.source_comment_count ?? undefined,
    sourceShareCount: row.source_share_count ?? undefined,
    sourceSaveCount: row.source_save_count ?? undefined,
    sourcePublishedAt: row.source_published_at || undefined,
    sourceMetricsCapturedAt: row.source_metrics_captured_at || undefined,
    creator: row.creator_name || "匿名作者",
    creatorAvatarUrl:
      fallbackEditorial?.creatorAvatarUrl ||
      creatorAvatarUrls[row.creator_name || ""] ||
      undefined,
    summary: localized?.summary || row.summary,
    promptPreview: row.prompt_preview || MISSING_PROMPT_PREVIEW,
    promptFull: row.prompt_full || row.prompt_preview || "该案例暂未提供完整 Prompt。",
    contentLocale,
    promptTranslationZh:
      contentLocale === "zh-CN"
        ? undefined
        : chinese?.promptFull || fallbackEditorial?.promptTranslationZh,
    promptTranslationEn:
      contentLocale === "en" ? undefined : english?.promptFull,
    resultBreakdown:
      localized?.resultBreakdown || fallbackEditorial?.resultBreakdown,
    mediaType,
    mediaUrl,
    posterUrl: mediaType === "video" ? posterUrl : undefined,
    likedCount: 0,
    remakeCount: row.remake_count,
    stabilityScore: row.stability_score,
    favoriteScore: row.favorite_score,
    recommendedModels:
      row.recommended_models && row.recommended_models.length > 0
        ? row.recommended_models
        : [MISSING_MODEL],
    costBand: normalizeCostBand(row.cost_band),
    evidenceLevel:
      row.evidence_level === "L1" || row.evidence_level === "L2" ? row.evidence_level : "L0",
    tags: row.tags || [],
    createdAt: row.created_at || undefined,
  };
}

async function fetchPublishedCases(
  locale: Locale = "zh-CN"
): Promise<DisplayCaseItem[] | null> {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const query = supabase
      .from("cases")
      .select(
        "id, slug, title, category, source_platform, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, creator_name, summary, prompt_preview, prompt_full, content_locale, translations, translation_status, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, evidence_level, tags, created_at"
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    const { data, error } = await withTimeout(query);

    if (error || !data || data.length === 0) {
      return null;
    }

    const rows = data as DbCaseRow[];
    const items = await Promise.all(
      rows.map((item) => mapDbCaseRowToCaseItem(item, locale))
    );
    return enrichCaseItems(items, locale);
  } catch {
    // Supabase timeout — fall through to return null (caller uses mock data)
    return null;
  }
}

export async function getCaseListData(
  filter: CaseFilter = "all",
  locale: Locale = "zh-CN"
) {
  const fromDb = await fetchPublishedCases(locale);
  if (fromDb) {
    return applyCaseFilter(fromDb, filter);
  }

  return applyCaseFilter(enrichCaseItems(caseItems, locale), filter);
}

export async function getCaseDetailData(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const fromDb = await fetchPublishedCases(locale);
  if (fromDb) {
    return fromDb.find((item) => item.slug === slug) || null;
  }

  return enrichCaseItems(caseItems, locale).find((item) => item.slug === slug) || null;
}

export async function getCaseDetailPageData(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const list = (await fetchPublishedCases(locale)) || enrichCaseItems(caseItems, locale);
  const item = list.find((candidate) => candidate.slug === slug) || null;

  if (!item) {
    return {
      item: null,
      creator: null,
      relatedCases: [],
      caseSkills: [],
      relatedCaseSkills: new Map(),
    };
  }

  const creators = deriveCreatorsFromCases(list, locale);
  const skillCatalog = deriveSkillCatalog(list, locale);
  const relatedCases = getRelatedCases(item, list);

  return {
    item,
    creator: findCreatorByName(creators, item.creator),
    relatedCases,
    caseSkills: getCaseSkillLinks(skillCatalog, item.slug, true),
    relatedCaseSkills: new Map(
      relatedCases.map((relatedCase) => [
        relatedCase.slug,
        getCaseSkillLinks(skillCatalog, relatedCase.slug),
      ])
    ),
  };
}

export async function getCaseSlugs(): Promise<string[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return caseItems.map((item) => item.slug);
  }

  const { data, error } = await withTimeout(
    supabase.from("cases").select("slug").eq("is_published", true),
    12_000
  );
  if (error) {
    throw new Error(`Failed to load sitemap case slugs: ${error.message}`);
  }

  return (data || [])
    .map((item) => item.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

export async function getHomeData(locale: Locale = "zh-CN") {
  const list = await getCaseListData("all", locale);
  const creators = deriveCreatorsFromCases(list, locale);

  const featuredCase = list[0] || enrichCaseItem(caseItems[0], locale);
  const spread = [...list]
    .filter((item) => item.spreadScore !== null)
    .sort((a, b) => (b.spreadScore ?? -1) - (a.spreadScore ?? -1))
    .slice(0, 10);
  const sourceHeat = [...list]
    .filter((item) => item.sourceHeatScore !== null)
    .sort(
      (a, b) =>
        (b.sourceHeatScore ?? -1) - (a.sourceHeatScore ?? -1) ||
        (b.sourceWeightedInteractionCount ?? -1) -
          (a.sourceWeightedInteractionCount ?? -1)
    )
    .slice(0, 10);
  const stability = [...list]
    .filter((item) => hasMeasuredStability(item.stabilityScore))
    .sort((a, b) => b.stabilityScore - a.stabilityScore)
    .slice(0, 10);

  return {
    featuredCase,
    totalCaseCount: list.length,
    totalCreatorCount: creators.length,
    featuredCreators: creators.slice(0, 4),
    spreadLeaderboard: spread,
    sourceHeatLeaderboard: sourceHeat,
    stabilityLeaderboard: stability,
  };
}

export async function getCreatorListData(locale: Locale = "zh-CN") {
  const list = await getCaseListData("all", locale);
  return deriveCreatorsFromCases(list, locale);
}

export async function getCreatorDetailData(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const creators = await getCreatorListData(locale);
  return findCreatorBySlug(creators, slug);
}

export async function getCreatorDetailPageData(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const list =
    (await fetchPublishedCases(locale)) || enrichCaseItems(caseItems, locale);
  const creators = deriveCreatorsFromCases(list, locale);
  const creator = findCreatorBySlug(creators, slug);

  if (!creator) {
    return {
      creator: null,
      methods: [],
      representativeCaseSkills: new Map(),
    };
  }

  const skillCatalog = deriveSkillCatalog(list, locale);
  return {
    creator,
    methods: getCreatorMethods(skillCatalog, creator.name),
    representativeCaseSkills: new Map(
      creator.representativeCases.map((item) => [
        item.slug,
        getCaseSkillLinks(skillCatalog, item.slug),
      ])
    ),
  };
}

export async function getSkillCatalogData(locale: Locale = "zh-CN") {
  const list =
    (await fetchPublishedCases(locale)) || enrichCaseItems(caseItems, locale);
  return deriveSkillCatalog(list, locale);
}

export async function getSkillDetailData(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const catalog = await getSkillCatalogData(locale);
  return findSkillBySlug(catalog, slug);
}

export async function getSkillSlugs() {
  const catalog = await getSkillCatalogData();
  return catalog.allSkills.map((skill) => skill.slug);
}

export async function getCreatorForCase(
  slug: string,
  locale: Locale = "zh-CN"
) {
  const [item, creators] = await Promise.all([
    getCaseDetailData(slug, locale),
    getCreatorListData(locale),
  ]);

  if (!item) {
    return null;
  }

  return findCreatorByName(creators, item.creator);
}

export type { CreatorItem };
