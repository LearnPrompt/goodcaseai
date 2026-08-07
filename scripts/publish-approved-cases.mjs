#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  buildCasePayload,
  decidePublish,
  shouldTriggerDeploy,
} from "./review/lib/publish-candidate.mjs";
import { describeLocaleMismatch } from "./review/lib/content-locale.mjs";
import { findDuplicateContent } from "./review/lib/duplicate-governance.mjs";
import { loadPublishedContentIndex } from "./review/lib/published-content-index.mjs";

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}


async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  }

  const batch = getArg("--batch");
  const allowUpdate = hasFlag("--allow-update");

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("case_candidates")
    .select(
      "id, slug, title, category, source_platform, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, creator_name, creator_avatar_url, summary, prompt_preview, prompt_full, content_locale, translations, translation_status, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, evidence_level, tags, import_batch_id"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (batch) {
    query = query.eq("import_batch_id", batch);
  }

  const { data: approvedRows, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`读取审核数据失败：${fetchError.message}`);
  }

  if (!approvedRows || approvedRows.length === 0) {
    console.log("没有待发布的 approved 记录。");
    return;
  }

  const batchCategories = [
    ...new Set(approvedRows.map((item) => item.category).filter(Boolean)),
  ];
  let knownContent;
  try {
    knownContent = await loadPublishedContentIndex(supabase, batchCategories);
  } catch (error) {
    throw new Error(
      `读取已发布 Case 以做重复治理失败：${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const counters = {
    inserted: 0,
    updated: 0,
    resumed: 0,
    duplicateBlocked: 0,
  };
  // 存量候选的 content_locale 是库默认值填的，读出来和人工声明的一模一样，
  // buildCasePayload 只能照单全收。这里把对不上的行喊出来，别让它们悄悄发出去。
  const localeMismatches = [];
  const duplicateBlocks = [];
  for (const item of approvedRows) {
    // 重复是**跳过这一条**，不是中断整批：循环逐条写库，一 throw 就会让
    // 后面的候选全都发不出去，而且每次重跑都卡在同一条。闸门仍然是
    // fail-closed（被拦的绝不入库），只是不再连坐。
    const duplicate = findDuplicateContent({
      candidate: item,
      existingCases: knownContent,
      ignoreCandidateId: item.id,
      ignoreSlug: item.slug,
    });
    if (duplicate) {
      duplicateBlocks.push({ slug: item.slug, ...duplicate });
      counters.duplicateBlocked += 1;
      continue;
    }

    const mismatch = describeLocaleMismatch(item);
    if (mismatch) {
      localeMismatches.push({ slug: item.slug, ...mismatch });
    }

    const [{ data: existingByCandidate, error: candidateLookupError }, {
      data: existingBySlug,
      error: slugLookupError,
    }] = await Promise.all([
      supabase
        .from("cases")
        .select("id, slug, source_candidate_id")
        .eq("source_candidate_id", item.id)
        .maybeSingle(),
      supabase
        .from("cases")
        .select("id, slug, source_candidate_id")
        .eq("slug", item.slug)
        .maybeSingle(),
    ]);

    if (candidateLookupError || slugLookupError) {
      throw new Error(
        `检查已发布 Case 失败（${item.slug}）：${
          candidateLookupError?.message || slugLookupError?.message
        }`
      );
    }

    const decision = decidePublish({
      candidateId: item.id,
      candidate: item,
      existingByCandidate,
      existingBySlug,
      allowUpdate,
    });
    if (decision.action === "blocked") {
      throw new Error(
        `发布拦截（${item.slug}）：${decision.reason}。请修好候选的媒体字段再发布。`
      );
    }
    if (decision.action === "conflict") {
      throw new Error(
        `发布冲突（${item.slug}）：${decision.reason}。${
          allowUpdate ? "" : "确认要更新未绑定的同 slug Case 时显式加 --allow-update。"
        }`
      );
    }

    const payload = buildCasePayload(item);
    let publishedCase;
    if (decision.action === "insert") {
      const { data, error } = await supabase
        .from("cases")
        .insert(payload)
        .select("id, slug")
        .single();
      if (error) {
        throw new Error(`发布到 cases 失败（${item.slug}）：${error.message}`);
      }
      publishedCase = data;
      counters.inserted += 1;
    } else {
      const { data, error } = await supabase
        .from("cases")
        .update(payload)
        .eq("id", decision.caseId)
        .select("id, slug")
        .single();
      if (error) {
        throw new Error(`恢复或更新 Case 失败（${item.slug}）：${error.message}`);
      }
      publishedCase = data;
      counters[decision.action === "resume" ? "resumed" : "updated"] += 1;
    }

    const now = new Date().toISOString();
    const { data: updatedCandidate, error: updateError } = await supabase
      .from("case_candidates")
      .update({
        status: "published",
        published_case_id: publishedCase.id,
        published_at: now,
        updated_at: now,
      })
      .eq("id", item.id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(`更新候选状态失败（${item.slug}）：${updateError.message}`);
    }
    if (!updatedCandidate) {
      throw new Error(
        `候选状态已变化（${item.slug}）；Case 已绑定 source_candidate_id，可重新运行安全收尾。`
      );
    }

    knownContent.push({
      slug: item.slug,
      source_candidate_id: item.id,
      category: item.category,
      source_url: item.source_url,
      creator_name: item.creator_name,
      prompt_full: item.prompt_full,
    });
  }

  console.log(
    `候选发布完成：inserted=${counters.inserted}, updated=${counters.updated}, resumed=${counters.resumed}, 重复拦截=${counters.duplicateBlocked}。模式=${
      allowUpdate ? "显式允许更新" : "只追加"
    }`
  );

  if (duplicateBlocks.length > 0) {
    console.error(
      `\n⛔ ${duplicateBlocks.length} 条候选被重复治理拦下，未发布（其余已正常发布）：`
    );
    for (const item of duplicateBlocks) {
      console.error(
        `  ${String(item.slug).slice(0, 38).padEnd(40)} ${item.message}，命中 ${
          item.existingSlug || "未知 Case"
        }`
      );
    }
    console.error(
      "  逐条到 /operator 处理（改来源、改 Prompt 或直接拒绝），处理完再重跑本命令。"
    );
    // 已发布的部分是真发布了，但这批没干净跑完，退出码要能被脚本感知。
    process.exitCode = 1;
  }

  if (localeMismatches.length > 0) {
    console.warn(
      `\n⚠️  ${localeMismatches.length} 条候选声明的语言和 Prompt 正文对不上，已按声明值发布：`
    );
    for (const item of localeMismatches.slice(0, 10)) {
      console.warn(
        `  ${String(item.slug).slice(0, 38).padEnd(40)} 声明 ${item.declared}，正文看着是 ${
          item.detected
        }（中日文占比 ${(item.cjkRatio * 100).toFixed(1)}%）`
      );
    }
    if (localeMismatches.length > 10) {
      console.warn(`  ……等共 ${localeMismatches.length} 条`);
    }
    console.warn(
      "  多半是 migration 落地前入库的存量候选，跑 scripts/review/recalibrate-candidate-locale.mjs 修。"
    );
  }

  // 详情页是构建期全量预渲染的，新发布的 slug 不重新部署就访问不到。
  // 没配 hook 就只提示一句，不当成失败——库已经写完了。
  if (shouldTriggerDeploy(counters)) {
    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!hookUrl) {
      console.warn(
        "\n⚠️  未配置 VERCEL_DEPLOY_HOOK_URL，新发布的 Case 要等下一次部署才可访问。"
      );
    } else {
      try {
        const res = await fetch(hookUrl, {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
        });
        console.log(
          res.ok
            ? "\n已触发部署，几分钟后新 Case 上线。"
            : `\n⚠️  部署触发失败（HTTP ${res.status}），请手动重新部署。`
        );
      } catch (error) {
        console.warn(
          `\n⚠️  部署触发失败（${
            error instanceof Error ? error.message : String(error)
          }），请手动重新部署。`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
