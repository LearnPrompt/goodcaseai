import "server-only";

import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";

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
  media_url: string;
  evidence_level: string;
  tags: string[];
  status: string;
  submitted_via: string | null;
  contact: string | null;
  import_batch_id: string | null;
  review_note: string | null;
  created_at: string;
};

export async function getOperatorInbox() {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase 服务端配置不可用");
  }

  const candidateFields =
    "id, slug, title, category, source_platform, source_url, creator_name, summary, prompt_preview, prompt_full, media_url, evidence_level, tags, status, submitted_via, contact, import_batch_id, review_note, created_at";

  const [
    openFeedbackResult,
    recentFeedbackResult,
    pendingCandidateResult,
    approvedCandidateResult,
  ] = await Promise.all([
    supabase
      .from("feedback_messages")
      .select("id, kind, message, contact, page, status, created_at", {
        count: "exact",
      })
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("feedback_messages")
      .select("id, kind, message, contact, page, status, created_at")
      .neq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("case_candidates")
      .select(candidateFields, { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("case_candidates")
      .select(candidateFields, { count: "exact" })
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  if (openFeedbackResult.error || recentFeedbackResult.error) {
    throw new Error(
      `读取反馈失败：${
        openFeedbackResult.error?.message || recentFeedbackResult.error?.message
      }`
    );
  }
  if (pendingCandidateResult.error || approvedCandidateResult.error) {
    throw new Error(
      `读取候选失败：${
        pendingCandidateResult.error?.message ||
        approvedCandidateResult.error?.message
      }`
    );
  }

  const feedback = [
    ...(openFeedbackResult.data ?? []),
    ...(recentFeedbackResult.data ?? []),
  ] as OperatorFeedback[];
  const candidates = [
    ...(approvedCandidateResult.data ?? []),
    ...(pendingCandidateResult.data ?? []),
  ] as OperatorCandidate[];

  return {
    feedback,
    candidates,
    counts: {
      openFeedback: openFeedbackResult.count ?? 0,
      pendingCandidates: pendingCandidateResult.count ?? 0,
      approvedCandidates: approvedCandidateResult.count ?? 0,
    },
  };
}
