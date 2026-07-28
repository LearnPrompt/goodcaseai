#!/usr/bin/env node

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { canonicalizeUrl } from "./lib/canonical.mjs";
import { extractStrictWebPrompt } from "./lib/web-discovery.mjs";
import {
  extractUiPromptLinks,
  parseUiPromptDetail,
  parseV0ShareDetail,
  UI_PROMPT_LIST_URLS,
  V0_SHARE_URLS,
} from "./lib/web-curated-sources.mjs";

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "GoodCaseResearch/1.0 (+https://goodcase.ai)",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${url} 返回 HTTP ${response.status}`);
  }
  return response.text();
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { value: await mapper(values[index]), error: "" };
      } catch (error) {
        results[index] = {
          value: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

async function loadExistingUrls(supabase) {
  const [candidateResult, caseResult] = await Promise.all([
    supabase.from("case_candidates").select("source_url").limit(10_000),
    supabase.from("cases").select("source_url").limit(10_000),
  ]);
  if (candidateResult.error || caseResult.error) {
    throw new Error(
      candidateResult.error?.message ||
        caseResult.error?.message ||
        "读取现有来源失败"
    );
  }
  return new Set(
    [...(candidateResult.data || []), ...(caseResult.data || [])]
      .map((item) => canonicalizeUrl(item.source_url))
      .filter(Boolean)
  );
}

function summarizeSources(items, errors) {
  const definitions = [
    ["x-strict", "X · 严格发现"],
    ["ui-prompt-library", "UI Prompt Library"],
    ["v0-community", "v0 · 社区生成"],
  ];
  return definitions.map(([id, label]) => {
    const sourceItems = items.filter((item) =>
      id === "x-strict" ? item.sourceId.startsWith("x-") : item.sourceId === id
    );
    return {
      id,
      label,
      collected: sourceItems.length,
      cases: sourceItems.length,
      topicSeeds: 0,
      error: errors[id] || "",
    };
  });
}

function renderMarkdown(report) {
  const rows = report.items.map(
    (item, index) =>
      `| ${index + 1} | ${item.sourceLabel} | ${item.creator} | [${item.title.replaceAll("|", "\\|")}](${item.sourceUrl}) | ${item.promptText.length} |`
  );
  return [
    `# GoodCase 网页多来源严格候选 · ${report.runDate}`,
    "",
    `- 候选：${report.items.length}`,
    "- 生产写入：否",
    "- 规则：Prompt 与网页结果必须同页、一对一、可直接复制",
    "",
    "| # | 来源 | 作者 | 标题 | Prompt 字符 |",
    "|---:|---|---|---|---:|",
    ...rows,
    "",
  ].join("\n");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("缺少 Supabase 服务端环境变量。");
  }
  const runDate = getArg("--date", tokyoDate());
  const limit = positiveInt(getArg("--limit"), 40, 100);
  const outputDir = path.resolve(
    getArg("--output-dir", "tmp/supply-reports/web-v6")
  );
  const socialReportPath = path.resolve(
    getArg(
      "--social-report",
      `tmp/supply-reports/web-v6/${runDate}-web-discovery.json`
    )
  );
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existingUrls = await loadExistingUrls(supabase);
  const errors = {};
  const items = [];

  try {
    const socialReport = JSON.parse(await readFile(socialReportPath, "utf8"));
    items.push(
      ...(socialReport.items || []).map((item) => ({
        ...item,
        promptText: extractStrictWebPrompt(item.method) || item.promptText,
      }))
    );
  } catch (error) {
    errors["x-strict"] =
      error instanceof Error ? error.message : "无法读取严格 X 批次";
  }

  let uiLinks = [];
  const uiListErrors = [];
  for (const uiListUrl of UI_PROMPT_LIST_URLS) {
    try {
      uiLinks.push(
        ...extractUiPromptLinks(await fetchHtml(uiListUrl)).slice(0, 4)
      );
    } catch (error) {
      uiListErrors.push(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  uiLinks = [...new Set(uiLinks)];
  if (uiListErrors.length) {
    errors["ui-prompt-library"] =
      `${uiListErrors.length} 个分类页抓取失败；其余已保留。`;
  }
  const uiResults = await mapConcurrent(uiLinks, 4, async (url) =>
    parseUiPromptDetail(await fetchHtml(url), url)
  );
  items.push(...uiResults.map((result) => result.value).filter(Boolean));
  const uiErrors = uiResults.filter((result) => result.error);
  if (uiErrors.length) {
    errors["ui-prompt-library"] =
      `${uiErrors.length} 个详情页抓取失败；其余已保留。`;
  }

  const v0Results = await mapConcurrent(V0_SHARE_URLS, 4, async (url) =>
    parseV0ShareDetail(await fetchHtml(url), url)
  );
  items.push(...v0Results.map((result) => result.value).filter(Boolean));
  const v0Errors = v0Results.filter((result) => result.error);
  if (v0Errors.length) {
    errors["v0-community"] =
      `${v0Errors.length} 个分享页抓取失败；其余已保留。`;
  }

  const seen = new Set();
  const seenMedia = new Set();
  const selected = items
    .filter((item) => {
      const canonical = canonicalizeUrl(item.sourceUrl);
      const canonicalMedia = canonicalizeUrl(item.mediaUrl);
      if (
        !canonical ||
        !canonicalMedia ||
        existingUrls.has(canonical) ||
        seen.has(canonical) ||
        seenMedia.has(canonicalMedia)
      ) {
        return false;
      }
      seen.add(canonical);
      seenMedia.add(canonicalMedia);
      return true;
    })
    .slice(0, limit);
  const report = {
    schemaVersion: 1,
    mode: "shadow",
    runDate,
    generatedAt: new Date().toISOString(),
    title: "网页榜 V6 · Prompt 与成品同页",
    stats: {
      total: selected.length,
      cases: selected.length,
      topicSeeds: 0,
      uiPromptLinks: uiLinks.length,
      v0Seeds: V0_SHARE_URLS.length,
    },
    sources: summarizeSources(selected, errors),
    policy: {
      requireCompletePrompt: true,
      requireSamePageResult: true,
      requireSingleWebResult: true,
      rejectTutorialsListsComparisons: true,
      excludeProductionUrls: true,
    },
    items: selected,
  };
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runDate}-web-multisource.json`);
  const markdownPath = path.join(outputDir, `${runDate}-web-multisource.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(jsonPath, 0o600);
  await writeFile(markdownPath, `${renderMarkdown(report)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        jsonPath,
        markdownPath,
        selected: selected.length,
        bySource: report.sources.map(({ label, collected }) => ({
          label,
          collected,
        })),
        errors,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
