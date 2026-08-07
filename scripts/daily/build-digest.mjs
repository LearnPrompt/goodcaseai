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
 * 页面的取数层同样拿不到票数，所以「今日复习」兜底位在两边都退化成按稳定分排序，
 * 不会打架。「今日新复测」位的证据源见下方 loadRetestRecordsFromDatabase /
 * loadRetestRecordsForDate：优先级和 /daily 页面一样是 case_retests 表 →
 * retest-manifest.json，但这里没有直接 import src/lib/retest-source.ts——
 * 那个文件挂了 "server-only"，是给 Next 打包器认的虚拟包，node 原生跑 TS 解析
 * 不了它。这里改成对 case_retests / case_reactions 内联发同样的查询，
 * manifest 读取逻辑仍然共用 src/lib/retest-manifest.ts（那个文件没有这个问题）。
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
import { loadRetestRecordsFromManifest } from "../../src/lib/retest-manifest.ts";
import { scoreSourceHeat } from "../../src/lib/source-heat.ts";

// 和 src/lib/retest-source.ts 的 CASE_RETESTS_QUERY_LIMIT 保持一致：
// 只取最近这些行就够找出「测试时刻最新的一天」，表会一直增长，不能不设上限。
const CASE_RETESTS_QUERY_LIMIT = 50;

/**
 * 查 case_retests 表；SUPABASE_SERVICE_ROLE_KEY 缺失、表还不存在、查询本身出错
 * 都返回 null，调用方据此落到 manifest。表存在但没有任何一行时返回空数组，
 * 同样落到 manifest——和 src/lib/retest-source.ts 的降级哲学一致，
 * 见该文件顶部注释。
 *
 * 用独立的 service-role 客户端，不复用 main() 里那个优先走 anon key 的
 * supabase 实例：case_retests 表的迁移显式收掉了 anon / authenticated 的
 * 读权限（RLS 开了但没建 policy），anon key 查这张表只会拿到空结果，
 * 没法验证「表是不是真的没数据」还是「压根没权限看」。
 */
async function loadRetestRecordsFromDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    return null;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("case_retests")
    .select("case_slug, tested_at, model, verdict")
    .order("tested_at", { ascending: false })
    .limit(CASE_RETESTS_QUERY_LIMIT);

  if (error) {
    // 42P01 是 Postgres 的「表不存在」；不管是这个还是别的查询错误，
    // 早报这一个栏位都不值得为此把脚本整个跑挂，一律降级到 manifest。
    if (error.code !== "42P01") {
      console.error("查 case_retests 失败，降级到 manifest：", error.message || error);
    }
    return null;
  }

  const rows = (data ?? []).filter((row) => row?.case_slug && row?.tested_at);
  if (rows.length === 0) {
    return [];
  }

  const slugs = [...new Set(rows.map((row) => row.case_slug))];
  const { data: reactionRows, error: reactionError } = await admin
    .from("case_reactions")
    .select("case_slug, kind")
    .in("case_slug", slugs)
    .limit(10_000);

  const votesBySlug = new Map();
  if (!reactionError && reactionRows) {
    for (const row of reactionRows) {
      if (row.kind !== "retest_vote") continue;
      votesBySlug.set(row.case_slug, (votesBySlug.get(row.case_slug) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    slug: row.case_slug,
    testedAt: row.tested_at,
    retestVotes: votesBySlug.get(row.case_slug) ?? 0,
    model: row.model ?? null,
    verdict: row.verdict ?? null,
  }));
}

/** case_retests 查到非空数据就用表里的，查不到或者是空的都回落到 manifest。 */
async function getRetestRecords() {
  const fromDatabase = await loadRetestRecordsFromDatabase();
  if (fromDatabase && fromDatabase.length > 0) {
    return fromDatabase;
  }
  return loadRetestRecordsFromManifest();
}

/**
 * 公众号名称，早报署名就读这一个常量。2026-08-07 确认为正式名称，
 * 改名的话只改这一行就行，不用去动下面的渲染逻辑。
 */
const MP_ACCOUNT_NAME = "卡尔的AI沃茨";

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

/**
 * 今日新案例 / 今日复习兜底位共用的渲染：标题 + 推荐理由 + 站内链接 + 原帖链接。
 * 推荐理由直接用 getPresentableCaseSummary 的产物，不额外写生成逻辑。
 */
function renderCase(pick, heading) {
  const item = pick.item;
  const summary = getPresentableCaseSummary(
    item.summary,
    item.promptContributionNotes
  );
  const caseUrl = `${SITE_ORIGIN}/cases/${item.slug}`;

  const lines = [`## ${heading}｜${item.title}`, ""];

  if (summary) {
    lines.push(summary, "");
  }

  lines.push(`站内链接：${caseUrl}`);
  if (item.sourceUrl) {
    lines.push(`原帖链接：${item.sourceUrl}`);
  }
  lines.push("");

  return lines.join("\n");
}

