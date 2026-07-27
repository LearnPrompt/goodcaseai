#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  buildCasePayload,
  decidePublish,
} from "./review/lib/publish-candidate.mjs";

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
      "id, slug, title, category, source_platform, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, creator_name, summary, prompt_preview, prompt_full, content_locale, translations, translation_status, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, evidence_level, tags, import_batch_id"
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

  const counters = {
    inserted: 0,
    updated: 0,
    resumed: 0,
  };
  for (const item of approvedRows) {
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
      existingByCandidate,
      existingBySlug,
      allowUpdate,
    });
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
  }

  console.log(
    `候选发布完成：inserted=${counters.inserted}, updated=${counters.updated}, resumed=${counters.resumed}。模式=${
      allowUpdate ? "显式允许更新" : "只追加"
    }`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
