#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  }

  const batch = getArg("--batch");

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("case_candidates")
    .select(
      "id, slug, title, category, source_platform, creator_name, summary, prompt_preview, prompt_full, media_kind, media_url, poster_url, remake_count, stability_score, favorite_score, recommended_models, cost_band, import_batch_id"
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

  const upsertPayload = approvedRows.map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.category,
    source_platform: item.source_platform,
    creator_name: item.creator_name,
    summary: item.summary,
    prompt_preview: item.prompt_preview,
    prompt_full: item.prompt_full,
    media_kind: item.media_kind,
    media_url: item.media_url,
    poster_url: item.poster_url,
    remake_count: item.remake_count,
    stability_score: item.stability_score,
    favorite_score: item.favorite_score,
    recommended_models: item.recommended_models || [],
    cost_band: item.cost_band,
    is_published: true,
  }));

  const { data: publishedCases, error: upsertError } = await supabase
    .from("cases")
    .upsert(upsertPayload, { onConflict: "slug" })
    .select("id, slug");

  if (upsertError) {
    throw new Error(`发布到 cases 失败：${upsertError.message}`);
  }

  const idBySlug = new Map((publishedCases || []).map((item) => [item.slug, item.id]));
  const now = new Date().toISOString();

  for (const item of approvedRows) {
    const publishedCaseId = idBySlug.get(item.slug) || null;
    const { error: updateError } = await supabase
      .from("case_candidates")
      .update({
        status: "published",
        published_case_id: publishedCaseId,
        published_at: now,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", item.id);

    if (updateError) {
      throw new Error(`更新候选状态失败（${item.slug}）：${updateError.message}`);
    }
  }

  console.log(`已发布 ${approvedRows.length} 条案例到 cases。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
