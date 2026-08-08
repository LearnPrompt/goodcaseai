#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./lib/env.mjs";
import {
  buildCaseStabilityPatch,
  buildVerdictUpdate,
  shouldTriggerRetestDeploy,
  VALID_VERDICTS,
} from "./lib/stability-verdict.mjs";

function getArg(name, fallback = "") {
  const found = process.argv.find((item) => item.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function assertSafeTarget(url, env) {
  if (!url) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL。");
  if (env.PROD_SUPABASE_URL && url === env.PROD_SUPABASE_URL) {
    throw new Error("拒绝在 PROD_SUPABASE_URL 上回写复测 verdict；请切到自己的测试项目。");
  }
}

async function main() {
  const env = await readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  assertSafeTarget(url, env);
  if (!serviceRole) throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY。");

  const id = getArg("--id");
  const verdict = getArg("--verdict");
  const notes = getArg("--notes");
  const operator = getArg("--operator");
  if (!id || !verdict || !notes || !operator) {
    throw new Error(
      `用法：npm run retest:verdict -- --id=123 --verdict=${VALID_VERDICTS[0]} --notes=... --operator=... --yes`
    );
  }
  if (!hasFlag("--yes")) {
    throw new Error("这是测试库写操作；确认目标是自己的 Supabase 后再加 --yes。");
  }

  const update = buildVerdictUpdate({ verdict, notes, operator });
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: retest, error: fetchError } = await supabase
    .from("case_retests")
    .select("id, case_slug, tested_at, verdict, notes, operator")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(`读取复测记录失败：${fetchError.message}`);
  if (!retest) throw new Error(`找不到 case_retests.id=${id}。`);
  if (retest.verdict && !hasFlag("--force")) {
    throw new Error(`复测记录 ${id} 已有 verdict=${retest.verdict}；如需改判请显式加 --force。`);
  }

  // Supabase update 必须带过滤条件；select() 让命令能确认实际更新了哪一行。
  const { data: updatedRetest, error: updateError } = await supabase
    .from("case_retests")
    .update(update)
    .eq("id", id)
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

  const patch = buildCaseStabilityPatch(
    rows || [],
    currentCase?.evidence_level ?? undefined
  );
  if (!patch) {
    // 只动了 case_retests，公开页面上的分数一个字没变，所以这里不触发部署。
    console.log(`verdict 已记录：${updatedRetest.case_slug}，当前仍没有可计算的稳定性分。`);
    return;
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
    console.warn(`verdict 已写入，但 ${updatedRetest.case_slug} 当前没有已发布 Case，未同步分数。`);
    return;
  }

  console.log(
    `复测 verdict 已写入：${updatedRetest.case_slug} → stability_score=${updatedCase.stability_score}, evidence_level=${updatedCase.evidence_level}`
  );

  // 走到这里说明确实改到了一条已发布 Case。分数改在库里，页面在构建期和边缘各缓存了
  // 一份，不补一次部署这条 verdict 最长一天后才会出现在站上——理由见
  // shouldTriggerRetestDeploy 的注释。
  //
  // 全程 fail-soft：verdict 已经落库了，部署没触发不该把这次写库报成失败，
  // 否则运营只会照着报错重跑同一条（还得加 --force），把已经正确的数据再改一遍。
  // 所以下面无论怎么失败都只打警告，不设 exitCode，只是必须把「站上还没更新」说清楚。
  if (
    !shouldTriggerRetestDeploy({
      updatedCaseCount: 1,
      supabaseUrl: url,
      prodSupabaseUrl: env.PROD_SUPABASE_URL,
    })
  ) {
    console.log("写入目标不是站点构建时读的库，跳过部署触发。");
    return;
  }

  // .env.local 是这个命令的既定配置来源（见 readEnvLocal），但 cron / CI 里
  // 这个值通常只在进程环境里，两处都认。
  const hookUrl = env.VERCEL_DEPLOY_HOOK_URL || process.env.VERCEL_DEPLOY_HOOK_URL;
  const staleWarning =
    `⚠️  边缘缓存未刷新：${updatedRetest.case_slug} 的新分数最长滞后 24h 才会出现在首页 / 案例库 / 详情页。\n` +
    "    手动触发一次部署即可立刻生效（Vercel 控制台 Redeploy，或 curl -X POST $VERCEL_DEPLOY_HOOK_URL）。";

  if (!hookUrl) {
    console.warn(`\n${staleWarning}\n    根因：未配置 VERCEL_DEPLOY_HOOK_URL。`);
    return;
  }

  try {
    const res = await fetch(hookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      console.log("\n已触发部署，几分钟后新的复测结果在站上生效。");
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
