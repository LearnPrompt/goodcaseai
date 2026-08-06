#!/usr/bin/env node

/**
 * 每日早报的公众号素材。
 *
 * 跑一次输出当天那期的 markdown，落到 ~/Downloads，运营直接贴公众号。
 * 选择逻辑复用 src/lib/daily-digest.ts，和 /daily 页面、/daily/feed.xml 是同一份，
 * 所以脚本产出的两条案例和站上看到的一定一致。
 *
 * 用法：
 *   node --env-file=.env.local scripts/daily/build-digest.mjs
 *   node --env-file=.env.local scripts/daily/build-digest.mjs --date=2026-08-01
 *   node --env-file=.env.local scripts/daily/build-digest.mjs --out=/tmp/digest.md
 *
 * 注意：这里读的是催复测票数之外的字段，和页面口径完全一致。
 * 页面的取数层同样拿不到票数，所以复习位在两边都退化成按稳定分排序，不会打架。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getPresentableCaseSummary } from "../../src/lib/case-presentation.ts";
import {
  getDigestDateKey,
  selectDailyDigest,
} from "../../src/lib/daily-digest.ts";
import { scoreSourceHeat } from "../../src/lib/source-heat.ts";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://goodcase.ai"
).replace(/\/+$/, "");

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=").trim() : null;
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `缺少 ${name}。用 node --env-file=.env.local 跑，或先把变量导出到环境里。`
    );
  }
  return value;
}

async function loadPublishedCases(supabase) {
  const { data, error } = await supabase
    .from("cases")
    .select(
      [
        "slug",
        "title",
        "summary",
        "prompt_preview",
        "category",
        "source_platform",
        "source_url",
        "source_like_count",
        "source_comment_count",
        "source_share_count",
        "source_save_count",
        "source_published_at",
        "source_metrics_captured_at",
        "creator_name",
        "stability_score",
        "created_at",
        // 摘要是自动生成的套话时，站上会退回三段式复用方法的第一句。
        // 这里取同一份数据，markdown 才不会比页面少一句推荐理由。
        "tr_result_breakdown:translations->zh-CN->resultBreakdown",
      ].join(", ")
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`读取已发布 Case 失败：${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("已发布 Case 为空，早报没法出。");
  }

  return data;
}

/**
 * 来源热度是平台内百分位，必须拿全库一起打分。
 * 只喂候选那几条进去的话所有分数会被压平到 50，和站上的排序对不上。
 */
function toCandidates(rows) {
  const scored = scoreSourceHeat(
    rows.map((row) => ({
      slug: row.slug,
      source: row.source_platform || "未知来源",
      sourceUrl: row.source_url || undefined,
      sourceLikeCount: row.source_like_count ?? undefined,
      sourceCommentCount: row.source_comment_count ?? undefined,
      sourceShareCount: row.source_share_count ?? undefined,
      sourceSaveCount: row.source_save_count ?? undefined,
      sourcePublishedAt: row.source_published_at || undefined,
      sourceMetricsCapturedAt: row.source_metrics_captured_at || undefined,
    }))
  );
  const heatBySlug = new Map(scored.map((item) => [item.slug, item]));

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    summary: row.summary || "",
    promptPreview: (row.prompt_preview || "").trim(),
    creator: row.creator_name || "匿名作者",
    source: row.source_platform || "未知来源",
    sourceUrl: row.source_url || null,
    createdAt: row.created_at || null,
    stabilityScore: row.stability_score ?? 0,
    sourceHeatScore: heatBySlug.get(row.slug)?.sourceHeatScore ?? null,
    promptContributionNotes: Array.isArray(row.tr_result_breakdown)
      ? row.tr_result_breakdown.filter((note) => typeof note === "string")
      : undefined,
  }));
}

