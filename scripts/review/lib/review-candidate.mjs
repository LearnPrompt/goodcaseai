const REVIEW_ACTIONS = new Set(["approve", "reject"]);
const EVIDENCE_LEVELS = new Set(["L1", "L2"]);

function hasHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hasUsefulText(value, minimumLength = 2) {
  return typeof value === "string" && value.trim().length >= minimumLength;
}

function hasPublishableMedia(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const normalized = value.trim();
  return (
    normalized !== "/media/placeholder.png" &&
    (normalized.startsWith("/media/") || hasHttpUrl(normalized))
  );
}

export function parseTags(value) {
  if (!value) {
    return [];
  }

  return [...new Set(
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )].slice(0, 20);
}

export function validateReview(candidate, input) {
  const errors = [];
  const action = input.action;
  const note = typeof input.note === "string" ? input.note.trim() : "";

  if (!REVIEW_ACTIONS.has(action)) {
    errors.push("action 必须是 approve 或 reject");
  }

  if (candidate.status !== "pending") {
    errors.push(`只有 pending 候选可审核，当前状态=${candidate.status || "unknown"}`);
  }

  if (note.length < 3) {
    errors.push("审核备注至少 3 个字符");
  }

  if (action === "approve") {
    const evidenceLevel = input.evidenceLevel || candidate.evidence_level;
    if (!EVIDENCE_LEVELS.has(evidenceLevel)) {
      errors.push("批准公开必须明确 evidence-level=L1 或 L2");
    }
    if (!hasHttpUrl(candidate.source_url)) {
      errors.push("缺少可访问的 http(s) 原始来源 source_url");
    }
    if (!hasUsefulText(candidate.creator_name)) {
      errors.push("缺少作者 creator_name");
    }
    if (!hasUsefulText(candidate.title, 4)) {
      errors.push("标题过短");
    }
    if (!hasUsefulText(candidate.summary, 12)) {
      errors.push("摘要不足，无法解释为什么值得收录");
    }
    if (
      !hasUsefulText(candidate.prompt_full, 12) &&
      !hasUsefulText(candidate.prompt_preview, 12)
    ) {
      errors.push("缺少公开 Prompt 或可复现方法");
    }
    if (!hasPublishableMedia(candidate.media_url)) {
      errors.push("缺少可公开展示的真实媒体，不能使用占位图");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildReviewPatch(candidate, input, reviewedAt) {
  const tags = input.tags?.length ? input.tags : candidate.tags || [];
  const patch = {
    status: input.action === "approve" ? "approved" : "rejected",
    review_note: input.note.trim(),
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
    tags,
  };

  if (input.action === "approve") {
    patch.evidence_level = input.evidenceLevel || candidate.evidence_level;
  }

  return patch;
}
