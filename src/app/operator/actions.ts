"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOperatorIdentity } from "@/lib/operator/auth";
import { OPERATOR_SESSION_COOKIE } from "@/lib/operator/shared-session";
import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import { getAuthSupabaseClient } from "@/lib/supabase/auth-server-client";
import {
  buildReviewPatch,
  parseTags,
  validateReview,
} from "../../../scripts/review/lib/review-candidate.mjs";
import {
  buildCasePayload,
  decidePublish,
  validatePublishCandidate,
} from "../../../scripts/review/lib/publish-candidate.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readString(formData: FormData, name: string, maxLength = 2000) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readUuid(formData: FormData, name: string) {
  const value = readString(formData, name, 64);
  if (!UUID_PATTERN.test(value)) {
    throw new Error("记录编号无效");
  }
  return value;
}

function readReturnTo(formData: FormData) {
  const value = readString(formData, "returnTo", 1000);
  return value === "/operator" || value.startsWith("/operator?")
    ? value
    : "/operator";
}

function finish(
  message: string,
  type: "success" | "error" = "success",
  returnTo = "/operator"
): never {
  const params = new URLSearchParams({ notice: message, type });
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}${params.toString()}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : "操作失败";
}

async function audit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    throw new Error("运营数据库不可用");
  }

  const { error } = await supabase.from("analytics_events").insert({
    event_name: "operator_action",
    path: "/operator",
    anonymous_session_id: actorUserId,
    properties: {
      action,
      entityType,
      entityId,
      ...details,
    },
  });
  if (error) {
    throw new Error(`审计记录失败：${error.message}`);
  }
}

export async function updateFeedbackStatus(formData: FormData) {
  const operator = await requireOperatorIdentity();
  const returnTo = readReturnTo(formData);

  try {
    const id = readUuid(formData, "id");
    const status = readString(formData, "status", 16);
    if (!["open", "resolved", "archived"].includes(status)) {
      throw new Error("反馈状态无效");
    }

    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      throw new Error("运营数据库不可用");
    }

    const { data, error } = await supabase
      .from("feedback_messages")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message || "反馈不存在");
    }

    await audit(operator.id, `feedback.${status}`, "feedback", id, { status });
    revalidatePath("/operator");
  } catch (error) {
    finish(errorMessage(error), "error", returnTo);
  }

  finish("反馈状态已更新", "success", returnTo);
}

export async function reviewCandidate(formData: FormData) {
  const operator = await requireOperatorIdentity();
  const returnTo = readReturnTo(formData);

  try {
    const id = readUuid(formData, "id");
    const action = readString(formData, "decision", 16);
    const note = readString(formData, "note", 1000);
    const evidenceLevel = readString(formData, "evidenceLevel", 8);
    const tags = parseTags(readString(formData, "tags", 500));
    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      throw new Error("运营数据库不可用");
    }

    const { data: candidate, error: fetchError } = await supabase
      .from("case_candidates")
      .select(
        "id, status, title, creator_name, summary, prompt_preview, prompt_full, source_url, media_url, evidence_level, tags"
      )
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !candidate) {
      throw new Error(fetchError?.message || "候选不存在");
    }

    const input = { action, note, evidenceLevel, tags };
    const validation = validateReview(candidate, input);
    if (!validation.ok) {
      throw new Error(validation.errors.join("；"));
    }

    const reviewedAt = new Date().toISOString();
    const patch = buildReviewPatch(candidate, input, reviewedAt);
    const { data: updated, error: updateError } = await supabase
      .from("case_candidates")
      .update(patch)
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();
    if (updateError || !updated) {
      throw new Error(updateError?.message || "候选状态已变化");
    }

    await audit(operator.id, `candidate.${updated.status}`, "candidate", id, {
      evidenceLevel: action === "approve" ? evidenceLevel : null,
    });
    revalidatePath("/operator");
  } catch (error) {
    finish(errorMessage(error), "error", returnTo);
  }

  finish("候选审核状态已更新", "success", returnTo);
}

export async function publishCandidate(formData: FormData) {
  const operator = await requireOperatorIdentity();
  const returnTo = readReturnTo(formData);

  try {
    const id = readUuid(formData, "id");
    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      throw new Error("运营数据库不可用");
    }

    const { data: candidate, error: fetchError } = await supabase
      .from("case_candidates")
      .select(
        "id, status, slug, title, category, source_platform, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, evidence_level, tags"
      )
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !candidate) {
      throw new Error(fetchError?.message || "候选不存在");
    }

    const validation = validatePublishCandidate(candidate);
    if (!validation.ok) {
      throw new Error(validation.errors.join("；"));
    }

    const [{ data: existingByCandidate, error: candidateLookupError }, {
      data: existingBySlug,
      error: slugLookupError,
    }] = await Promise.all([
      supabase
        .from("cases")
        .select("id, slug, source_candidate_id")
        .eq("source_candidate_id", id)
        .maybeSingle(),
      supabase
        .from("cases")
        .select("id, slug, source_candidate_id")
        .eq("slug", candidate.slug)
        .maybeSingle(),
    ]);
    if (candidateLookupError || slugLookupError) {
      throw new Error(candidateLookupError?.message || slugLookupError?.message);
    }

    const decision = decidePublish({
      candidateId: id,
      existingByCandidate,
      existingBySlug,
      allowUpdate: false,
    });
    if (decision.action === "conflict") {
      throw new Error(decision.reason);
    }

    const payload = buildCasePayload(candidate);
    const caseResult =
      decision.action === "insert"
        ? await supabase.from("cases").insert(payload).select("id, slug").single()
        : await supabase
            .from("cases")
            .update(payload)
            .eq("id", decision.caseId)
            .select("id, slug")
            .single();
    if (caseResult.error || !caseResult.data) {
      throw new Error(caseResult.error?.message || "发布 Case 失败");
    }

    const publishedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("case_candidates")
      .update({
        status: "published",
        published_case_id: caseResult.data.id,
        published_at: publishedAt,
        updated_at: publishedAt,
      })
      .eq("id", id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();
    if (updateError || !updated) {
      throw new Error(updateError?.message || "候选状态已变化，可安全重试");
    }

    await audit(operator.id, "candidate.published", "candidate", id, {
      caseId: caseResult.data.id,
      mode: decision.action,
    });
    revalidatePath("/operator");
    revalidatePath("/cases");
    revalidatePath(`/cases/${candidate.slug}`);
  } catch (error) {
    finish(errorMessage(error), "error", returnTo);
  }

  finish("Case 已发布", "success", returnTo);
}

export async function signOutOperator() {
  const cookieStore = await cookies();
  cookieStore.delete(OPERATOR_SESSION_COOKIE);
  const supabase = await getAuthSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/operator/login");
}
