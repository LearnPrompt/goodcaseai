#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchRadarItems,
  meta as radarMeta,
  normalizeRadarItems,
  RADAR_FEED_URL,
  selectDiversifiedItems,
} from "./adapters/radar.mjs";
import {
  fetchYouMindItems,
  meta as youMindMeta,
  YOUMIND_INDEX_URL,
} from "./adapters/youmind.mjs";
import { buildCanonicalKey, canonicalizeUrl } from "./lib/canonical.mjs";
import { evaluateEvidence } from "./lib/evidence.mjs";
import {
  excludeHistoricalItems,
  loadRecentCanonicalKeys,
  loadRunCanonicalKeys,
  rememberCanonicalKeys,
} from "./lib/history.mjs";
import { resolveContentLocale } from "../review/lib/content-locale.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];
  let duplicateCount = 0;
  let invalidUrlCount = 0;

  for (const item of items) {
    const canonicalUrl = canonicalizeUrl(item.sourceUrl);
    const canonicalKey = buildCanonicalKey(item.sourceUrl);
    if (!canonicalUrl || !canonicalKey) {
      invalidUrlCount += 1;
      continue;
    }
    if (seen.has(canonicalKey)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(canonicalKey);
    output.push({ ...item, canonicalUrl, canonicalKey });
  }

  return { items: output, duplicateCount, invalidUrlCount };
}

function toReportItem(item) {
  const evidence = evaluateEvidence(item);
  return {
    canonicalKey: item.canonicalKey,
    canonicalUrl: item.canonicalUrl,
    sourceId: item.sourceId,
    externalId: item.externalId,
    origin: item.origin,
    sourceLabel: item.sourceLabel,
    title: item.title,
    author: item.author,
    publishedAt: item.publishedAt,
    relevanceScore: item.relevanceScore,
    summary: item.summary,
    evidencePageUrl: item.evidencePageUrl || null,
    category: item.category || null,
    modelName: item.modelName || null,
    mediaKind: item.mediaKind || null,
    mediaUrl: item.mediaUrl || evidence.resultUrls[0] || null,
    posterUrl: item.posterUrl || null,
    promptText: evidence.safePromptText,
    sourceMetrics: {
      likes: item.sourceLikeCount ?? null,
      comments: item.sourceCommentCount ?? null,
      shares: item.sourceShareCount ?? null,
      saves: item.sourceSaveCount ?? null,
      views: item.sourceViewCount ?? null,
      capturedAt: item.sourceMetricsCapturedAt || null,
    },
    tags: Array.isArray(item.tags) ? item.tags : [],
    candidateType: evidence.candidateType,
    evidence: {
      checks: evidence.checks,
      completeness: evidence.completeness,
      resultUrls: evidence.resultUrls,
      promptIsPublic: Boolean(evidence.safePromptText),
      stepsSummary: evidence.stepsSummary,
    },
  };
}

function toImportCandidate(item, capturedAt) {
  if (item.candidateType !== "case") {
    return null;
  }

  return {
    title: item.title,
    category: item.category || (item.mediaKind === "video" ? "video" : "image"),
    source_platform: "X",
    source_url: item.canonicalUrl,
    source_like_count: item.sourceMetrics.likes,
    source_comment_count: item.sourceMetrics.comments,
    source_share_count: item.sourceMetrics.shares,
    source_save_count: item.sourceMetrics.saves,
    source_published_at: item.publishedAt,
    source_metrics_captured_at: item.sourceMetrics.capturedAt || capturedAt,
    creator_name: item.author,
    summary: item.summary,
    prompt_preview:
      typeof item.promptText === "string" ? item.promptText.slice(0, 180) : null,
    prompt_full: item.promptText,
    // X 上的中文创作者绝大多数直接写英文 Prompt，来源账号语言不能拿来当内容语言。
    content_locale: resolveContentLocale({ prompt_full: item.promptText }),
    media_kind: item.mediaKind || "image",
    media_url: item.mediaUrl || "",
    poster_url: item.posterUrl,
    recommended_models: item.modelName ? [item.modelName] : [],
    cost_band: "medium",
    evidence_level: "L1",
    tags: item.tags,
    evidence_page_url: item.evidencePageUrl,
  };
}

function checkMarks(checks) {
  return ["source", "author", "result", "method"]
    .map((name) => `${checks[name] ? "✓" : "·"}${name}`)
    .join(" ");
}

function renderMarkdown(report) {
  const lines = [
    `# GoodCase 供给影子日报 · ${report.runDate}`,
    "",
    `- 模式：\`${report.mode}\``,
    `- 来源：${report.source.displayName}`,
    `- Feed：${report.source.feedUrl}`,
    `- 生成时间：${report.generatedAt}`,
    `- 外部 API 成本：¥${report.externalCostCny.toFixed(2)}`,
    "",
    "## 运行结果",
    "",
    `- 抓取有效条目：${report.stats.fetched}`,
    `- URL 去重后候选池：${report.stats.poolAfterUrlDedupe}`,
    `- 本次选取：${report.stats.selected}`,
    `- 本次新出现：${report.stats.netNew}`,
    `- 重复命中：${report.stats.duplicates}`,
    `  - 同批重复：${report.stats.sameFeedDuplicates}`,
    `  - 近 7 日重复：${report.stats.historicalDuplicates}`,
    `  - 同日重跑：${report.stats.sameDayDuplicates}`,
    `- 无效 URL：${report.stats.invalidUrls}`,
    `- Case：${report.stats.cases}`,
    `- Topic seed：${report.stats.topicSeeds}`,
    `- 来源错误：${report.errors.length}`,
    "",
  ];

  if (report.errors.length > 0) {
    lines.push("## 错误", "", ...report.errors.map((error) => `- ${error}`), "");
  }

  lines.push(
    "## 候选",
    "",
    "| 类型 | 分数 | 来源 | 证据 | 标题 |",
    "|---|---:|---|---|---|"
  );

  for (const item of report.items) {
    const safeTitle = item.title.replaceAll("|", "\\|");
    lines.push(
      `| ${item.candidateType} | ${item.relevanceScore.toFixed(2)} | ${item.origin || "-"} | ${checkMarks(item.evidence.checks)} | [${safeTitle}](${item.canonicalUrl}) |`
    );
  }

  lines.push(
    "",
    "> 本报告只做发现与分级，不写 Supabase、不下载媒体、不自动发布。",
    ""
  );

  return lines.join("\n");
}

