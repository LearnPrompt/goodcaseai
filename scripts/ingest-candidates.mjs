#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function normalizeCostBand(value) {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}

function normalizeMediaKind(value) {
  if (value === "video") {
    return "video";
  }
  return "image";
}

function normalizeCategory(value) {
  if (value === "image" || value === "video" || value === "web" || value === "copy") {
    return value;
  }
  return "image";
}

function slugify(value) {
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

function buildDedupeKey(candidate) {
  if (candidate.slug) {
    return `slug:${candidate.slug}`;
  }

  const raw = [candidate.title, candidate.creator_name, candidate.source_platform, candidate.media_url]
    .map((item) => (item || "").trim())
    .join("|");

  return createHash("sha256").update(raw).digest("hex");
}

function mapCandidate(raw, importBatchId) {
  const title = String(raw.title || "").trim();
  const slug = String(raw.slug || "").trim() || slugify(title || String(raw.mediaUrl || raw.media_url || ""));

  const candidate = {
    slug,
    title: title || "未命名案例",
    category: normalizeCategory(raw.category),
    source_platform: String(raw.source_platform || raw.source || "").trim() || null,
    creator_name: String(raw.creator_name || raw.creator || "").trim() || null,
    summary: String(raw.summary || "").trim() || "暂无摘要",
    prompt_preview: String(raw.prompt_preview || raw.promptPreview || "").trim() || null,
    prompt_full: String(raw.prompt_full || raw.promptFull || "").trim() || null,
    media_kind: normalizeMediaKind(raw.media_kind || raw.mediaType),
    media_url: String(raw.media_url || raw.mediaUrl || "").trim() || "",
    poster_url: String(raw.poster_url || raw.posterUrl || "").trim() || null,
    remake_count: Number(raw.remake_count ?? raw.remakeCount ?? 0) || 0,
    stability_score: Number(raw.stability_score ?? raw.stabilityScore ?? 0) || 0,
    favorite_score: Number(raw.favorite_score ?? raw.favoriteScore ?? 0) || 0,
    recommended_models: Array.isArray(raw.recommended_models)
      ? raw.recommended_models
      : Array.isArray(raw.recommendedModels)
        ? raw.recommendedModels
        : [],
    cost_band: normalizeCostBand(raw.cost_band || raw.costBand),
    import_batch_id: importBatchId,
  };

  return {
    ...candidate,
    dedupe_key: buildDedupeKey(candidate),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  }

  const fileArg = getArg("--file") || "tmp/case-candidates.json";
  const importBatchId = getArg("--batch") || new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.resolve(process.cwd(), fileArg);

  const rawText = await readFile(filePath, "utf8");
  const parsed = JSON.parse(rawText);

  if (!Array.isArray(parsed)) {
    throw new Error("导入文件必须是 JSON 数组。示例：[{\"title\":\"...\"}]。");
  }

  const candidates = parsed
    .map((item) => mapCandidate(item, importBatchId))
    .filter((item) => item.slug && item.title && item.media_url);

  if (candidates.length === 0) {
    throw new Error("没有可导入数据，请检查 slug/title/media_url 是否存在。");
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("case_candidates")
    .upsert(candidates, { onConflict: "dedupe_key" })
    .select("id");

  if (error) {
    throw new Error(`导入失败：${error.message}`);
  }

  console.log(`已写入候选案例 ${data?.length || 0} 条，batch=${importBatchId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
