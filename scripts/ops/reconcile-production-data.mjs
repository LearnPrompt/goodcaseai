#!/usr/bin/env node

import { mkdir, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { caseItems } from "../../src/lib/mock-data.ts";

const APPLY = process.argv.includes("--apply");
const BACKUP_DIR = path.resolve("tmp/operator-backups");

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

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function loadPlan(supabase) {
  const { data: publishedCandidates, error: candidateError } = await supabase
    .from("case_candidates")
    .select("*")
    .eq("status", "published");
  assertResult(candidateError, "读取 published 候选失败");

  const linkedCaseIds = [
    ...new Set(
      (publishedCandidates ?? [])
        .map((item) => item.published_case_id)
        .filter(Boolean)
    ),
  ];
  const { data: linkedCases, error: linkedCasesError } = linkedCaseIds.length
    ? await supabase.from("cases").select("*").in("id", linkedCaseIds)
    : { data: [], error: null };
  assertResult(linkedCasesError, "读取关联 Case 失败");

  const linkedCaseMap = new Map((linkedCases ?? []).map((item) => [item.id, item]));
  const inconsistentCandidates = (publishedCandidates ?? []).filter((item) => {
    const linkedCase = linkedCaseMap.get(item.published_case_id);
    return linkedCase && linkedCase.is_published === false;
  });

  const evidenceDefinitions = caseItems.filter(
    (item) => item.sourceUrl && item.sourceMetricsCapturedAt
  );
  const evidenceSlugs = evidenceDefinitions.map((item) => item.slug);
  const { data: evidenceCases, error: evidenceError } = await supabase
    .from("cases")
    .select("*")
    .in("slug", evidenceSlugs);
  assertResult(evidenceError, "读取证据同步目标失败");

  if ((evidenceCases ?? []).length !== evidenceDefinitions.length) {
    throw new Error(
      `证据目标数量不匹配：定义=${evidenceDefinitions.length}，数据库=${evidenceCases?.length ?? 0}`
    );
  }

  const nonPublicEvidenceTargets = (evidenceCases ?? []).filter(
    (item) => item.is_published !== true
  );
  if (nonPublicEvidenceTargets.length) {
    throw new Error(`证据同步目标中有 ${nonPublicEvidenceTargets.length} 条不是公开 Case`);
  }

  return {
    publishedCandidates: publishedCandidates ?? [],
    linkedCases: linkedCases ?? [],
    inconsistentCandidates,
    evidenceDefinitions,
    evidenceCases: evidenceCases ?? [],
  };
}

async function writeBackup(plan) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(
    BACKUP_DIR,
    `${safeTimestamp()}-production-reconcile.json`
  );
  const payload = {
    createdAt: new Date().toISOString(),
    reason: "Repair candidate/public status and sync documented source snapshots",
    inconsistentCandidates: plan.inconsistentCandidates,
    linkedHiddenCases: plan.linkedCases.filter((item) =>
      plan.inconsistentCandidates.some(
        (candidate) => candidate.published_case_id === item.id
      )
    ),
    evidenceCasesBefore: plan.evidenceCases,
  };
  await writeFile(backupPath, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(backupPath, 0o600);
  return backupPath;
}

async function applyCandidateCorrection(supabase, plan, now) {
  const ids = plan.inconsistentCandidates.map((item) => item.id);
  if (!ids.length) {
    return 0;
  }

  const { data, error } = await supabase
    .from("case_candidates")
    .update({
      status: "pending",
      published_case_id: null,
      published_at: null,
      reviewed_at: null,
      updated_at: now,
    })
    .in("id", ids)
    .eq("status", "published")
    .select("id");
  assertResult(error, "修正候选状态失败");

  if ((data ?? []).length !== ids.length) {
    throw new Error(`候选修正数量不匹配：预期=${ids.length}，实际=${data?.length ?? 0}`);
  }
  return data.length;
}

async function applyEvidenceSync(supabase, plan) {
  let updated = 0;
  for (const item of plan.evidenceDefinitions) {
    const payload = {
      source_url: item.sourceUrl,
      source_like_count: item.sourceLikeCount ?? null,
      source_comment_count: item.sourceCommentCount ?? null,
      source_share_count: item.sourceShareCount ?? null,
      source_save_count: item.sourceSaveCount ?? null,
      source_published_at: item.sourcePublishedAt ?? null,
      source_metrics_captured_at: item.sourceMetricsCapturedAt,
      evidence_level: "L1",
    };
    const { data, error } = await supabase
      .from("cases")
      .update(payload)
      .eq("slug", item.slug)
      .eq("is_published", true)
      .select("id")
      .maybeSingle();
    assertResult(error, `同步证据失败（${item.slug}）`);
    if (!data) {
      throw new Error(`证据同步目标已变化（${item.slug}）`);
    }
    updated += 1;
  }
  return updated;
}

async function verify(supabase) {
  const [
    { count: publishedCandidates, error: candidateError },
    { data: publicCases, error: casesError },
  ] = await Promise.all([
    supabase
      .from("case_candidates")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("cases")
      .select("evidence_level, source_url, source_metrics_captured_at")
      .eq("is_published", true),
  ]);
  assertResult(candidateError, "复核候选状态失败");
  assertResult(casesError, "复核公开 Case 失败");

  const evidenceCounts = (publicCases ?? []).reduce((acc, item) => {
    const key = item.evidence_level || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    publishedCandidates,
    publicCases: publicCases?.length ?? 0,
    evidenceCounts,
    publicWithSourceSnapshot: (publicCases ?? []).filter(
      (item) => item.source_url && item.source_metrics_captured_at
    ).length,
    publicMissingSource: (publicCases ?? []).filter((item) => !item.source_url).length,
  };
}

async function main() {
  const supabase = getClient();
  const plan = await loadPlan(supabase);
  const preview = {
    mode: APPLY ? "apply" : "dry-run",
    publishedCandidatesBefore: plan.publishedCandidates.length,
    inconsistentCandidates: plan.inconsistentCandidates.length,
    evidenceCasesToSync: plan.evidenceDefinitions.length,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!APPLY) {
    return;
  }

  const backupPath = await writeBackup(plan);
  const now = new Date().toISOString();
  const correctedCandidates = await applyCandidateCorrection(supabase, plan, now);
  const syncedEvidenceCases = await applyEvidenceSync(supabase, plan);
  const verification = await verify(supabase);

  const { error: auditError } = await supabase.from("analytics_events").insert({
    event_name: "operator_action",
    path: "/operator",
    anonymous_session_id: "production-reconcile-script",
    properties: {
      action: "production_data_reconciled",
      correctedCandidates,
      syncedEvidenceCases,
      backupFile: path.basename(backupPath),
    },
  });
  assertResult(auditError, "写入校正审计失败");

  console.log(
    JSON.stringify(
      {
        backupPath,
        correctedCandidates,
        syncedEvidenceCases,
        verification,
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