/** verdict 一律是脚本产出、人还没看过的状态时是 null，据实说明，不替人下结论。 */
function describeRetestVerdict(verdict) {
  switch (verdict) {
    case "reproduced":
      return "人工复核判定复现成功，照着做基本能出同款效果。";
    case "degraded":
      return "人工复核判定效果打了折扣，复现出来了但不如原作品。";
    case "failed":
      return "人工复核判定没能复现，这次没跑出原效果。";
    case "inconclusive":
      return "人工复核判定不好说，还需要再看。";
    default:
      return "产物已经生成，人工复核结论还没出，先放着等复核。";
  }
}

/** 今日新复测位：标题 + 复测了什么/结果一句话 + 推荐理由 + 链接。 */
function renderRetestCase(pick) {
  const item = pick.item;
  const retest = pick.retest;
  const summary = getPresentableCaseSummary(
    item.summary,
    item.promptContributionNotes
  );
  const caseUrl = `${SITE_ORIGIN}/cases/${item.slug}`;

  const lines = [`## 今日新复测｜${item.title}`, ""];

  if (retest) {
    const modelLine = retest.model
      ? `用 ${retest.model} 复测了一次它的提示语。`
      : "刚复测过它的提示语。";
    lines.push(`${modelLine}${describeRetestVerdict(retest.verdict)}`, "");
  }

  if (summary) {
    lines.push(summary, "");
  }

  lines.push(`链接：${caseUrl}`, "");

  return lines.join("\n");
}

function renderMarkdown(digest) {
  const { dateKey, issueNumber, fresh, review } = digest;
  const isRetest = review?.slot === "retest";
  const lines = [
    `# GoodCase 早报 第 ${issueNumber} 期（${dateKey}）`,
    "",
    `今天照旧两条。一条是最近冒出来的新案例，一条是${
      isRetest ? "刚完成复测的旧案例" : "发布满两周、复测之后还立得住的旧案例"
    }。看完大概三分钟，能直接抄的东西都在站内链接里。`,
    "",
    "---",
    "",
  ];

  if (fresh) {
    lines.push(renderCase(fresh, "今日新案例"));
    lines.push("---", "");
  }

  if (review) {
    lines.push(
      isRetest ? renderRetestCase(review) : renderCase(review, "今日复习")
    );
    lines.push("---", "");
  }

  if (!fresh && !review) {
    lines.push("今天没有凑齐两条案例，先别推。", "", "---", "");
  }

  lines.push(
    "早报每天一期，选出来的案例只跟日期有关，同一天谁打开都是这一对。想让它自己送上门，可以订阅 RSS。",
    "",
    `早报页面：${SITE_ORIGIN}/daily`,
    `RSS：${SITE_ORIGIN}/daily/feed.xml`,
    "",
    MP_ACCOUNT_NAME,
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

  // 复测数据没有历史快照：case_retests / manifest 里存的都是"现在"这一份证据。
  // 只有跑「今天」这期时才把它喂给选择逻辑；--date 指定成别的日子（补跑/测试用）
  // 时用旧的「今日复习」逻辑兜底，理由和 /daily/feed.xml 的历史回放一致——
  // 拿今天的复测证据去描述别的日期，等于编数据。
  const today = getDigestDateKey(new Date());
  const retestRecords = dateKey === today ? await getRetestRecords() : [];

  const digest = selectDailyDigest(toCandidates(rows), dateKey, {
    retestRecords,
  });
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

  const reviewLabel = digest.review?.slot === "retest" ? "今日新复测" : "今日复习";

  console.log(`早报第 ${digest.issueNumber} 期（${digest.dateKey}）已生成`);
  console.log(
    `今日新案例：${digest.fresh ? digest.fresh.item.slug : "无"}（候选 ${
      digest.fresh ? `${digest.fresh.rank}/${digest.fresh.poolSize}` : "-"
    }）`
  );
  console.log(
    `${reviewLabel}：${digest.review ? digest.review.item.slug : "无"}（候选 ${
      digest.review ? `${digest.review.rank}/${digest.review.poolSize}` : "-"
    }）`
  );
  if (digest.review?.retest) {
    const { model, verdict, testedAt } = digest.review.retest;
    console.log(
      `  复测依据：model=${model ?? "未知"} verdict=${
        verdict ?? "null（未人工判定）"
      } testedAt=${testedAt}`
    );
  }
  console.log(outPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
