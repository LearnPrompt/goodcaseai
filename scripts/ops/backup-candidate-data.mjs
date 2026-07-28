#!/usr/bin/env node

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function safeTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function writePrivateJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(filePath, 0o600);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("缺少 Supabase 服务端环境变量");
  }

  const outputDir = path.resolve(
    getArg(
      "--output-dir",
      `tmp/db-backups/${safeTimestamp()}-before-candidate-import`
    )
  );
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [candidateResult, caseResult] = await Promise.all([
    supabase
      .from("case_candidates")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(10_000),
    supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(10_000),
  ]);
  if (candidateResult.error || caseResult.error) {
    throw new Error(
      `备份读取失败：${candidateResult.error?.message || caseResult.error?.message}`
    );
  }

  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const candidatePath = path.join(outputDir, "case_candidates.json");
  const casePath = path.join(outputDir, "cases.json");
  await writePrivateJson(candidatePath, candidateResult.data || []);
  await writePrivateJson(casePath, caseResult.data || []);

  console.log(
    JSON.stringify(
      {
        outputDir,
        candidates: candidateResult.data?.length || 0,
        cases: caseResult.data?.length || 0,
        permissions: "0600 files",
      },
      null,
      2
    )
  );
}

await main();
