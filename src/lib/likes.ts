import type { SupabaseClient } from "@supabase/supabase-js";

export const LIKES_UPDATED_EVENT = "goodcaseai:likes-updated";

const caseIdCache = new Map<string, string>();

type CaseLikeState = {
  caseId: string | null;
  hasLiked: boolean;
  likedCount: number;
  error: string | null;
};

async function resolveCaseId(supabase: SupabaseClient, caseSlug: string) {
  const cached = caseIdCache.get(caseSlug);
  if (cached) {
    return { caseId: cached, error: null };
  }

  const { data, error } = await supabase
    .from("cases")
    .select("id")
    .eq("slug", caseSlug)
    .single();

  if (error) {
    return { caseId: null, error: error.message };
  }

  if (!data?.id) {
    return { caseId: null, error: "未找到对应案例。" };
  }

  caseIdCache.set(caseSlug, data.id);
  return { caseId: data.id, error: null };
}

export async function getCaseLikeState({
  supabase,
  caseSlug,
  userId,
  fallbackCount,
}: {
  supabase: SupabaseClient;
  caseSlug: string;
  userId: string | null;
  fallbackCount: number;
}): Promise<CaseLikeState> {
  const { caseId, error: resolveError } = await resolveCaseId(supabase, caseSlug);

  if (!caseId) {
    return {
      caseId: null,
      hasLiked: false,
      likedCount: fallbackCount,
      error: resolveError,
    };
  }

  const countResult = await supabase
    .from("case_likes")
    .select("case_id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const likedCount =
    countResult.error || countResult.count === null
      ? fallbackCount
      : countResult.count;

  if (!userId) {
    return {
      caseId,
      hasLiked: false,
      likedCount,
      error: countResult.error ? countResult.error.message : null,
    };
  }

  const likedResult = await supabase
    .from("case_likes")
    .select("case_id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("user_id", userId);

  return {
    caseId,
    hasLiked: !likedResult.error && (likedResult.count || 0) > 0,
    likedCount,
    error: likedResult.error
      ? likedResult.error.message
      : countResult.error
        ? countResult.error.message
        : null,
  };
}

export async function toggleCaseLike({
  supabase,
  caseSlug,
  userId,
  hasLiked,
  fallbackCount,
}: {
  supabase: SupabaseClient;
  caseSlug: string;
  userId: string;
  hasLiked: boolean;
  fallbackCount: number;
}) {
  const state = await getCaseLikeState({
    supabase,
    caseSlug,
    userId,
    fallbackCount,
  });

  if (!state.caseId) {
    return {
      ...state,
      hasLiked,
    };
  }

  if (state.hasLiked) {
    const { error } = await supabase
      .from("case_likes")
      .delete()
      .eq("case_id", state.caseId)
      .eq("user_id", userId);

    if (error) {
      return {
        ...state,
        error: error.message,
      };
    }
  } else {
    const { error } = await supabase.from("case_likes").insert({
      case_id: state.caseId,
      user_id: userId,
    });

    if (error) {
      return {
        ...state,
        error: error.message,
      };
    }
  }

  return getCaseLikeState({
    supabase,
    caseSlug,
    userId,
    fallbackCount,
  });
}
