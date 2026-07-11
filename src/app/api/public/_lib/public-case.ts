import type { DisplayCaseItem } from "@/lib/cases";

const SITE_ORIGIN = "https://goodcase.ai";

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
    url: `${SITE_ORIGIN}/cases/${item.slug}`,
  };
}

export function toPublicDetailItem(item: DisplayCaseItem) {
  return {
    ...toPublicListItem(item),
    promptFull: item.promptFull,
    spreadScore: item.spreadScore,
    spreadScoreNote: item.spreadScoreNote,
    promptPublicNote: item.promptPublicNote,
    promptLoginNotes: item.promptLoginNotes,
    promptContributionNotes: item.promptContributionNotes,
    editorNote: item.editorNote,
    labNote: item.labNote,
  };
}
