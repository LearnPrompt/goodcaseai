import { createHash } from "node:crypto";

function shortHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

export function slugifyCandidate(value, fallbackSeed = value) {
  const input = String(value || "").trim();
  const asciiBase = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const containsNonAscii = /[^\x00-\x7F]/.test(input);
  const seed = String(fallbackSeed || input || "candidate");
  const suffix = shortHash(seed);

  if (asciiBase && !containsNonAscii) {
    return asciiBase;
  }
  if (asciiBase) {
    return `${asciiBase}-${suffix}`;
  }
  return `case-${suffix}`;
}

export function buildCandidateDedupeKey(candidate) {
  const sourceUrl = String(candidate.source_url || "").trim();
  if (sourceUrl) {
    return `source:${shortHash(sourceUrl)}`;
  }
  if (candidate.slug) {
    return `slug:${candidate.slug}`;
  }

  const raw = [
    candidate.title,
    candidate.creator_name,
    candidate.source_platform,
    candidate.media_url,
  ]
    .map((item) => String(item || "").trim())
    .join("|");

  return `content:${shortHash(raw)}`;
}