async function main() {
  const runDate = getArg("--date") || tokyoDate();
  const maxItems = positiveInt(getArg("--max-items") || process.env.SUPPLY_MAX_ITEMS, 15);
  const sourceId = getArg("--source") || process.env.SUPPLY_SOURCE || "radar";
  if (sourceId !== "radar" && sourceId !== "youmind") {
    throw new Error(`不支持的来源：${sourceId}`);
  }
  const sourceMeta = sourceId === "youmind" ? youMindMeta : radarMeta;
  const outputDir = path.resolve(
    APP_DIR,
    getArg("--output-dir") || "tmp/supply-reports"
  );
  const fixturePath = getArg("--fixture");
  const defaultFeedUrl =
    sourceId === "youmind"
      ? process.env.YOUMIND_INDEX_URL || YOUMIND_INDEX_URL
      : process.env.RADAR_FEED_URL || RADAR_FEED_URL;
  const feedUrl = getArg("--feed-url") || defaultFeedUrl;
  const feedUrls = (getArg("--feed-urls") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const reportStem = sourceId === "radar" ? runDate : `${runDate}-${sourceId}`;
  const jsonPath = path.join(outputDir, `${reportStem}.json`);
  const markdownPath = path.join(outputDir, `${reportStem}.md`);
  const candidatePath = path.join(
    outputDir,
    `${reportStem}-case-candidates.json`
  );
  const sameDayKeys = await loadRunCanonicalKeys(jsonPath, { schemaVersion: 2 });
  const previousKeys = await loadRecentCanonicalKeys({
    outputDir,
    runDate,
    includeRunDate: false,
  });
  const errors = [];
  let rawItems = [];

  try {
    if (fixturePath) {
      if (sourceId !== "radar") {
        throw new Error("--fixture 当前只支持 radar 来源。");
      }
      const payload = JSON.parse(
        await readFile(path.resolve(APP_DIR, fixturePath), "utf8")
      );
      rawItems = normalizeRadarItems(payload);
    } else if (sourceId === "youmind") {
      rawItems = await fetchYouMindItems({
        indexUrl: feedUrl,
        indexUrls: feedUrls.length > 0 ? feedUrls : undefined,
        maxItems,
      });
    } else {
      rawItems = await fetchRadarItems({ feedUrl });
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const deduped = dedupeItems(rawItems);
  if (errors.length === 0 && deduped.items.length === 0) {
    errors.push(`${sourceMeta.displayName} 未产出有效候选`);
  }
  const history = excludeHistoricalItems(deduped.items, previousKeys);
  const selected =
    sameDayKeys.size > 0
      ? deduped.items
          .filter((item) => sameDayKeys.has(item.canonicalKey))
          .slice(0, maxItems)
      : sourceId === "youmind"
        ? history.freshItems.slice(0, maxItems)
        : selectDiversifiedItems(history.freshItems, { maxItems });
  const items = selected.map(toReportItem);
  const sameDayDuplicates = sameDayKeys.size > 0 ? items.length : 0;
  const generatedAt = new Date().toISOString();

  const report = {
    schemaVersion: 2,
    mode: "shadow",
    runDate,
    generatedAt,
    externalCostCny: 0,
    source: {
      id: sourceMeta.id,
      displayName: sourceMeta.displayName,
      feedUrl: fixturePath
        ? `fixture:${fixturePath}`
        : feedUrls.length > 0
          ? feedUrls.join(",")
          : feedUrl,
    },
    stats: {
      fetched: rawItems.length,
      poolAfterUrlDedupe: deduped.items.length,
      selected: items.length,
      netNew: sameDayKeys.size > 0 ? 0 : items.length,
      duplicates:
        deduped.duplicateCount +
        history.historicalDuplicates +
        sameDayDuplicates,
      sameFeedDuplicates: deduped.duplicateCount,
      historicalDuplicates: history.historicalDuplicates,
      sameDayDuplicates,
      invalidUrls: deduped.invalidUrlCount,
      cases: items.filter((item) => item.candidateType === "case").length,
      topicSeeds: items.filter((item) => item.candidateType === "topic_seed").length,
    },
    errors,
    items,
  };

  await mkdir(outputDir, { recursive: true });
  await rememberCanonicalKeys({
    outputDir,
    runDate,
    canonicalKeys: items.map((item) => item.canonicalKey),
  });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(report), "utf8");
  if (sourceId === "youmind") {
    const importCandidates = items
      .map((item) => toImportCandidate(item, generatedAt))
      .filter(Boolean);
    await writeFile(
      candidatePath,
      `${JSON.stringify(importCandidates, null, 2)}\n`,
      "utf8"
    );
  }

  console.log(`影子日报：${markdownPath}`);
  if (sourceId === "youmind") {
    console.log(`候选导入文件：${candidatePath}`);
  }
  console.log(
    `抓取 ${report.stats.fetched}，选取 ${report.stats.selected}，Case ${report.stats.cases}，Topic seed ${report.stats.topicSeeds}，近 7 日重复 ${report.stats.historicalDuplicates}`
  );

  if (errors.length > 0 && items.length === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
