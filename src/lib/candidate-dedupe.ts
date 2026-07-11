// 与 scripts/ingest-candidates.mjs 保持一致，改动需同步。
import { createHash } from "node:crypto";

export type CandidateCategory = "image" | "video" | "web" | "copy";

export function normalizeCategory(value: unknown): CandidateCategory {
  if (value === "image" || value === "video" || value === "web" || value === "copy") {
    return value;
  }
  return "image";
}

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (base.length > 0) {
    return base;
  }

  return `candidate-${Date.now()}`;
}

export function buildDedupeKey(candidate: {
  slug?: string | null;
  title?: string | null;
  creator_name?: string | null;
  source_platform?: string | null;
  media_url?: string | null;
}): string {
  if (candidate.slug) {
    return `slug:${candidate.slug}`;
  }

  const raw = [candidate.title, candidate.creator_name, candidate.source_platform, candidate.media_url]
    .map((item) => (item || "").trim())
    .join("|");

  return createHash("sha256").update(raw).digest("hex");
}
