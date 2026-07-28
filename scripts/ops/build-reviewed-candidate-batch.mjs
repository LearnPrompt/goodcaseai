#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalizeUrl } from "../supply/lib/canonical.mjs";

const WEB_LABEL_FILES = [
  "scripts/review/data/web-v1-human-labels-2026-07-27.json",
  "scripts/review/data/web-v2-human-labels-2026-07-27.json",
  "scripts/review/data/web-v3-human-labels-2026-07-27.json",
  "scripts/review/data/web-v4-human-labels-2026-07-27.json",
];
const VIDEO_LABEL_FILE =
  "scripts/review/data/video-v1-human-labels-2026-07-28.json";
const VIDEO_CANDIDATE_FILE =
  "tmp/supply-reports/video-v1/2026-07-27-youmind-case-candidates.json";

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function reviewedWebCandidate(item, generatedAt) {
  const model = String(item.model || "").trim();
  const creator = String(item.creator || "").trim();
  return {
    title: item.title,
    category: "web",
    source_platform: "X",
    source_url: item.sourceUrl,
    source_like_count: item.metrics?.likes ?? null,
    source_comment_count: item.metrics?.comments ?? null,
    source_share_count: item.metrics?.shares ?? null,
    source_save_count: item.metrics?.saves ?? null,
    source_metrics_captured_at: generatedAt,
    creator_name: creator,
    summary: `${creator} 使用${model ? ` ${model}` : " AI 工具"}完成的网页案例，包含公开结果、完整 Prompt 与原始来源。`,
    prompt_preview: String(item.promptText || "").slice(0, 220),
    prompt_full: item.promptText,
    media_kind: item.mediaKind,
    media_url: item.mediaUrl,
    poster_url: item.posterUrl || null,
    recommended_models: model ? [model] : [],
    cost_band: "medium",
    evidence_level: "L1",
    tags: ["web", "human-reviewed", model].filter(Boolean),
  };
}

function assertCoreFields(item, label) {
  const fields = [
    ["title", item.title],
    ["source_url", item.source_url],
    ["creator_name", item.creator_name],
    ["summary", item.summary],
    ["prompt_full", item.prompt_full],
    ["media_url", item.media_url],
  ];
  const missing = fields.filter(([, value]) => !String(value || "").trim());
  if (missing.length > 0) {
    throw new Error(
      `${label} 缺少核心字段：${missing.map(([name]) => name).join(", ")}`
    );
  }
}

async function collectWebApprovals() {
  const candidates = [];
  for (const labelPath of WEB_LABEL_FILES) {
    const labels = await readJson(labelPath);
    const report = await readJson(labels.source_report);
    const itemsByUrl = new Map(
      report.items.map((item) => [canonicalizeUrl(item.sourceUrl), item])
    );
    for (const label of labels.items.filter(
      (item) => item.human_decision === "approve"
    )) {
      const item = itemsByUrl.get(canonicalizeUrl(label.source_url));
      if (!item) {
        throw new Error(`${label.code} 无法映射到 ${labels.source_report}`);
      }
      const candidate = reviewedWebCandidate(item, report.generatedAt);
      assertCoreFields(candidate, label.code);
      candidates.push(candidate);
    }
  }
  return candidates;
}

async function collectVideoApprovals() {
  const labels = await readJson(VIDEO_LABEL_FILE);
  const reportText = await readFile(labels.source_report, "utf8");
  const reportHash = createHash("sha256").update(reportText).digest("hex");
  if (reportHash !== labels.source_report_sha256) {
    throw new Error("视频源报告 SHA-256 与人工标签不一致");
  }
  const report = JSON.parse(reportText);
  const sourceCandidates = await readJson(VIDEO_CANDIDATE_FILE);
  const candidatesByUrl = new Map(
    sourceCandidates.map((item) => [
      canonicalizeUrl(item.source_url),
      item,
    ])
  );
  return labels.decisions_by_report_index.approve.map((index) => {
    const reviewedItem = report.items[index - 1];
    if (!reviewedItem) {
      throw new Error(`视频人工标签编号越界：${index}`);
    }
    const candidate = candidatesByUrl.get(
      canonicalizeUrl(reviewedItem.sourceUrl)
    );
    if (!candidate) {
      throw new Error(`视频 #${index} 无法映射到候选文件`);
    }
    assertCoreFields(candidate, `视频 #${index}`);
    return {
      ...candidate,
      tags: [...new Set([...(candidate.tags || []), "human-reviewed"])],
    };
  });
}

async function main() {
  const outputPath = path.resolve(
    getArg(
      "--output",
      "tmp/import-batches/2026-07-28-reviewed-web-video.json"
    )
  );
  const [web, video] = await Promise.all([
    collectWebApprovals(),
    collectVideoApprovals(),
  ]);
  const unique = new Map();
  for (const item of [...web, ...video]) {
    const key = canonicalizeUrl(item.source_url);
    if (!key) {
      throw new Error(`无法标准化来源 URL：${item.title}`);
    }
    if (unique.has(key)) {
      throw new Error(`人工批准批次存在重复来源：${item.source_url}`);
    }
    unique.set(key, item);
  }
  const candidates = [...unique.values()];
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      {
        outputPath,
        total: candidates.length,
        web: web.length,
        video: video.length,
      },
      null,
      2
    )
  );
}

await main();
