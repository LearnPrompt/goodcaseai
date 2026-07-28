import { canonicalizeUrl } from "../../supply/lib/canonical.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_DECISIONS = new Set([
  "approve",
  "reject",
  "borderline",
  "topic_seed",
  "skip",
]);

function labelKey(label) {
  return `${label.reviewKey || "unknown"}:${label.code || label.id || "unknown"}`;
}

function matchCandidate(label, candidatesById, candidatesByUrl) {
  if (UUID_PATTERN.test(label.id || "")) {
    const candidate = candidatesById.get(label.id);
    if (!candidate) {
      return { error: "candidate_id_not_found" };
    }
    const labelUrl = canonicalizeUrl(label.sourceUrl);
    const candidateUrl = canonicalizeUrl(candidate.source_url);
    if (labelUrl && candidateUrl && labelUrl !== candidateUrl) {
      return { error: "candidate_id_source_url_mismatch", candidate };
    }
    return { candidate, matchKind: "candidate_id" };
  }

  const sourceUrl = canonicalizeUrl(label.sourceUrl);
  if (!sourceUrl) {
    return { error: "missing_canonical_source_url" };
  }
  const matches = candidatesByUrl.get(sourceUrl) || [];
  if (matches.length === 0) {
    return { error: "source_url_not_found" };
  }
  if (matches.length > 1) {
    return { error: "source_url_matches_multiple_candidates" };
  }
  return { candidate: matches[0], matchKind: "source_url" };
}

export function normalizeReviewItems(
  reviewKey,
  payload,
  { sourceItems = [] } = {}
) {
  if (payload?.decisions_by_report_index) {
    const normalized = [];
    const seenIndexes = new Set();
    for (const [decision, indexes] of Object.entries(
      payload.decisions_by_report_index
    )) {
      if (!Array.isArray(indexes)) {
        throw new Error(`${reviewKey}:${decision} 必须是编号数组`);
      }
      for (const index of indexes) {
        if (!Number.isInteger(index) || index < 1 || index > sourceItems.length) {
          throw new Error(`${reviewKey}:无效报告编号 ${index}`);
        }
        if (seenIndexes.has(index)) {
          throw new Error(`${reviewKey}:重复报告编号 ${index}`);
        }
        seenIndexes.add(index);
        const item = sourceItems[index - 1];
        normalized.push({
          reviewKey,
          code: `#${index}`,
          id: item.id || "",
          title: item.title || "",
          sourceUrl: item.sourceUrl || item.source_url || "",
          decision,
        });
      }
    }
    return normalized;
  }

  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return items.map((item) => {
    const normalized = {
      reviewKey,
      code: item.code || "",
      id: item.id || "",
      title: item.title || "",
      sourceUrl: item.source_url || "",
      decision: item.human_decision || item.decision || "",
    };
    if (item.supersedes_review_key) {
      normalized.supersedesReviewKey = item.supersedes_review_key;
    }
    return normalized;
  });
}

export function resolveSupersededReviewLabels(labels) {
  if (!Array.isArray(labels)) {
    throw new Error("labels 必须是数组。");
  }

  const labelsByKey = new Map();
  for (const label of labels) {
    const key = labelKey(label);
    if (labelsByKey.has(key)) {
      throw new Error(`审核标签键重复：${key}`);
    }
    labelsByKey.set(key, label);
  }

  const supersededKeys = new Set();
  for (const label of labels) {
    if (!label.supersedesReviewKey) continue;
    const currentKey = labelKey(label);
    const superseded = labelsByKey.get(label.supersedesReviewKey);
    if (!superseded) {
      throw new Error(
        `${currentKey} 指向不存在的旧审核：${label.supersedesReviewKey}`
      );
    }
    if (label.supersedesReviewKey === currentKey) {
      throw new Error(`${currentKey} 不能覆盖自身`);
    }
    if (!label.id || !superseded.id || label.id !== superseded.id) {
      throw new Error(`${currentKey} 与旧审核候选 UUID 不一致`);
    }
    supersededKeys.add(label.supersedesReviewKey);
  }

  return labels.filter((label) => !supersededKeys.has(labelKey(label)));
}

export function buildHumanReviewPlan(labels, candidates) {
  const candidatesById = new Map(candidates.map((item) => [item.id, item]));
  const candidatesByUrl = new Map();
  for (const candidate of candidates) {
    const sourceUrl = canonicalizeUrl(candidate.source_url);
    if (!sourceUrl) continue;
    const matches = candidatesByUrl.get(sourceUrl) || [];
    matches.push(candidate);
    candidatesByUrl.set(sourceUrl, matches);
  }

  const plan = {
    approve: [],
    reject: [],
    hold: [],
    alreadyApplied: [],
    unmatched: [],
    conflicts: [],
  };
  const claimedCandidateIds = new Map();

  for (const label of labels) {
    const key = labelKey(label);
    if (!SUPPORTED_DECISIONS.has(label.decision)) {
      plan.conflicts.push({ key, reason: "unsupported_decision" });
      continue;
    }

    const match = matchCandidate(label, candidatesById, candidatesByUrl);
    if (match.error) {
      plan.unmatched.push({ key, reason: match.error });
      continue;
    }

    const priorLabel = claimedCandidateIds.get(match.candidate.id);
    if (priorLabel) {
      plan.conflicts.push({
        key,
        reason: "candidate_matched_by_multiple_labels",
        candidateId: match.candidate.id,
        priorLabel,
      });
      continue;
    }
    claimedCandidateIds.set(match.candidate.id, key);

    const entry = {
      key,
      label,
      candidate: match.candidate,
      matchKind: match.matchKind,
    };
    const status = match.candidate.status;

    if (
      label.decision === "borderline" ||
      label.decision === "topic_seed" ||
      label.decision === "skip"
    ) {
      if (status === "pending") {
        plan.hold.push(entry);
      } else {
        plan.conflicts.push({
          key,
          reason: `hold_label_conflicts_with_${status}`,
          candidateId: match.candidate.id,
        });
      }
      continue;
    }

    if (label.decision === "approve") {
      if (status === "pending") {
        plan.approve.push(entry);
      } else if (status === "approved" || status === "published") {
        plan.alreadyApplied.push(entry);
      } else {
        plan.conflicts.push({
          key,
          reason: `approve_label_conflicts_with_${status}`,
          candidateId: match.candidate.id,
        });
      }
      continue;
    }

    if (status === "pending") {
      plan.reject.push(entry);
    } else if (status === "rejected") {
      plan.alreadyApplied.push(entry);
    } else {
      plan.conflicts.push({
        key,
        reason: `reject_label_conflicts_with_${status}`,
        candidateId: match.candidate.id,
      });
    }
  }

  return plan;
}
