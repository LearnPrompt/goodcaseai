import type { Locale } from "@/i18n/config";

/**
 * cases 表的三档取数。
 *
 * 背景：过去每个页面都跑同一条「全表全列」查询（314 行、gzip 后约 783KB）。
 * Supabase 免费额度 Egress 只有 5GB/月，按每天 1k 次冷渲染算根本不够。
 * 真正的浪费是取数粒度而不是列宽，所以这里按用途分成三档：
 *
 * - index：全表，只留排序 / 聚合 / 派生要用的字段。不含 summary、prompt、媒体、译文正文。
 *   来源热度是「全库百分位」，创作者聚合、Skill 目录、相关案例挑选也都要看全库，
 *   这些语义只有拿到全表才能保持不变，所以这一档必须全量，但要足够瘦。
 * - card：真正渲染成卡片的那些行。在 index 基础上补 summary、prompt 预览、媒体和译文预览。
 * - detail：详情页单行，全列。
 */

/** 卡片上的提示语只显示 2–3 行；库里 prompt_preview 也是按 240 截断的，译文对齐同一长度。 */
export const PROMPT_PREVIEW_LIMIT = 240;

/** 迁移新增的库侧截断列。迁移没跑时这两列不存在，取数层会自动降级。 */
export const GENERATED_PREVIEW_COLUMNS = [
  "prompt_preview_zh",
  "prompt_preview_en",
] as const;

/** 三档共用的基础列：排序、聚合、派生都只依赖这些。 */
const INDEX_COLUMNS = [
  "slug",
  "title",
  "category",
  "source_platform",
  "source_url",
  "source_like_count",
  "source_comment_count",
  "source_share_count",
  "source_save_count",
  "source_published_at",
  "source_metrics_captured_at",
  "creator_name",
  "creator_avatar_url",
  "content_locale",
  "remake_count",
  "stability_score",
  "favorite_score",
  "recommended_models",
  "cost_band",
  "evidence_level",
  "tags",
  "created_at",
] as const;

/** card 档在 index 之上追加的列。 */
const CARD_EXTRA_COLUMNS = [
  "summary",
  "prompt_preview",
  "media_kind",
  "media_url",
  "poster_url",
] as const;

/** detail 档：单行取全列，译文整包带走。 */
const DETAIL_COLUMNS = [
  ...INDEX_COLUMNS,
  ...CARD_EXTRA_COLUMNS,
  "prompt_full",
  "translations",
] as const;

export const DETAIL_SELECT = DETAIL_COLUMNS.join(", ");

/**
 * PostgREST 支持带别名的 JSON 子字段 select，返回的 key 就是别名。
 * locale 里带连字符（zh-CN），直接写进路径即可。
 * `->>` 取文本，`->` 保留 JSON 结构（resultBreakdown 是数组，要用后者）。
 */
function translationText(alias: string, locale: Locale, key: string) {
  return `${alias}:translations->${locale}->>${key}`;
}

function translationJson(alias: string, locale: Locale, key: string) {
  return `${alias}:translations->${locale}->${key}`;
}

export function buildIndexSelect(locale: Locale) {
  // 标题在 en 下会被译文覆盖，而 Skill 目录的匹配规则直接读标题，
  // 所以 index 档也必须带上当前语种的译文标题，否则 /en 的 Skill 归类会变。
  return [...INDEX_COLUMNS, translationText("tr_title", locale, "title")].join(
    ", "
  );
}

export function buildCardSelect(
  locale: Locale,
  { generatedPreviewColumns }: { generatedPreviewColumns: boolean }
) {
  // 迁移跑过就直接取库侧截断列；没跑过就退回整段译文，由取数层在 JS 里截断。
  // 后者只是过渡形态，出网量和迁移前一样大。
  const promptTranslationColumns = generatedPreviewColumns
    ? [...GENERATED_PREVIEW_COLUMNS]
    : [
        translationText("prompt_preview_zh", "zh-CN", "promptFull"),
        translationText("prompt_preview_en", "en", "promptFull"),
      ];

  return [
    ...INDEX_COLUMNS,
    ...CARD_EXTRA_COLUMNS,
    translationText("tr_title", locale, "title"),
    translationText("tr_summary", locale, "summary"),
    ...promptTranslationColumns,
  ].join(", ");
}

/**
 * 卡片摘要兜底用的 resultBreakdown 单独取。
 * 309 条 Case 都带这个字段，整包拉过来 gzip 后还有 130KB；
 * 而它只在「摘要是自动生成的套话」时才会被用到（线上 12/314 条），
 * 所以按 slug 单独补一次，不进 card 档。
 */
export function buildResultBreakdownSelect(locale: Locale) {
  return [
    "slug",
    translationJson("tr_result_breakdown", locale, "resultBreakdown"),
  ].join(", ");
}

export type CaseIndexRow = {
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
  creator_avatar_url: string | null;
  content_locale: string | null;
  remake_count: number;
  stability_score: number;
  favorite_score: number;
  recommended_models: string[] | null;
  cost_band: string;
  evidence_level: string | null;
  tags: string[] | null;
  created_at: string | null;
  tr_title?: string | null;
};

export type CaseCardRow = CaseIndexRow & {
  summary?: string | null;
  prompt_preview?: string | null;
  media_kind?: string | null;
  media_url?: string | null;
  poster_url?: string | null;
  tr_summary?: string | null;
  prompt_preview_zh?: string | null;
  prompt_preview_en?: string | null;
};

export type CaseDetailRow = CaseCardRow & {
  prompt_full?: string | null;
  translations?: unknown;
};

/** 三档共用的行类型；缺席的字段一律 undefined，映射层据此决定兜底值。 */
export type CaseRow = CaseDetailRow & {
  /** 只有 buildResultBreakdownSelect 那次补取会带上。 */
  tr_result_breakdown?: unknown;
};

/** 列不存在时 PostgREST 报 42703 / PGRST204，用来判断迁移有没有跑过。 */
export function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  columns: readonly string[]
) {
  if (!error) {
    return false;
  }

  if (error.code !== "42703" && error.code !== "PGRST204") {
    return false;
  }

  const message = error.message || "";
  return columns.some((column) => message.includes(column));
}

export function truncatePromptPreview(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }

  return text.length > PROMPT_PREVIEW_LIMIT
    ? text.slice(0, PROMPT_PREVIEW_LIMIT)
    : text;
}
