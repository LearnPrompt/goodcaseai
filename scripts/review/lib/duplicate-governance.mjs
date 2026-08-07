import { canonicalizeUrl } from "../../supply/lib/canonical.mjs";

export const NEAR_DUPLICATE_PROMPT_THRESHOLD = 0.92;

function normalizeText(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "")
    : "";
}
function bigramDice(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const counts = (value) => {
    const result = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      result.set(gram, (result.get(gram) || 0) + 1);
    }
    return result;
  };

  const a = counts(left);
  const b = counts(right);
  let shared = 0;
  for (const [gram, count] of a) {
    shared += Math.min(count, b.get(gram) || 0);
  }
  return (2 * shared) / (left.length - 1 + (right.length - 1));
}

function promptOf(item) {
  return normalizeText(item?.prompt_full || item?.promptFull || item?.prompt_preview || item?.promptPreview);
}

function sameCategory(left, right) {
  return Boolean(left?.category && right?.category && left.category === right.category);
}

function sameCreator(left, right) {
  const a = normalizeText(left?.creator_name || left?.creatorName);
  const b = normalizeText(right?.creator_name || right?.creatorName);
  return Boolean(a && b && a === b);
}

/**
 * 找到候选与已发布/同批候选之间的可解释重复命中。
 *
 * 来源 URL 是硬重复；Prompt 只在同分类且「完全相同」或「同一作者近重复」时拦截，
 * 避免通用的“做一张海报”类 Prompt 在不同案例之间产生误杀。
 */
export function findDuplicateContent({
  candidate,
  existingCases = [],
  ignoreCandidateId = null,
  ignoreSlug = null,
}) {
  const candidateSource = canonicalizeUrl(candidate?.source_url || candidate?.sourceUrl);
  const candidatePrompt = promptOf(candidate);

  for (const existing of existingCases) {
    if (ignoreCandidateId && existing.source_candidate_id === ignoreCandidateId) continue;
    if (ignoreSlug && existing.slug === ignoreSlug) continue;

    const existingSource = canonicalizeUrl(existing.source_url || existing.sourceUrl);
    if (candidateSource && existingSource && candidateSource === existingSource) {
      return {
        kind: "same-source",
        severity: "block",
        similarity: 1,
        existingSlug: existing.slug || null,
        message: "来源 URL 已经对应一个已发布 Case",
      };
    }

    const existingPrompt = promptOf(existing);
    if (!sameCategory(candidate, existing) || !candidatePrompt || !existingPrompt) continue;
    const similarity = bigramDice(candidatePrompt, existingPrompt);
    const exactPrompt = candidatePrompt === existingPrompt;
    if (exactPrompt || (sameCreator(candidate, existing) && similarity >= NEAR_DUPLICATE_PROMPT_THRESHOLD)) {
      return {
        kind: exactPrompt ? "same-prompt" : "near-duplicate-prompt",
        severity: "block",
        similarity,
        existingSlug: existing.slug || null,
        message: exactPrompt
          ? "同分类已有完全相同的 Prompt"
          : `同一作者的 Prompt 相似度 ${(similarity * 100).toFixed(1)}%`,
      };
    }
  }

  return null;
}
