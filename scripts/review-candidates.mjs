#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  buildReviewPatch,
  parseTags,
  validateReview,
} from "./review/lib/review-candidate.mjs";

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=").trim() : null;
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listCandidates(supabase) {
  const status = getArg("--status") || "pending";
  const { data, error } = await supabase
    .from("case_candidates")
    .select(
      "id, status, evidence_level, title, creator_name, source_platform, source_url, source_metrics_captured_at, created_at"
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`读取候选失败：${error.message}`);
  }

  console.log(JSON.stringify(data || [], null, 2));
}

async function reviewCandidate(supabase, action) {
  const id = getArg("--id");
  const note = getArg("--note") || "";
  const evidenceLevel = getArg("--evidence-level");
  const tags = parseTags(getArg("--tags"));

  if (!id) {
    throw new Error("审核操作必须提供 --id=<candidate uuid>。");
  }

  const { data: candidate, error: fetchError } = await supabase
    .from("case_candidates")
    .select(
      "id, status, title, creator_name, summary, prompt_preview, prompt_full, source_url, source_like_count, source_comment_count, source_share_count, source_save_count, source_published_at, source_metrics_captured_at, evidence_level, tags"
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`读取候选失败：${fetchError.message}`);
  }
  if (!candidate) {
    throw new Error(`找不到候选：${id}`);
  }

  const input = {
    action,
    note,
    evidenceLevel,
    tags,
  };
  const validation = validateReview(candidate, input);
  if (!validation.ok) {
    throw new Error(`审核未通过：\n- ${validation.errors.join("\n- ")}`);
  }

  const reviewedAt = new Date().toISOString();
  const patch = buildReviewPatch(candidate, input, reviewedAt);
  const { data: updated, error: updateError } = await supabase
    .from("case_candidates")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select("id, slug, title, status, evidence_level, review_note, reviewed_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(`写入审核结果失败：${updateError.message}`);
  }
  if (!updated) {
    throw new Error("候选状态已变化，本次审核未写入；请重新读取后再操作。");
  }

  console.log(JSON.stringify(updated, null, 2));
}

async function main() {
  const action = getArg("--action") || "list";
  const supabase = getClient();

  if (action === "list") {
    await listCandidates(supabase);
    return;
  }

  if (action !== "approve" && action !== "reject") {
    throw new Error("--action 仅支持 list、approve、reject。");
  }

  await reviewCandidate(supabase, action);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
