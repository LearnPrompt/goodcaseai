#!/usr/bin/env node
/**
 * 重跑「未发布候选」的语言判定。
 *
 * 背景：case_candidates.content_locale 长期是 not null default 'zh-CN'，
 * 上游又从来不写这个字段，于是每条候选一入库就是 zh-CN，跟 Prompt 正文无关。
 * 已发布的那批由 recalibrate-content-locale.mjs 在 2026-08-03 修过，
 * 但还压在候选表里没发布的那批没人管，一旦发布就会把错的语言带到线上。
 *
 * 本脚本只改 content_locale 一个字段，不碰 translations、不碰状态、不发布任何东西。
 * 判定逻辑跟发布管线共用 lib/content-locale.mjs，口径完全一致。
 *
 * 安全约束（沿用 recalibrate-content-locale.mjs 的规矩）：
 *   - 只处理 status != 'published' 的候选，已发布的走 cases 表那个脚本
 *   - 按 id 精确匹配，绝不按标题模糊匹配
 *   - 写库前先把受影响行的原始快照落到本地私有备份文件
 *   - 默认 dry-run，必须显式 --apply 才写库
 *
 * 用法：
 *   node scripts/review/recalibrate-candidate-locale.mjs            # dry-run
 *   node scripts/review/recalibrate-candidate-locale.mjs --apply    # 备份后写库
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { detectLocale } from "./lib/content-locale.mjs";

const BACKUP_DIR = path.join(process.cwd(), "tmp", "locale-recalibration");

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    limit: (() => {
      const raw = argv.find((a) => a.startsWith("--limit="));
      if (!raw) return Infinity;
      const n = Number.parseInt(raw.slice("--limit=".length), 10);
      return Number.isFinite(n) && n > 0 ? n : Infinity;
    })(),
  };
}

async function readEnvLocal() {
  try {
    const text = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const m = line.trim().match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let value = m[2].trim();
      if (
        value.length >= 2 &&
        value[0] === value[value.length - 1] &&
        (value[0] === '"' || value[0] === "'")
      ) {
        value = value.slice(1, -1);
      }
      env[m[1]] = value;
    }
    return env;
  } catch {
    return {};
  }
}

/** 只在正文明确指向另一种语言时才改；没有正文的候选保持原样，交给人工。 */
export function planCandidateRow(row) {
  const text = row.prompt_full || row.prompt_preview || "";
  if (!text.trim()) {
    return { skip: "无 Prompt 正文", detected: null };
  }
  const detected = detectLocale(text);
  if (detected === row.content_locale) {
    return { skip: null, detected, changed: false };
  }
  return { skip: null, detected, changed: true };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = { ...(await readEnvLocal()), ...process.env };
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const url = new URL("/rest/v1/case_candidates", baseUrl);
  url.searchParams.set(
    "select",
    "id,slug,status,content_locale,prompt_full,prompt_preview"
  );
  url.searchParams.set("status", "neq.published");
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`读取 case_candidates 失败：${response.status}`);
  }
  const rows = await response.json();

  const planned = [];
  const shift = {};
  let skipped = 0;

  for (const row of rows) {
    const { skip, detected, changed } = planCandidateRow(row);
    if (skip) {
      skipped += 1;
      continue;
    }
    if (!changed) continue;
    const key2 = `${row.content_locale ?? "null"}→${detected}`;
    shift[key2] = (shift[key2] || 0) + 1;
    planned.push({ row, detected });
  }

  console.log(`未发布候选 ${rows.length} 条，需要修正 ${planned.length} 条`);
  console.log(`  content_locale 变更：${JSON.stringify(shift)}`);
  console.log(`  无 Prompt 正文、跳过不动：${skipped} 条`);

  const batch = planned.slice(0, args.limit);

  if (!args.apply) {
    console.log("\n样例（前 8 条）：");
    for (const { row, detected } of batch.slice(0, 8)) {
      console.log(
        `  ${String(row.slug).slice(0, 38).padEnd(40)} ${row.status.padEnd(10)} ${
          row.content_locale ?? "null"
        } → ${detected}`
      );
    }
    console.log(`\ndry-run，未写库。加 --apply 才会执行（会先落备份）。`);
    return;
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = batch.length ? batch[0].row.id.slice(0, 8) : "empty";
  const backupPath = path.join(BACKUP_DIR, `candidates-before-${stamp}.json`);
  await writeFile(
    backupPath,
    `${JSON.stringify(batch.map(({ row }) => row), null, 2)}\n`
  );
  console.log(`\n原始快照已备份：${backupPath}`);

  let ok = 0;
  let failed = 0;
  for (const { row, detected } of batch) {
    const patchUrl = new URL("/rest/v1/case_candidates", baseUrl);
    patchUrl.searchParams.set("id", `eq.${row.id}`);
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ content_locale: detected }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) ok += 1;
    else {
      failed += 1;
      console.log(`  ✗ ${row.slug}  HTTP ${res.status} ${await res.text()}`);
    }
  }

  console.log(`\n写入成功 ${ok} 条，失败 ${failed} 条`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
