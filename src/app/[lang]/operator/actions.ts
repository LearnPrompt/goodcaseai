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
} from "../../../../scripts/review/lib/review-candidate.mjs";
import {
  buildCasePayload,
  decidePublish,
  validatePublishCandidate,
} from "../../../../scripts/review/lib/publish-candidate.mjs";

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
  return value === "/operator" ||
    value.startsWith("/operator?") ||
    value === "/en/operator" ||
    value.startsWith("/en/operator?")
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

function isEnglishReturnTo(returnTo: string) {
  return returnTo === "/en/operator" || returnTo.startsWith("/en/operator?");
}

function localizedMessage(returnTo: string, zh: string, en: string) {
  return isEnglishReturnTo(returnTo) ? en : zh;
}

function translateOperatorError(message: string) {
  const exact: Record<string, string> = {
    记录编号无效: "Invalid record ID",
    操作失败: "Action failed",
    运营数据库不可用: "Operator database is unavailable",
    反馈状态无效: "Invalid feedback status",
    反馈不存在: "Feedback record not found",
    候选不存在: "Candidate not found",
    候选状态已变化: "Candidate status has changed",
    翻译语言无效: "Invalid translation language",
    翻译状态无效: "Invalid translation status",
    确认译文前必须填写标题和摘要:
      "A translated title and summary are required before confirmation",
    目标语言不能与原文语言相同:
      "The target language must differ from the source language",
    "候选状态已变化，可安全重试":
      "Candidate status has changed; it is safe to retry",
    "发布 Case 失败": "Failed to publish case",
    "action 必须是 approve 或 reject":
      "Action must be approve or reject",
    "审核备注至少 3 个字符":
      "Review notes must contain at least 3 characters",
    "批准公开必须明确 evidence-level=L1 或 L2":
      "Approval requires evidence level L1 or L2",
    "缺少可访问的 http(s) 原始来源 source_url":
      "An accessible HTTP(S) source URL is required",
    "缺少作者 creator_name": "Creator name is required",
    标题过短: "Title is too short",
    "摘要不足，无法解释为什么值得收录":
      "The summary does not explain why this case is worth keeping",
    "缺少公开 Prompt 或可复现方法":
      "A public prompt or reproducible method is required",
    "缺少可公开展示的真实媒体，不能使用占位图":
      "A real public media asset is required; placeholders are not accepted",
    "发布必须是 L1 或 L2 证据":
      "Publishing requires evidence level L1 or L2",
    "发布前必须人工确认双语内容":
      "Bilingual content must be human-confirmed before publishing",
    "原始来源必须是 http(s) URL":
      "The original source must be an HTTP(S) URL",
    缺少有效原始来源: "A valid original source is required",
    缺少真实媒体: "A real media asset is required",
    摘要不足: "The summary is too short",
    "同 slug Case 已存在；默认不会覆盖":
      "A case with this slug already exists and will not be overwritten",
    "同 slug Case 已绑定其他候选，禁止改绑":
      "A case with this slug belongs to another candidate and cannot be reassigned",
  };
  if (exact[message]) {
    return exact[message];
  }
  if (message.startsWith("只有 pending 候选可审核，当前状态=")) {
    return `Only pending candidates can be reviewed; current status=${message.slice(
      "只有 pending 候选可审核，当前状态=".length
    )}`;
  }
  if (message.startsWith("只有 approved 候选可发布，当前状态=")) {
    return `Only approved candidates can be published; current status=${message.slice(
      "只有 approved 候选可发布，当前状态=".length
    )}`;
  }
  if (message.startsWith("审计记录失败：")) {
    return `Audit log failed: ${message.slice("审计记录失败：".length)}`;
  }
  return message;
}

function errorMessage(error: unknown, returnTo: string) {
  const message =
    error instanceof Error ? error.message.slice(0, 180) : "操作失败";
  if (!isEnglishReturnTo(returnTo)) {
    return message;
  }

  return message
    .split("；")
    .map((part) => translateOperatorError(part))
    .join("; ");
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
    finish(errorMessage(error, returnTo), "error", returnTo);
  }

  finish(
    localizedMessage(returnTo, "反馈状态已更新", "Feedback status updated"),
    "success",
    returnTo
  );
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
    finish(errorMessage(error, returnTo), "error", returnTo);
  }

  finish(
    localizedMessage(
      returnTo,
      "候选审核状态已更新",
      "Candidate review status updated"
    ),
    "success",
    returnTo
  );
}

export async function updateCandidateTranslation(formData: FormData) {
  const operator = await requireOperatorIdentity();
  const returnTo = readReturnTo(formData);

  try {
    const id = readUuid(formData, "id");
    const targetLocale = readString(formData, "targetLocale", 16);
    const status = readString(formData, "translationStatus", 32);
    const title = readString(formData, "translatedTitle", 160);
    const summary = readString(formData, "translatedSummary", 4000);
    const promptFull = readString(formData, "translatedPrompt", 20_000);

    if (!["zh-CN", "en"].includes(targetLocale)) {
      throw new Error("翻译语言无效");
    }
    if (!["untranslated", "machine_draft", "confirmed"].includes(status)) {
      throw new Error("翻译状态无效");
    }
    if (status === "confirmed" && (!title || !summary)) {
      throw new Error("确认译文前必须填写标题和摘要");
    }

    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      throw new Error("运营数据库不可用");
    }

    const { data: candidate, error: fetchError } = await supabase
      .from("case_candidates")
      .select("id, content_locale, translations")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !candidate) {
      throw new Error(fetchError?.message || "候选不存在");
    }
    if (candidate.content_locale === targetLocale) {
      throw new Error("目标语言不能与原文语言相同");
    }

    const currentTranslations =
      candidate.translations &&
      typeof candidate.translations === "object" &&
      !Array.isArray(candidate.translations)
        ? candidate.translations
        : {};
    const translations = {
      ...currentTranslations,
      [targetLocale]: {
        title,
        summary,
        promptFull,
      },
    };

    const { data: updated, error: updateError } = await supabase
      .from("case_candidates")
      .update({
        translations,
        translation_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (updateError || !updated) {
      throw new Error(updateError?.message || "候选不存在");
    }

    await audit(operator.id, "candidate.translation.updated", "candidate", id, {
      targetLocale,
      status,
    });
    revalidatePath("/operator");
    revalidatePath("/en/operator");
  } catch (error) {
    finish(errorMessage(error, returnTo), "error", returnTo);
  }

  finish(
    localizedMessage(returnTo, "候选译文已保存", "Candidate translation saved"),
    "success",
    returnTo
  );
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
        "id, status, slug, title, category, source_platform, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, creator_name, summary, prompt_preview, prompt_full, content_locale, translations, translation_status, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, evidence_level, tags"
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
    finish(errorMessage(error, returnTo), "error", returnTo);
  }

  finish(
    localizedMessage(returnTo, "Case 已发布", "Case published"),
    "success",
    returnTo
  );
}

export async function signOutOperator(formData: FormData) {
  const returnTo = readString(formData, "returnTo", 100);
  const cookieStore = await cookies();
  cookieStore.delete(OPERATOR_SESSION_COOKIE);
  const supabase = await getAuthSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect(returnTo === "/en/operator/login" ? returnTo : "/operator/login");
}
