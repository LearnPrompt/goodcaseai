import { access } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  caseItems,
  favoriteLeaderboard,
  stabilityLeaderboard,
  type CaseItem,
} from "@/lib/mock-data";

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
};

const MEDIA_PLACEHOLDER = "/media/placeholder.png";

export type CaseFilter = "all" | "video" | "web" | "image";

function applyCaseFilter(list: CaseItem[], filter: CaseFilter) {
  if (filter === "all") {
    return list;
  }

  return list.filter((item) => item.category === filter);
}

function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

async function getLikeCountByCaseId(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  caseId: string
) {
  if (!supabase) {
    return 0;
  }

  const result = await supabase
    .from("case_likes")
    .select("case_id", { count: "exact", head: true })
    .eq("case_id", caseId);

  if (result.error || result.count === null) {
    return 0;
  }

  return result.count;
}

async function mapDbCaseRowToCaseItem(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  row: DbCaseRow
): Promise<CaseItem> {
  const likedCount = await getLikeCountByCaseId(supabase, row.id);
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
  };
}

async function fetchPublishedCases(filter: CaseFilter = "all"): Promise<CaseItem[] | null> {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  let query = supabase
    .from("cases")
    .select(
      "id, slug, title, category, source_platform, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band"
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

  return Promise.all(
    (data as DbCaseRow[]).map((item) => mapDbCaseRowToCaseItem(supabase, item))
  );
}

export async function getCaseListData(filter: CaseFilter = "all") {
  const fromDb = await fetchPublishedCases(filter);
  return fromDb || applyCaseFilter(caseItems, filter);
}

export async function getCaseDetailData(slug: string) {
  const supabase = getServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("cases")
      .select(
        "id, slug, title, category, source_platform, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band"
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (!error && data) {
      return mapDbCaseRowToCaseItem(supabase, data as DbCaseRow);
    }
  }

  return caseItems.find((item) => item.slug === slug) || null;
}

export async function getCaseSlugs() {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return caseItems.map((item) => item.slug);
  }

  const { data, error } = await supabase
    .from("cases")
    .select("slug")
    .eq("is_published", true);

  if (error || !data || data.length === 0) {
    return caseItems.map((item) => item.slug);
  }

  return data
    .map((item) => item.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

export async function getHomeData() {
  const list = await getCaseListData();

  const featuredCase = list[0] || caseItems[0];
  const favorite = [...list].sort((a, b) => b.favoriteScore - a.favoriteScore).slice(0, 10);
  const stability = [...list].sort((a, b) => b.stabilityScore - a.stabilityScore).slice(0, 10);

  return {
    featuredCase,
    favoriteLeaderboard: favorite.length > 0 ? favorite : favoriteLeaderboard,
    stabilityLeaderboard: stability.length > 0 ? stability : stabilityLeaderboard,
  };
}
