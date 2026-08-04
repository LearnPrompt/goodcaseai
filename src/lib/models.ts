import type { Locale } from "@/i18n/config";

export type ModelMedia = "image" | "video" | "web";

export type ModelBadge = "new" | "hot";

export type ModelFamily = {
  /** URL 片段，改动会影响外链和 sitemap，不要随意重命名。 */
  slug: string;
  label: string;
  labelEn?: string;
  media: ModelMedia;
  /**
   * 用来匹配 case.recommendedModels 的小写关键词。
   * 线上数据里同一个模型有多种写法（gpt image 2 / gpt-image-2 / gemini-omni），
   * 所以这里必须人工维护，不能直接拿原始字段渲染。
   */
  aliases: string[];
  badge?: ModelBadge;
};

/**
 * 首页模型栏的硬上限。
 * 按线上 314 条已发布 Case 实测：前 5 个模型覆盖 77%，前 6 个 79%，前 7 个 80%，
 * 第 7 个之后边际收益为零。所以这里把克制写进代码——注册表里写再多，首页也只渲染前 6 个。
 */
export const HOME_MODEL_STRIP_LIMIT = 6;

/**
 * 按案例数排序。新模型发布时把它插到对应位置并打上 badge: "new" 即可，
 * 首页栏、/cases?model=、/models/<slug> 和 sitemap 会自动跟上。
 * 新模型刚发布、案例数还没起来时，可以临时把它置顶并打 badge: "new"，
 * 等案例数追上来了再挪回按数量排序该在的位置。
 */
export const MODEL_FAMILIES: ModelFamily[] = [
  {
    slug: "seedance-2-5",
    label: "Seedance 2.5",
    media: "video",
    aliases: ["seedance 2.5", "seedance-2.5", "seedance2.5"],
    badge: "new",
  },
  // seedance 的 aliases 必须写全版本号——只写 "seedance" 会把 2.0 和 2.5 都匹配上，
  // 两个模型页就会互相串案例。
  {
    slug: "seedance-2",
    label: "Seedance 2.0",
    media: "video",
    aliases: ["seedance 2.0", "seedance-2.0", "seedance2.0"],
    badge: "hot",
  },
  {
    slug: "gpt-image-2",
    label: "GPT Image 2",
    media: "image",
    aliases: ["gpt image 2", "gpt-image-2", "gptimage2"],
    badge: "hot",
  },
  {
    slug: "gemini",
    label: "Gemini",
    media: "web",
    aliases: ["gemini"],
  },
  {
    slug: "nano-banana-pro",
    label: "Nano Banana Pro",
    media: "image",
    aliases: ["nano banana"],
  },
  {
    slug: "claude",
    label: "Claude",
    media: "web",
    aliases: ["claude"],
  },
  {
    slug: "grok-imagine",
    label: "Grok Imagine",
    media: "video",
    aliases: ["grok imagine", "grok-imagine"],
  },
  {
    slug: "veo",
    label: "Veo",
    media: "video",
    aliases: ["veo"],
  },
  {
    slug: "kling",
    label: "Kling 可灵",
    labelEn: "Kling",
    media: "video",
    aliases: ["kling", "可灵"],
  },
  {
    slug: "qwen-image",
    label: "Qwen Image",
    media: "image",
    aliases: ["qwen"],
  },
  {
    slug: "gpt-image-1-5",
    label: "GPT Image 1.5",
    media: "image",
    aliases: ["gpt image 1.5", "gpt-image-1.5"],
  },
];

export function getModelFamily(slug: string | undefined | null) {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return MODEL_FAMILIES.find((family) => family.slug === normalized);
}

export function getModelLabel(family: ModelFamily, locale: Locale) {
  return locale === "en" ? family.labelEn || family.label : family.label;
}

type ModelMatchable = { recommendedModels?: string[] | null };

function joinModels(item: ModelMatchable) {
  return (item.recommendedModels ?? []).join(" | ").toLowerCase();
}

export function caseMatchesModel(item: ModelMatchable, family: ModelFamily) {
  const joined = joinModels(item);
  if (!joined) return false;
  return family.aliases.some((alias) => joined.includes(alias));
}

export function filterCasesByModel<T extends ModelMatchable>(
  list: T[],
  slug: string | undefined | null
): T[] {
  const family = getModelFamily(slug);
  if (!family) return list;
  return list.filter((item) => caseMatchesModel(item, family));
}

export type ModelStripItem = {
  family: ModelFamily;
  label: string;
  count: number;
};

/** 注册表里所有有案例的模型，按注册顺序返回。 */
export function getModelBrowseItems<T extends ModelMatchable>(
  list: T[],
  locale: Locale
): ModelStripItem[] {
  return MODEL_FAMILIES.map((family) => ({
    family,
    label: getModelLabel(family, locale),
    count: list.filter((item) => caseMatchesModel(item, family)).length,
  })).filter((item) => item.count > 0);
}

/** 首页那一条：只取前 HOME_MODEL_STRIP_LIMIT 个。 */
export function getHomeModelStripItems<T extends ModelMatchable>(
  list: T[],
  locale: Locale
): ModelStripItem[] {
  return getModelBrowseItems(list, locale).slice(0, HOME_MODEL_STRIP_LIMIT);
}
