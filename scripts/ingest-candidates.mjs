#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildCandidateDedupeKey,
  slugifyCandidate,
} from "./supply/lib/candidate-slug.mjs";
import {
  checkPromptProvenance,
  provenanceTags,
  stripUrlFragment,
} from "./supply/lib/prompt-provenance.mjs";
import { resolveContentLocale } from "./review/lib/content-locale.mjs";

/**
 * 溯源被判定为「不是作者原文」的候选，一律不许自动进 pending 队列。
 *
 * 这一层是最后一道闸门：不管候选是 shadow-run 产的、手写的还是别的适配器来的，
 * 只要 source_url 上还留着 `#reversed-N` 锚点，或者调用方已经带了判定结果，
 * 都在这里拦下来，写进单独的拒收文件并打日志，绝不静默丢弃。
 */
const BLOCKED_PROVENANCE_STATUSES = new Set([
  "reversed-anchor",
  "prompt-not-in-source",
]);

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
  if (
    value === "image" ||
    value === "video" ||
    value === "web" ||
    value === "copy" ||
    value === "hardware"
  ) {
    return value;
  }
  return "image";
}

function normalizeTranslations(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function normalizeTranslationStatus(value) {
  if (
    value === "untranslated" ||
    value === "machine_draft" ||
    value === "confirmed"
  ) {
    return value;
  }
  return "untranslated";
}

function normalizeOptionalCount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function normalizeOptionalTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function mapCandidate(raw, importBatchId) {
  const title = String(raw.title || "").trim();
  const rawSourceUrl = String(raw.source_url || raw.sourceUrl || "").trim();
  const mediaUrl = String(raw.media_url || raw.mediaUrl || "").trim();
  // source_url 本身仍然去 hash（展示、去重、和已有数据对齐都靠它），
  // fragment 单独留在 provenance_anchor 上。
  const sourceUrl = stripUrlFragment(rawSourceUrl);
  const slug =
    String(raw.slug || "").trim() ||
    slugifyCandidate(title || mediaUrl, sourceUrl || mediaUrl || title);
  const promptPreview =
    String(raw.prompt_preview || raw.promptPreview || "").trim() || null;
  const promptFull = String(raw.prompt_full || raw.promptFull || "").trim() || null;

  const candidate = {
    slug,
    title: title || "未命名案例",
    category: normalizeCategory(raw.category),
    source_platform: String(raw.source_platform || raw.source || "").trim() || null,
    source_url: sourceUrl || null,
    source_like_count: normalizeOptionalCount(
      raw.source_like_count ?? raw.sourceLikeCount ?? raw.likes
    ),
    source_comment_count: normalizeOptionalCount(
      raw.source_comment_count ?? raw.sourceCommentCount ?? raw.comments
    ),
    source_share_count: normalizeOptionalCount(
      raw.source_share_count ??
        raw.sourceShareCount ??
        raw.shares ??
        raw.reposts
    ),
    source_save_count: normalizeOptionalCount(
      raw.source_save_count ??
        raw.sourceSaveCount ??
        raw.saves ??
        raw.bookmarks
    ),
    source_published_at: normalizeOptionalTimestamp(
      raw.source_published_at ?? raw.sourcePublishedAt
    ),
    source_metrics_captured_at: normalizeOptionalTimestamp(
      raw.source_metrics_captured_at ?? raw.sourceMetricsCapturedAt
    ),
    creator_name: String(raw.creator_name || raw.creator || "").trim() || null,
    creator_avatar_url:
      String(raw.creator_avatar_url || raw.creatorAvatarUrl || "").trim() ||
      null,
    summary: String(raw.summary || "").trim() || "暂无摘要",
    prompt_preview: promptPreview,
    prompt_full: promptFull,
    // 必须显式写入：case_candidates.content_locale 的库默认值是 zh-CN，
    // 不写就等于让数据库替所有候选决定语言，英文 Prompt 会被一路带错到发布。
    content_locale: resolveContentLocale({
      content_locale: raw.content_locale || raw.contentLocale,
      prompt_full: promptFull,
      prompt_preview: promptPreview,
    }),
    // 必须显式写入：case_candidates.translations / translation_status 不写就等于
    // 把离线加工好的双语内容丢在导入这一步，跟上面 content_locale 那条注释是同一类坑。
    translations: normalizeTranslations(raw.translations),
    translation_status: normalizeTranslationStatus(
      raw.translation_status ?? raw.translationStatus
    ),
    media_kind: normalizeMediaKind(raw.media_kind || raw.mediaType),
    media_url: mediaUrl,
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
    evidence_level:
      raw.evidence_level === "L1" || raw.evidence_level === "L2"
        ? raw.evidence_level
        : "L0",
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : [],
    import_batch_id: importBatchId,
  };

  // 溯源判定。锚点优先取调用方显式给的 provenance_anchor，取不到就从原始
  // source_url 的 fragment 里现挖——历史文件里的 URL 还带着 `#reversed-N`。
  const provenance = checkPromptProvenance({
    promptText: promptFull || promptPreview,
    sourceUrl: rawSourceUrl,
    anchor: raw.provenance_anchor ?? raw.provenanceAnchor ?? undefined,
    sourceText: raw.source_text ?? raw.sourceText ?? undefined,
  });
  const declaredStatus = String(
    raw.provenance_status ?? raw.provenanceStatus ?? ""
  ).trim();
  // 调用方已经判过并且判成拦截的，不许在这里被重新洗白。
  const status = BLOCKED_PROVENANCE_STATUSES.has(declaredStatus)
    ? declaredStatus
    : provenance.status;

  candidate.provenance_anchor = provenance.anchor || null;
  candidate.tags = [
    ...new Set([...candidate.tags, ...provenanceTags({ ...provenance, status })]),
  ].slice(0, 20);

  return {
    candidate: {
      ...candidate,
      dedupe_key: buildCandidateDedupeKey(candidate),
    },
    provenance: { ...provenance, status },
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

  const mapped = parsed
    .map((item) => mapCandidate(item, importBatchId))
    .filter(
      ({ candidate }) =>
        candidate.slug && candidate.title && candidate.media_url
    );

  // 溯源闸门：带 #reversed-N 锚点、或 prompt 在原帖里找不到的，一律不入库。
  const blocked = mapped.filter(({ provenance }) =>
    BLOCKED_PROVENANCE_STATUSES.has(provenance.status)
  );
  const candidates = mapped
    .filter(({ provenance }) => !BLOCKED_PROVENANCE_STATUSES.has(provenance.status))
    .map(({ candidate }) => candidate);

  if (blocked.length > 0) {
    const blockedPath = path.resolve(
      path.dirname(filePath),
      `${path.basename(filePath, ".json")}-provenance-blocked.json`
    );
    await writeFile(
      blockedPath,
      `${JSON.stringify(
        blocked.map(({ candidate, provenance }) => ({
          slug: candidate.slug,
          title: candidate.title,
          source_url: candidate.source_url,
          provenance_anchor: candidate.provenance_anchor,
          provenance_status: provenance.status,
          reason: provenance.reason,
          match_ratio: provenance.matchRatio,
        })),
        null,
        2
      )}\n`,
      "utf8"
    );
    console.warn(
      `溯源拦截 ${blocked.length} 条，未写入 pending，清单：${blockedPath}`
    );
    for (const { candidate, provenance } of blocked) {
      console.warn(
        `  - [${provenance.status}] ${candidate.title} ${candidate.source_url} — ${provenance.reason}`
      );
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      blocked.length > 0
        ? `没有可导入数据：${blocked.length} 条全部被溯源闸门拦下。`
        : "没有可导入数据，请检查 slug/title/media_url 是否存在。"
    );
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // provenance_anchor 是新加的列，迁移没跑之前库里还没有它。
  // 探一下再决定写不写，免得迁移落地前整条导入链路直接挂掉。
  const anchorProbe = await supabase
    .from("case_candidates")
    .select("provenance_anchor")
    .limit(1);
  const supportsProvenanceAnchor = !anchorProbe.error;
  if (!supportsProvenanceAnchor) {
    console.warn(
      "case_candidates.provenance_anchor 列不存在，本次不写该字段（溯源标记仍然写进 tags）。" +
        "跑一下 supabase/migrations/20260805100000_candidate_provenance_anchor.sql 之后即可生效。"
    );
    for (const candidate of candidates) {
      delete candidate.provenance_anchor;
    }
  }

  const sourceUrls = candidates.map((item) => item.source_url).filter(Boolean);
  const emptyResult = Promise.resolve({ data: [], error: null });
  const [candidateKeyMatches, candidateUrlMatches, publishedMatches] = await Promise.all([
    supabase
      .from("case_candidates")
      .select("dedupe_key")
      .in("dedupe_key", candidates.map((item) => item.dedupe_key)),
    sourceUrls.length > 0
      ? supabase
          .from("case_candidates")
          .select("source_url")
          .in("source_url", sourceUrls)
      : emptyResult,
    sourceUrls.length > 0
      ? supabase.from("cases").select("source_url").in("source_url", sourceUrls)
      : emptyResult,
  ]);

  if (candidateKeyMatches.error || candidateUrlMatches.error || publishedMatches.error) {
    throw new Error(
      `检查已有候选失败：${
        candidateKeyMatches.error?.message ||
        candidateUrlMatches.error?.message ||
        publishedMatches.error?.message
      }`
    );
  }

  const existingKeys = new Set(
    (candidateKeyMatches.data || []).map((item) => item.dedupe_key).filter(Boolean)
  );
  const existingSourceUrls = new Set([
    ...(candidateUrlMatches.data || []).map((item) => item.source_url).filter(Boolean),
    ...(publishedMatches.data || []).map((item) => item.source_url).filter(Boolean),
  ]);
  const freshCandidates = candidates.filter(
    (item) =>
      !existingKeys.has(item.dedupe_key) &&
      !existingSourceUrls.has(item.source_url)
  );

  const skippedCount = candidates.length - freshCandidates.length;
  if (skippedCount > 0) {
    console.log(`跳过已有候选或正式 Case ${skippedCount} 条；默认不会覆盖审核记录。`);
  }

  if (freshCandidates.length === 0) {
    console.log("没有新的候选需要导入。");
    return;
  }

  const { data, error } = await supabase
    .from("case_candidates")
    .insert(freshCandidates)
    .select("id");

  if (error) {
    throw new Error(`导入失败：${error.message}`);
  }

  console.log(`已追加候选案例 ${data?.length || 0} 条，batch=${importBatchId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
