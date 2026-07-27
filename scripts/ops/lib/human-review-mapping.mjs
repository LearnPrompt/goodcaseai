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

export function normalizeReviewItems(reviewKey, payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return items.map((item) => ({
    reviewKey,
    code: item.code || "",
    id: item.id || "",
    title: item.title || "",
    sourceUrl: item.source_url || "",
    decision: item.human_decision || item.decision || "",
  }));
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
