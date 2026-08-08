#!/usr/bin/env node
/**
 * 把人审 verdict 写回 case_retests，并同步 cases 的稳定分。
 *
 * 单条：
 *   npm run retest:verdict -- --expect-project=<ref> --id=123 \
 *     --verdict=reproduced --notes=... --operator=... --yes
 *
 * 批量（推荐用于上线后的大批量录入/复测）：
 *   npm run retest:verdict -- --expect-project=<ref> --file=verdicts.json --yes
 *   npm run retest:verdict -- --expect-project=<ref> --file=verdicts.json --dry-run
 *
 * --file 吃两种形状：裸数组，或 scripts/retest/retest-manifest.json 原样
 * （records[] 里人填的 verdict / reviewerNotes / reviewer 会被识别）。
 * 逐条写、逐条报成败，收尾只在至少一条真改到已发布 Case 时触发**一次**部署。
 *
 * --expect-project 是必填的写库闸门，理由见 lib/write-target.mjs 顶部。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./lib/env.mjs";
import {
  buildCaseStabilityPatch,
  buildVerdictUpdate,
  shouldTriggerRetestDeploy,
  VALID_VERDICTS,
} from "./lib/stability-verdict.mjs";
import { assertWriteTarget } from "./lib/write-target.mjs";
import { applyVerdictBatch, formatBatchReport, parseVerdictBatch } from "./lib/verdict-batch.mjs";

function getArg(name, fallback = "") {
  const found = process.argv.find((item) => item.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const USAGE =
  `用法（单条）：npm run retest:verdict -- --expect-project=<project-ref> --id=123 ` +
  `--verdict=${VALID_VERDICTS[0]} --notes=... --operator=... --yes\n` +
  `用法（批量）：npm run retest:verdict -- --expect-project=<project-ref> --file=verdicts.json --yes`;

/** 读一条 case_retests：优先按 id，只给 slug 时取该案例最新的一次复测。 */
async function findRetestRow(supabase, entry) {
  const columns = "id, case_slug, tested_at, verdict, notes, operator";
  if (entry.id) {
    const { data, error } = await supabase
      .from("case_retests")
      .select(columns)
      .eq("id", entry.id)
      .maybeSingle();
    if (error) throw new Error(`读取复测记录失败：${error.message}`);
    if (!data) throw new Error(`找不到 case_retests.id=${entry.id}。`);
    return data;
  }

  const { data, error } = await supabase
    .from("case_retests")
    .select(columns)
    .eq("case_slug", entry.slug)
    .order("tested_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`读取复测记录失败：${error.message}`);
  if (!data) throw new Error(`找不到 ${entry.slug} 的复测记录。`);
  return data;
}

/**
 * 应用一条 verdict。成功返回 { slug, caseUpdated, message }，失败抛错。
 *
 * caseUpdated 只在真的改到了一条已发布 Case 时为 true —— 它是要不要收尾触发
 * 部署的唯一依据，写进 case_retests 但公开页面没变化的行不算。
 */
async function applyOne(supabase, entry, { force }) {
  const update = buildVerdictUpdate({
    verdict: entry.verdict,
    notes: entry.notes,
    operator: entry.operator,
  });

  const retest = await findRetestRow(supabase, entry);
  if (retest.verdict && !force) {
    throw new Error(`复测记录 ${retest.id} 已有 verdict=${retest.verdict}；如需改判请显式加 --force。`);
  }

  // Supabase update 必须带过滤条件；select() 让命令能确认实际更新了哪一行。
  const { data: updatedRetest, error: updateError } = await supabase
    .from("case_retests")
    .update(update)
    .eq("id", retest.id)
    .select("id, case_slug, verdict, notes, operator")
    .single();
  if (updateError) throw new Error(`写入人工 verdict 失败：${updateError.message}`);

  const { data: rows, error: rowsError } = await supabase
    .from("case_retests")
    .select("id, case_slug, tested_at, verdict")
    .eq("case_slug", updatedRetest.case_slug)
    .order("tested_at", { ascending: false })
    .order("id", { ascending: false });
  if (rowsError) throw new Error(`读取案例复测时间线失败：${rowsError.message}`);

  // 证据等级只升不降，所以要先读到当前值再算 patch。
  // 读不到（案例已下架 / 查询失败）就按未知处理，交给 resolveEvidenceLevel 决定。
  const { data: currentCase } = await supabase
    .from("cases")
    .select("evidence_level")
    .eq("slug", updatedRetest.case_slug)
    .maybeSingle();

  const patch = buildCaseStabilityPatch(rows || [], currentCase?.evidence_level ?? undefined);
  if (!patch) {
    // 只动了 case_retests，公开页面上的分数一个字没变，所以这条不算要部署的改动。
    return {
      slug: updatedRetest.case_slug,
      caseUpdated: false,
      message: "verdict 已记录，当前仍没有可计算的稳定性分",
    };
  }

  const { data: updatedCase, error: caseError } = await supabase
    .from("cases")
    .update(patch)
    .eq("slug", updatedRetest.case_slug)
    .select("slug, stability_score, evidence_level")
    .maybeSingle();
  if (caseError) {
    throw new Error(
      `verdict 已写入，但同步 cases.stability_score 失败：${caseError.message}；可用 --force 重试同一条记录。`
    );
  }
  if (!updatedCase) {
    // 同上：站上没有这条 Case，没有任何页面需要重建。
    return {
      slug: updatedRetest.case_slug,
      caseUpdated: false,
      message: "verdict 已写入，但站上没有已发布 Case，未同步分数",
    };
  }

  return {
    slug: updatedCase.slug,
    caseUpdated: true,
    message: `stability_score=${updatedCase.stability_score}, evidence_level=${updatedCase.evidence_level}`,
  };
}

/**
 * 收尾触发一次部署。
 *
 * 分数改在库里，页面在构建期和边缘各缓存了一份，不补一次部署这批 verdict 最长
 * 一天后才会出现在站上——理由见 shouldTriggerRetestDeploy 的注释。
 *
 * 全程 fail-soft：verdict 已经落库了，部署没触发不该把这次写库报成失败，
 * 否则运营只会照着报错重跑同一批（还得加 --force），把已经正确的数据再改一遍。
 * 所以下面无论怎么失败都只打警告，不设 exitCode，只是必须把「站上还没更新」说清楚。
 */
async function triggerDeploy({ env, url, updatedSlugs }) {
  if (
    !shouldTriggerRetestDeploy({
      updatedCaseCount: updatedSlugs.length,
      supabaseUrl: url,
      prodSupabaseUrl: env.PROD_SUPABASE_URL,
    })
  ) {
    if (updatedSlugs.length) console.log("写入目标不是站点构建时读的库，跳过部署触发。");
    return;
  }

  // .env.local 是这个命令的既定配置来源（见 readEnvLocal），但 cron / CI 里
  // 这个值通常只在进程环境里，两处都认。
  const hookUrl = env.VERCEL_DEPLOY_HOOK_URL || process.env.VERCEL_DEPLOY_HOOK_URL;
  const affected =
    updatedSlugs.length > 3
      ? `${updatedSlugs.slice(0, 3).join("、")} 等 ${updatedSlugs.length} 条`
      : updatedSlugs.join("、");
  const staleWarning =
    `⚠️  边缘缓存未刷新：${affected} 的新分数最长滞后 24h 才会出现在首页 / 案例库 / 详情页。\n` +
    "    手动触发一次部署即可立刻生效（Vercel 控制台 Redeploy，或 curl -X POST $VERCEL_DEPLOY_HOOK_URL）。";

  if (!hookUrl) {
    console.warn(`\n${staleWarning}\n    根因：未配置 VERCEL_DEPLOY_HOOK_URL。`);
    return;
  }

  try {
    const res = await fetch(hookUrl, { method: "POST", signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      console.log("\n已触发部署（整批只触发一次），几分钟后新的复测结果在站上生效。");
    } else {
      console.warn(`\n${staleWarning}\n    根因：部署触发失败（HTTP ${res.status}）。`);
    }
  } catch (error) {
    console.warn(
      `\n${staleWarning}\n    根因：部署触发失败（${
        error instanceof Error ? error.message : String(error)
      }）。`
    );
  }
}

async function loadBatch(filePath, defaults) {
  const absolute = path.resolve(process.cwd(), filePath);
  let raw;
  try {
    raw = JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    throw new Error(`读取批量文件失败（${absolute}）：${error instanceof Error ? error.message : error}`);
  }
  return parseVerdictBatch(raw, defaults);
}

async function main() {
  const env = await readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;

  // 写库闸门：认不出目标 / 没点名 / 点名不一致，一律在这里终止，下面一行库都不碰。
  const target = assertWriteTarget({
    url,
    expectedProject: getArg("--expect-project"),
    prodSupabaseUrl: env.PROD_SUPABASE_URL,
    command: "retest:verdict",
  });
  console.log(
    `写入目标：${target.projectRef}${target.isKnownProduction ? "（PROD_SUPABASE_URL 指向的生产项目）" : ""}`
  );

  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY。");

  const file = getArg("--file");
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");

  let entries = [];
  let skipped = [];
  if (file) {
    ({ entries, skipped } = await loadBatch(file, {
      defaultOperator: getArg("--operator"),
      defaultNotes: getArg("--notes"),
    }));
    if (!entries.length) {
      console.log(`批量文件里没有可应用的 verdict（跳过 ${skipped.length} 条未审记录）。`);
      return;
    }
  } else {
    const id = getArg("--id");
    const verdict = getArg("--verdict");
    const notes = getArg("--notes");
    const operator = getArg("--operator");
    if (!id || !verdict || !notes || !operator) throw new Error(USAGE);
    entries = [{ label: `id=${id}`, id, slug: null, verdict, notes, operator }];
  }

  if (dryRun) {
    console.log(`\n--dry-run：以下 ${entries.length} 条会被应用，本次不写库。`);
    for (const entry of entries) {
      console.log(
        entry.error
          ? `  ❌ ${entry.label} —— ${entry.error}`
          : `  · ${entry.label} → ${entry.verdict}（operator=${entry.operator || "缺失"}）`
      );
    }
    if (skipped.length) console.log(`  跳过 ${skipped.length} 条未审记录。`);
    return;
  }

  if (!hasFlag("--yes")) {
    throw new Error(`这是写库操作；确认目标是 ${target.projectRef} 后再加 --yes。`);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = await applyVerdictBatch({
    entries,
    applyEntry: (entry) => applyOne(supabase, entry, { force }),
  });

  // 单条模式保持原样：失败就是命令失败，原始报错原样抛出去，不改语义也不改退出码。
  if (!file && summary.failureCount) throw summary.failed[0].error;

  if (file) {
    console.log("");
    console.log(formatBatchReport(summary, skipped));
  } else {
    const [result] = summary.succeeded;
    console.log(
      result.caseUpdated
        ? `复测 verdict 已写入：${result.slug} → ${result.message}`
        : `${result.message}：${result.slug}`
    );
  }

  await triggerDeploy({ env, url, updatedSlugs: summary.updatedSlugs });

  // 批量模式下部分失败要让调用方（人或脚本）看得见，但已经写成功的行不回滚。
  if (summary.failureCount) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
