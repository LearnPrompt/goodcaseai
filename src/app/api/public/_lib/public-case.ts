import type { DisplayCaseItem } from "@/lib/cases";
import { SITE_ORIGIN } from "@/lib/site";

export const PUBLIC_API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
} as const;

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

export function toPublicListItem(item: DisplayCaseItem) {
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
    url: `${SITE_ORIGIN}/cases/${item.slug}`,
  };
}

export function toPublicDetailItem(item: DisplayCaseItem) {
  return {
    ...toPublicListItem(item),
    promptFull: item.promptFull,
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
