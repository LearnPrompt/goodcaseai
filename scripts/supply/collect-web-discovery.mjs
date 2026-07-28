#!/usr/bin/env node

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  selectWebDiscoveryItems,
  WEB_DISCOVERY_QUERIES,
} from "./lib/web-discovery.mjs";

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function fetchSearchPage(apiKey, query, cursor = "") {
  const url = new URL("https://api.socialdata.tools/twitter/search");
  url.searchParams.set("query", query);
  url.searchParams.set("type", "Latest");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `SocialData 搜索失败（HTTP ${response.status}）：${
        payload.message || payload.error || "unknown"
      }`
    );
  }
  return {
    tweets: Array.isArray(payload)
      ? payload
      : payload.tweets || payload.data || [],
    nextCursor: payload.next_cursor || "",
  };
}

async function loadExistingUrls(supabase) {
  const [candidateResult, caseResult] = await Promise.all([
    supabase.from("case_candidates").select("source_url").limit(10_000),
    supabase.from("cases").select("source_url").limit(10_000),
  ]);
  if (candidateResult.error || caseResult.error) {
    throw new Error(
      `读取现有来源失败：${
        candidateResult.error?.message || caseResult.error?.message
      }`
    );
  }
  return [...(candidateResult.data || []), ...(caseResult.data || [])]
    .map((item) => item.source_url)
    .filter(Boolean);
}

function renderMarkdown(report) {
  const lines = [
    `# GoodCase 网页自动发现 · ${report.runDate}`,
    "",
    `- 生成时间：${report.generatedAt}`,
    `- SocialData 搜索页：${report.stats.searchPages}`,
    `- 原始搜索结果：${report.stats.fetched}`,
    `- 去除生产重复并通过证据门：${report.items.length}`,
    `- 同一作者最多：${report.policy.maxPerCreator}`,
    `- 生产写入：否`,
    "",
    "| # | 作者 | 模型 | 赞 | 标题 |",
    "|---:|---|---|---:|---|",
  ];
  report.items.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${item.creator} | ${item.model} | ${item.metrics.likes ?? "—"} | [${item.title.replaceAll("|", "\\|")}](${item.sourceUrl}) |`
    );
  });
  lines.push(
    "",
    "> 本报告只用于人工审核；不导入 Supabase，不自动批准或发布。",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const apiKey = process.env.SOCIALDATA_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !url || !serviceRole) {
    throw new Error("缺少 SocialData 或 Supabase 服务端环境变量。");
  }
  const limit = positiveInt(getArg("--limit"), 50, 200);
  const pages = positiveInt(getArg("--pages"), 2, 5);
  const maxPerCreator = positiveInt(
    getArg("--max-per-creator"),
    2,
    10
  );
  const runDate = getArg("--date", tokyoDate());
  const outputDir = path.resolve(
    getArg("--output-dir", "tmp/supply-reports/web-v6")
  );
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tweets = [];
  let searchPages = 0;
  for (const query of WEB_DISCOVERY_QUERIES) {
    let cursor = "";
    for (let page = 0; page < pages; page += 1) {
      const result = await fetchSearchPage(apiKey, query, cursor);
      searchPages += 1;
      tweets.push(
        ...result.tweets.map((tweet) => ({
          ...tweet,
          _goodcase_query: query,
        }))
      );
      cursor = result.nextCursor;
      if (!cursor) break;
    }
  }

  const existingUrls = await loadExistingUrls(supabase);
  const items = selectWebDiscoveryItems(tweets, {
    existingUrls,
    limit,
    maxPerCreator,
  });
  const report = {
    schemaVersion: 1,
    mode: "shadow",
    runDate,
    generatedAt: new Date().toISOString(),
    title: "网页榜 V6 严格发现",
    stats: {
      total: items.length,
      fetched: tweets.length,
      searchPages,
      selected: items.length,
      cases: items.length,
      topicSeeds: 0,
    },
    sources: [...new Set(items.map((item) => item.sourceId))].map(
      (sourceId) => {
        const sourceItems = items.filter((item) => item.sourceId === sourceId);
        return {
          id: sourceId,
          label: sourceItems[0]?.sourceLabel || "X",
          collected: sourceItems.length,
          cases: sourceItems.length,
          topicSeeds: 0,
          error: "",
        };
      }
    ),
    policy: {
      promptScope: "main_post_only",
      requireMedia: true,
      requireExplicitCompletePrompt: true,
      requireSingleWebResult: true,
      rejectTutorialsListsComparisons: true,
      excludeProductionUrls: true,
      maxPerCreator,
    },
    queries: WEB_DISCOVERY_QUERIES,
    items,
  };
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runDate}-web-discovery.json`);
  const markdownPath = path.join(outputDir, `${runDate}-web-discovery.md`);
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
        fetched: tweets.length,
        searchPages,
        selected: items.length,
        target: limit,
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
