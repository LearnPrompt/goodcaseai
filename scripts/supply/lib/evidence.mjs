import { canonicalizeUrl } from "./canonical.mjs";

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim() || "";
}

function validUrls(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(canonicalizeUrl).filter(Boolean);
}

export function evaluateEvidence(item) {
  const sourceUrl = canonicalizeUrl(firstString(item.sourceUrl, item.url));
  const author = firstString(item.author, item.authorHandle, item.creator);
  const resultUrls = validUrls(item.resultUrls);
  const promptText = firstString(item.promptText);
  const stepsSummary = firstString(item.stepsSummary, item.configuration);
  const promptIsPublic = item.promptIsPublic === true;

  const checks = {
    source: Boolean(sourceUrl),
    author: Boolean(author),
    result: resultUrls.length > 0,
    method: Boolean(stepsSummary || (promptIsPublic && promptText)),
  };

  const passedCount = Object.values(checks).filter(Boolean).length;
  const complete = passedCount === Object.keys(checks).length;

  return {
    candidateType: complete ? "case" : "topic_seed",
    complete,
    completeness: passedCount / Object.keys(checks).length,
    checks,
    safePromptText: promptIsPublic ? promptText || null : null,
    stepsSummary: stepsSummary || null,
    sourceUrl,
    resultUrls,
  };
}
