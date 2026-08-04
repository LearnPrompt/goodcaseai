import "server-only";

import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import {
  PUBLIC_TRAFFIC_EVENTS,
  summarizeCaseHealth,
  summarizeOperatorAnalytics,
  type OperatorAnalyticsRow,
  type OperatorCaseHealthRow,
} from "@/lib/operator/metrics";
import type { OperatorQuery } from "@/lib/operator/query";

export type OperatorFeedback = {
  id: string;
  kind: string;
  message: string;
  contact: string | null;
  page: string | null;
  status: string;
  created_at: string;
};

export type OperatorCandidate = {
  id: string;
  slug: string;
  title: string;
  category: string;
  source_platform: string | null;
  source_url: string | null;
  creator_name: string | null;
  summary: string;
  prompt_preview: string | null;
  prompt_full: string | null;
  // 可空：候选还没补 Prompt 时没有判定依据，语言留空，发布阶段再定。
  content_locale: "zh-CN" | "en" | null;
  translations: Record<
    string,
    {
      title?: string;
      summary?: string;
      promptFull?: string;
    }
  >;
  translation_status: "untranslated" | "machine_draft" | "confirmed";
  media_kind: string | null;
  media_url: string;
  poster_url: string | null;
  evidence_level: string;
  tags: string[];
  status: string;
  submitted_via: string | null;
  contact: string | null;
  import_batch_id: string | null;
  review_note: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;
const candidateFields =
  "id, slug, title, category, source_platform, source_url, creator_name, summary, prompt_preview, prompt_full, content_locale, translations, translation_status, media_kind, media_url, poster_url, evidence_level, tags, status, submitted_via, contact, import_batch_id, review_note, created_at";
const feedbackFields = "id, kind, message, contact, page, status, created_at";

function candidateCountQuery(status: string) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 服务端配置不可用");
  }
  return supabase
    .from("case_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
}

function feedbackCountQuery(status: string) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 服务端配置不可用");
  }
  return supabase
    .from("feedback_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
}

export async function getOperatorInbox(filters: OperatorQuery) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 服务端配置不可用");
  }

  const offset = (filters.page - 1) * PAGE_SIZE;

  let candidatesQuery = supabase
    .from("case_candidates")
    .select(candidateFields, { count: "exact" })
    .eq("status", filters.status);

  if (filters.category !== "all") {
    candidatesQuery = candidatesQuery.eq("category", filters.category);
  }
  if (filters.origin === "web") {
    candidatesQuery = candidatesQuery.eq("submitted_via", "web");
  } else if (filters.origin === "import") {
    candidatesQuery = candidatesQuery.or(
      "submitted_via.is.null,submitted_via.neq.web"
    );
  }
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    candidatesQuery = candidatesQuery.or(
      `title.ilike.${pattern},creator_name.ilike.${pattern},source_platform.ilike.${pattern},import_batch_id.ilike.${pattern}`
    );
  }

  candidatesQuery = candidatesQuery
    .order("created_at", { ascending: filters.status === "approved" })
    .range(offset, offset + PAGE_SIZE - 1);

  const feedbackQuery = supabase
    .from("feedback_messages")
    .select(feedbackFields, { count: "exact" })
    .eq("status", filters.feedbackStatus)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const selectedCandidateQuery = filters.candidateId
    ? supabase
        .from("case_candidates")
        .select(candidateFields)
        .eq("id", filters.candidateId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    pendingCount,
    approvedCount,
    rejectedCount,
    publishedCount,
    openFeedbackCount,
    resolvedFeedbackCount,
    archivedFeedbackCount,
    candidatesResult,
    feedbackResult,
    selectedCandidateResult,
    analyticsResult,
    caseHealthResult,
  ] = await Promise.all([
    candidateCountQuery("pending"),
    candidateCountQuery("approved"),
    candidateCountQuery("rejected"),
    candidateCountQuery("published"),
    feedbackCountQuery("open"),
    feedbackCountQuery("resolved"),
    feedbackCountQuery("archived"),
    candidatesQuery,
    feedbackQuery,
    selectedCandidateQuery,
    supabase
      .from("analytics_events")
      .select("event_name, path, referrer, anonymous_session_id, created_at")
      .in("event_name", [...PUBLIC_TRAFFIC_EVENTS])
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("cases")
      .select("is_published, evidence_level, stability_score"),
  ]);

  const countError =
    pendingCount.error ||
    approvedCount.error ||
    rejectedCount.error ||
    publishedCount.error ||
    openFeedbackCount.error ||
    resolvedFeedbackCount.error ||
    archivedFeedbackCount.error;
  if (countError) {
    throw new Error(`读取运营计数失败：${countError.message}`);
  }
  if (candidatesResult.error || selectedCandidateResult.error) {
    throw new Error(
      `读取候选失败：${
        candidatesResult.error?.message || selectedCandidateResult.error?.message
      }`
    );
  }
  if (feedbackResult.error) {
    throw new Error(`读取反馈失败：${feedbackResult.error.message}`);
  }
  if (analyticsResult.error || caseHealthResult.error) {
    throw new Error(
      `读取运营指标失败：${
        analyticsResult.error?.message || caseHealthResult.error?.message
      }`
    );
  }

  const candidateTotal = candidatesResult.count ?? 0;
  const feedbackTotal = feedbackResult.count ?? 0;
  const analytics = summarizeOperatorAnalytics(
    (analyticsResult.data ?? []) as OperatorAnalyticsRow[]
  );
  const caseHealth = summarizeCaseHealth(
    (caseHealthResult.data ?? []) as OperatorCaseHealthRow[]
  );

  return {
    candidates: (candidatesResult.data ?? []) as OperatorCandidate[],
    selectedCandidate:
      (selectedCandidateResult.data as OperatorCandidate | null) ?? null,
    feedback: (feedbackResult.data ?? []) as OperatorFeedback[],
    analytics,
    caseHealth,
    counts: {
      candidates: {
        pending: pendingCount.count ?? 0,
        approved: approvedCount.count ?? 0,
        rejected: rejectedCount.count ?? 0,
        published: publishedCount.count ?? 0,
      },
      feedback: {
        open: openFeedbackCount.count ?? 0,
        resolved: resolvedFeedbackCount.count ?? 0,
        archived: archivedFeedbackCount.count ?? 0,
      },
    },
    pagination: {
      page: filters.page,
      pageSize: PAGE_SIZE,
      candidateTotal,
      candidatePages: Math.max(1, Math.ceil(candidateTotal / PAGE_SIZE)),
      feedbackTotal,
      feedbackPages: Math.max(1, Math.ceil(feedbackTotal / PAGE_SIZE)),
    },
  };
}
