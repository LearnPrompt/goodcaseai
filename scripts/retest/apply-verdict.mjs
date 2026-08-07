#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./lib/env.mjs";
import {
  buildCaseStabilityPatch,
  buildVerdictUpdate,
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

  const patch = buildCaseStabilityPatch(rows || []);
  if (!patch) {
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
    console.warn(`verdict 已写入，但 ${updatedRetest.case_slug} 当前没有已发布 Case，未同步分数。`);
    return;
  }

  console.log(
    `复测 verdict 已写入：${updatedRetest.case_slug} → stability_score=${updatedCase.stability_score}, evidence_level=${updatedCase.evidence_level}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

