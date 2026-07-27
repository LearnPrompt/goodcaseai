import type { DisplayCaseItem } from "@/lib/cases";
import type { Locale } from "@/i18n/config";
import { localizeHref } from "@/i18n/config";
import { getEnglishCaseTranslation } from "@/i18n/content";
import { SITE_ORIGIN } from "@/lib/site";

export function getPublicApiHeaders(locale: Locale) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Language": locale,
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    "Access-Control-Allow-Origin": "*",
    Vary: "Accept-Language",
  } as const;
}

export function toAbsoluteUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const normalized = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function toPublicListItem(item: DisplayCaseItem, locale: Locale) {
  const hasEnglishTranslation = Boolean(getEnglishCaseTranslation(item.slug));
  return {
    slug: item.slug,
    title: item.title,
    category: item.category,
    source: item.source,
    sourceUrl: item.sourceUrl || null,
    sourceLikeCount: item.sourceLikeCount ?? null,
    sourceCommentCount: item.sourceCommentCount ?? null,
    sourceShareCount: item.sourceShareCount ?? null,
    sourceSaveCount: item.sourceSaveCount ?? null,
    sourcePublishedAt: item.sourcePublishedAt || null,
    sourceMetricsCapturedAt: item.sourceMetricsCapturedAt || null,
    sourceInteractionCount: item.sourceInteractionCount,
    sourceWeightedInteractionCount: item.sourceWeightedInteractionCount,
    sourceInteractionVelocity: item.sourceInteractionVelocity,
    sourceMetricsCompleteness: item.sourceMetricsCompleteness,
    sourceHeatScore: item.sourceHeatScore,
    creator: item.creator,
    summary: item.summary,
    promptPreview: item.promptPreview,
    promptTranslationZh: item.promptTranslationZh?.slice(0, 240) || null,
    promptTranslationEn: item.promptTranslationEn?.slice(0, 240) || null,
    mediaType: item.mediaType,
    mediaUrl: toAbsoluteUrl(item.mediaUrl),
    posterUrl: toAbsoluteUrl(item.posterUrl),
    likedCount: item.likedCount,
    remakeCount: item.remakeCount,
    stabilityScore: item.stabilityScore,
    favoriteScore: item.favoriteScore,
    recommendedModels: item.recommendedModels,
    costBand: item.costBand,
    evidenceLevel: item.evidenceLevel || null,
    tags: item.tags || [],
    url: `${SITE_ORIGIN}${localizeHref(locale, `/cases/${item.slug}`)}`,
    contentLocale: item.contentLocale || "en",
    availableLocales: hasEnglishTranslation ? ["zh-CN", "en"] : ["zh-CN"],
    isFallback: locale === "en" && !hasEnglishTranslation,
  };
}

export function toPublicDetailItem(item: DisplayCaseItem, locale: Locale) {
  return {
    ...toPublicListItem(item, locale),
    promptFull: item.promptFull,
    promptTranslationZh: item.promptTranslationZh || null,
    promptTranslationEn: item.promptTranslationEn || null,
    spreadScore: item.spreadScore,
    spreadScoreNote: item.spreadScoreNote,
    sourceHeatNote: item.sourceHeatNote,
    promptPublicNote: item.promptPublicNote,
    promptLoginNotes: item.promptLoginNotes,
    promptContributionNotes: item.promptContributionNotes,
    editorNote: item.editorNote,
    labNote: item.labNote,
  };
}