function trimPrompt(text, limit = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}…`
    : normalized;
}

function renderCase(pick, heading, lead) {
  const item = pick.item;
  const summary = getPresentableCaseSummary(
    item.summary,
    item.promptContributionNotes
  );
  const prompt = trimPrompt(item.promptPreview);
  const caseUrl = `${SITE_ORIGIN}/cases/${item.slug}`;

  const lines = [`## ${heading}｜${item.title}`, "", lead, ""];

  if (summary) {
    lines.push(summary, "");
  }

  if (prompt) {
    lines.push(`提示语开头是这么写的：${prompt}`, "");
  }

  lines.push(`作者是 ${item.creator}，作品最早发在${item.source}。`);
  if (item.sourceUrl) {
    lines.push(`原帖在这里：${item.sourceUrl}`);
  }
  lines.push(`完整提示语和复测记录在站内：${caseUrl}`);
  lines.push("");

  return lines.join("\n");
}

function describeFreshReason(pick) {
  const heat =
    pick.item.sourceHeatScore === null ? null : pick.item.sourceHeatScore;
  if (pick.fallback) {
    return `最近两周站里没有新发布，先把全库最新的一条端上来。${
      heat === null ? "" : `来源热度 ${heat}。`
    }`.trim();
  }

  return `最近两周发布的案例里，它在原帖那边的互动最扎实${
    heat === null ? "" : `，来源热度 ${heat}`
  }，今天先看它。`;
}

function describeReviewReason(pick) {
  const score = pick.item.stabilityScore;
  const measured = typeof score === "number" && score > 0 && score <= 100;

  return measured
    ? `它已经发布满两周，最近一次复测给到 ${score} 分，现在照着做大概率还能出活。`
    : "它已经发布满两周，稳定度还没复测过，正好趁今天投一票催一下。";
}

function renderMarkdown(digest) {
  const { dateKey, issueNumber, fresh, review } = digest;
  const lines = [
    `# GoodCase 早报 第 ${issueNumber} 期（${dateKey}）`,
    "",
    "今天照旧两条。一条是最近冒出来的新案例，一条是发布满两周、复测之后还立得住的旧案例。看完大概三分钟，能直接抄的东西都在站内链接里。",
    "",
    "---",
    "",
  ];

  if (fresh) {
    lines.push(renderCase(fresh, "今日新案例", describeFreshReason(fresh)));
    lines.push("---", "");
  }

  if (review) {
    lines.push(renderCase(review, "今日复习", describeReviewReason(review)));
    lines.push("---", "");
  }

  if (!fresh && !review) {
    lines.push("今天没有凑齐两条案例，先别推。", "", "---", "");
  }

  lines.push(
    "早报每天一期，选出来的两条只跟日期有关，同一天谁打开都是这一对。想让它自己送上门，可以订阅 RSS。",
    "",
    `早报页面：${SITE_ORIGIN}/daily`,
    `RSS：${SITE_ORIGIN}/daily/feed.xml`,
    "",
    "<!-- 二维码位：把公众号二维码图片贴在这一行下面，宽度建议 240px -->",
    "",
    "&nbsp;",
    "",
    "&nbsp;",
    "",
    "<!-- 二维码位结束 -->",
    ""
  );

  return lines.join("\n");
}

async function main() {
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dateKey = getArg("date") || getDigestDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) {
    throw new Error(`--date 需要 YYYY-MM-DD，收到的是 ${dateKey}`);
  }

  const rows = await loadPublishedCases(supabase);
  const digest = selectDailyDigest(toCandidates(rows), dateKey);
  const markdown = renderMarkdown(digest);

  const outPath =
    getArg("out") ||
    path.join(
      homedir(),
      "Downloads",
      `goodcase-早报-${dateKey.replace(/-/g, "")}.md`
    );

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, "utf8");

  console.log(`早报第 ${digest.issueNumber} 期（${digest.dateKey}）已生成`);
  console.log(
    `今日新案例：${digest.fresh ? digest.fresh.item.slug : "无"}（候选 ${
      digest.fresh ? `${digest.fresh.rank}/${digest.fresh.poolSize}` : "-"
    }）`
  );
  console.log(
    `今日复习：${digest.review ? digest.review.item.slug : "无"}（候选 ${
      digest.review ? `${digest.review.rank}/${digest.review.poolSize}` : "-"
    }）`
  );
  console.log(outPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
