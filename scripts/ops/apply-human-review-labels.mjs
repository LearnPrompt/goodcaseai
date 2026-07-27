#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { validateReview } from "../review/lib/review-candidate.mjs";
import {
  buildHumanReviewPlan,
  normalizeReviewItems,
} from "./lib/human-review-mapping.mjs";

const APPLY = process.argv.includes("--apply");
const LABEL_FILES = [
  "scripts/review/data/image-v1-calibration-2026-07-26.json",
  "scripts/review/data/image-v1-followup-results-2026-07-27.json",
  "scripts/review/data/image-v1-shortlist-results-2026-07-27.json",
  "scripts/review/data/image-v1-final-confirm-results-2026-07-27.json",
  "scripts/review/data/web-v1-human-labels-2026-07-27.json",
  "scripts/review/data/web-v2-human-labels-2026-07-27.json",
  "scripts/review/data/web-v3-human-labels-2026-07-27.json",
];

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("缺少 Supabase 服务端环境变量");
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assertResult(error, context) {
  if (error) {
    throw new Error(`${context}：${error.message}`);
  }
}

async function loadLabels() {
  const labels = [];
  for (const relativePath of LABEL_FILES) {
    const payload = JSON.parse(await readFile(relativePath, "utf8"));
    const reviewKey =
      payload.review_key || path.basename(relativePath, path.extname(relativePath));
    labels.push(...normalizeReviewItems(reviewKey, payload));
  }
  return labels;
}

async function loadCandidates(supabase) {
  const { data, error } = await supabase
    .from("case_candidates")
    .select(
      "id, status, title, creator_name, summary, prompt_preview, prompt_full, source_url, media_url, evidence_level, tags, review_note, reviewed_at"
    )
    .order("created_at", { ascending: true })
    .limit(10_000);
  assertResult(error, "读取生产候选失败");
  return data || [];
}

function decisionCounts(labels) {
  return labels.reduce((counts, label) => {
    counts[label.decision] = (counts[label.decision] || 0) + 1;
    return counts;
  }, {});
}

function groupUnmatched(items) {
  return items.reduce((counts, item) => {
    const reviewKey = item.key.split(":")[0];
    counts[reviewKey] = (counts[reviewKey] || 0) + 1;
    return counts;
  }, {});
}

function validateApprovals(plan) {
  return plan.approve
    .map((entry) => {
      const validation = validateReview(entry.candidate, {
        action: "approve",
        note: "Carl 人工审核标签映射",
        evidenceLevel: entry.candidate.evidence_level,
        tags: entry.candidate.tags || [],
      });
      return validation.ok
        ? null
        : {
            key: entry.key,
            candidateId: entry.candidate.id,
            errors: validation.errors,
          };
    })
    .filter(Boolean);
}

async function updateBatch(supabase, entries, status, note, reviewedAt) {
  if (entries.length === 0) return 0;
  const ids = entries.map((entry) => entry.candidate.id);
  const { data, error } = await supabase
    .from("case_candidates")
    .update({
      status,
      review_note: note,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .in("id", ids)
    .eq("status", "pending")
    .select("id");
  assertResult(error, `批量写入 ${status} 失败`);
  if ((data || []).length !== ids.length) {
    throw new Error(
      `${status} 写入数量不匹配：预期=${ids.length}，实际=${data?.length || 0}`
    );
  }
  return data.length;
}

async function readStatusCounts(supabase) {
  const statuses = ["pending", "approved", "rejected", "published"];
  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("case_candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
    )
  );
  const counts = {};
  for (let index = 0; index < statuses.length; index += 1) {
    assertResult(results[index].error, `复核 ${statuses[index]} 计数失败`);
    counts[statuses[index]] = results[index].count || 0;
  }
  return counts;
}

async function main() {
  const supabase = getClient();
  const [labels, candidates] = await Promise.all([
    loadLabels(),
    loadCandidates(supabase),
  ]);
  const plan = buildHumanReviewPlan(labels, candidates);
  const invalidApprovals = validateApprovals(plan);
  const preview = {
    mode: APPLY ? "apply" : "dry-run",
    labels: labels.length,
    decisions: decisionCounts(labels),
    productionCandidates: candidates.length,
    matched: {
      approve: plan.approve.length,
      reject: plan.reject.length,
      holdPending: plan.hold.length,
      alreadyApplied: plan.alreadyApplied.length,
    },
    unmatched: {
      total: plan.unmatched.length,
      byReviewKey: groupUnmatched(plan.unmatched),
    },
    conflicts: plan.conflicts,
    invalidApprovals,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!APPLY) return;
  if (
    plan.conflicts.length ||
    invalidApprovals.length
  ) {
    throw new Error("存在状态冲突或无效批准项，拒绝写入生产");
  }

  const backupPath = path.resolve(getArg("--backup-path"));
  if (!getArg("--backup-path")) {
    throw new Error("--apply 必须提供 --backup-path=<已完成的备份目录>");
  }
  await access(path.join(backupPath, "case_candidates.json"));
  await access(path.join(backupPath, "cases.json"));

  const reviewedAt = new Date().toISOString();
  const approved = await updateBatch(
    supabase,
    plan.approve,
    "approved",
    "Carl 人工审核：拟录入（本地标签映射）",
    reviewedAt
  );
  const rejected = await updateBatch(
    supabase,
    plan.reject,
    "rejected",
    "Carl 人工审核：不收录（本地标签映射）",
    reviewedAt
  );
  const statusCounts = await readStatusCounts(supabase);

  const { error: auditError } = await supabase.from("analytics_events").insert({
    event_name: "operator_action",
    path: "/operator",
    anonymous_session_id: "human-review-label-mapper",
    properties: {
      action: "human_review_labels_mapped",
      approved,
      rejected,
      holdPending: plan.hold.length,
      unmatched: plan.unmatched.length,
      backupDirectory: path.basename(backupPath),
    },
  });
  assertResult(auditError, "写入人工标签映射审计失败");

  console.log(
    JSON.stringify(
      {
        applied: { approved, rejected },
        holdPending: plan.hold.length,
        unmatched: plan.unmatched.length,
        backupPath,
        statusCounts,
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
