function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  if (!hasText(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function nonNegativeMetric(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function sourceInteractionCount(candidate) {
  return (
    nonNegativeMetric(candidate.source_like_count) +
    nonNegativeMetric(candidate.source_comment_count) +
    nonNegativeMetric(candidate.source_share_count) +
    nonNegativeMetric(candidate.source_save_count)
  );
}

export function reviewReadinessIssues(candidate) {
  const issues = [];

  if (candidate.status !== "pending") {
    issues.push("status");
  }
  if (candidate.evidence_level !== "L1" && candidate.evidence_level !== "L2") {
    issues.push("evidence_level");
  }
  if (!hasText(candidate.title)) {
    issues.push("title");
  }
  if (!hasText(candidate.creator_name)) {
    issues.push("creator_name");
  }
  if (!hasText(candidate.summary)) {
    issues.push("summary");
  }
  if (!hasText(candidate.prompt_full) && !hasText(candidate.prompt_preview)) {
    issues.push("prompt");
  }
  if (!isHttpUrl(candidate.source_url)) {
    issues.push("source_url");
  }
  if (!isHttpUrl(candidate.media_url)) {
    issues.push("media_url");
  }

  return issues;
}

export function buildDailyReviewQueue(
  candidates,
  { limit = 20, maxPerCreator = 2 } = {}
) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit 必须是正整数。");
  }
  if (!Number.isInteger(maxPerCreator) || maxPerCreator < 1) {
    throw new Error("maxPerCreator 必须是正整数。");
  }

  const pending = candidates.filter((candidate) => candidate.status === "pending");
  const ready = pending
    .filter((candidate) => reviewReadinessIssues(candidate).length === 0)
    .sort((left, right) => {
      const interactionDelta =
        sourceInteractionCount(right) - sourceInteractionCount(left);
      if (interactionDelta !== 0) {
        return interactionDelta;
      }

      const capturedDelta = String(
        right.source_metrics_captured_at || ""
      ).localeCompare(String(left.source_metrics_captured_at || ""));
      if (capturedDelta !== 0) {
        return capturedDelta;
      }

      return String(left.id || left.source_url).localeCompare(
        String(right.id || right.source_url)
      );
    });

  const creatorCounts = new Map();
  const rows = [];

  for (const candidate of ready) {
    const creatorKey = candidate.creator_name.trim().toLocaleLowerCase();
    const creatorCount = creatorCounts.get(creatorKey) || 0;
    if (creatorCount >= maxPerCreator) {
      continue;
    }

    rows.push(candidate);
    creatorCounts.set(creatorKey, creatorCount + 1);
    if (rows.length >= limit) {
      break;
    }
  }

  return {
    rows,
    totalCandidates: candidates.length,
    totalPending: pending.length,
    totalReady: ready.length,
    totalExcluded: pending.length - ready.length,
  };
}
