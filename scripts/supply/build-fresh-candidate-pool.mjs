#!/usr/bin/env node

import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  candidateToSourceReviewItem,
  selectFreshCandidatePool,
} from "./lib/fresh-candidate-pool.mjs";

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("缺少 Supabase 服务端环境变量。");
  }
  const inputPaths = getArg("--inputs")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!inputPaths.length) {
    throw new Error("--inputs 必须提供至少一个候选 JSON。");
  }
  const limit = positiveInt(getArg("--limit"), 70);
  const category = getArg("--category", "image");
  const runDate = getArg("--date", "2026-07-28");
  const outputDir = path.resolve(
    getArg("--output-dir", "tmp/supply-reports/image-v5")
  );
  const groups = await Promise.all(
    inputPaths.map(async (inputPath) => ({
      label: path.basename(path.dirname(inputPath)),
      items: await readJson(path.resolve(inputPath)),
    }))
  );
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [candidateResult, caseResult] = await Promise.all([
    supabase.from("case_candidates").select("source_url").limit(10_000),
    supabase.from("cases").select("source_url").limit(10_000),
  ]);
  if (candidateResult.error || caseResult.error) {
    throw new Error(
      `读取现有来源失败：${
        candidateResult.error?.message || caseResult.error?.message
      }`
    );
  }
  const existingUrls = [
    ...(candidateResult.data || []),
    ...(caseResult.data || []),
  ]
    .map((item) => item.source_url)
    .filter(Boolean);
  const pool = selectFreshCandidatePool(groups, {
    existingUrls,
    category,
    limit,
  });
  const reviewItems = pool.items.map(candidateToSourceReviewItem);
  const report = {
    schemaVersion: 1,
    mode: "shadow",
    runDate,
    generatedAt: new Date().toISOString(),
    title: "图片榜 V5 新来源审核",
    stats: {
      total: reviewItems.length,
      cases: reviewItems.filter((item) => item.candidateType === "case").length,
      topicSeeds: reviewItems.filter(
        (item) => item.candidateType === "topic_seed"
      ).length,
      ...pool.stats,
    },
    sources: [
      {
        id: "youmind",
        label: "YouMind Prompt Library",
        collected: reviewItems.length,
        cases: reviewItems.filter((item) => item.candidateType === "case").length,
        topicSeeds: reviewItems.filter(
          (item) => item.candidateType === "topic_seed"
        ).length,
        error: "",
      },
    ],
    items: reviewItems,
  };
  await mkdir(outputDir, { recursive: true });
  const candidatePath = path.join(
    outputDir,
    `${runDate}-image-fresh-candidates.json`
  );
  const reviewPath = path.join(outputDir, `${runDate}-image-fresh-review.json`);
  await writeFile(candidatePath, `${JSON.stringify(pool.items, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(candidatePath, 0o600);
  await writeFile(reviewPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(reviewPath, 0o600);
  console.log(
    JSON.stringify(
      {
        candidatePath,
        reviewPath,
        selected: pool.items.length,
        target: limit,
        byInput: pool.stats.byInput,
        existingOrLocalDuplicates: pool.stats.existingOrLocalDuplicates,
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
