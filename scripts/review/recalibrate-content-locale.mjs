#!/usr/bin/env node
/**
 * 重跑已发布 Case 的语言判定。
 *
 * 背景：线上 311 条标为 zh-CN 的 Case 里，实测 86% 的 prompt_full 其实是英文，
 * 而 translations.en.promptFull 又是对这段英文再做一次机器翻译，
 * 导致 272/311 条译文与原文相似度超过 90%，前端的语言切换等于空操作。
 *
 * 本脚本只做两件确定性的事，不调用任何模型、不生成新译文：
 *   1. 按 prompt_full 的实际字符构成重判 content_locale
 *   2. 丢弃与原文高度重复的 translations 条目（保留 title / summary 的翻译）
 *
 * 安全约束（沿用项目既有规矩）：
 *   - 按 id 精确匹配，绝不按标题模糊匹配
 *   - 写库前先把受影响行的原始快照落到本地私有备份文件
 *   - 默认 dry-run，必须显式 --apply 才写库
 *
 * 用法：
 *   node scripts/review/recalibrate-content-locale.mjs            # dry-run
 *   node scripts/review/recalibrate-content-locale.mjs --apply    # 备份后写库
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { cjkRatio, detectLocale, similarity } from "./lib/content-locale.mjs";

// 判定逻辑已抽到 lib/content-locale.mjs，供给管线共用同一份；
// 这里继续导出是为了不破坏既有调用方和本脚本的对外签名。
export { cjkRatio, detectLocale, similarity };

const BACKUP_DIR = path.join(process.cwd(), "tmp", "locale-recalibration");
const SIMILARITY_THRESHOLD = 0.9;

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

export function planRow(row) {
  const promptFull = row.prompt_full || row.prompt_preview || "";
  const detected = detectLocale(promptFull);
  const translations = row.translations && typeof row.translations === "object"
    ? { ...row.translations }
    : {};

  const changes = {};

  if (detected !== row.content_locale) {
    changes.content_locale = detected;
  }

  // 与原文高度重复的 promptFull 译文没有任何价值，丢掉；title / summary 的翻译保留。
  let droppedPrompt = 0;
  for (const locale of Object.keys(translations)) {
    const entry = translations[locale];
    if (!entry || typeof entry !== "object" || !entry.promptFull) continue;
    if (similarity(promptFull, entry.promptFull) >= SIMILARITY_THRESHOLD) {
      const next = { ...entry };
      delete next.promptFull;
      translations[locale] = next;
      droppedPrompt += 1;
    }
  }
  if (droppedPrompt > 0) {
    changes.translations = translations;
  }

  return { changes, detected, droppedPrompt };
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

  const url = new URL("/rest/v1/cases", baseUrl);
  url.searchParams.set(
    "select",
    "id,slug,content_locale,translation_status,prompt_full,prompt_preview,translations"
  );
  url.searchParams.set("is_published", "eq.true");
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`读取 cases 失败：${response.status}`);
  }
  const rows = await response.json();

  const planned = [];
  const localeShift = { "zh-CN→en": 0, "en→zh-CN": 0 };
  let promptDrops = 0;

  for (const row of rows) {
    const { changes, detected, droppedPrompt } = planRow(row);
    if (!Object.keys(changes).length) continue;
    if (changes.content_locale) {
      localeShift[`${row.content_locale}→${detected}`] =
        (localeShift[`${row.content_locale}→${detected}`] || 0) + 1;
    }
    promptDrops += droppedPrompt;
    planned.push({ row, changes });
  }

  console.log(`已发布 ${rows.length} 条，需要修正 ${planned.length} 条`);
  console.log(`  content_locale 变更：${JSON.stringify(localeShift)}`);
  console.log(`  丢弃与原文重复的 promptFull 译文：${promptDrops} 条`);

  const batch = planned.slice(0, args.limit);

  if (!args.apply) {
    console.log("\n样例（前 8 条）：");
    for (const { row, changes } of batch.slice(0, 8)) {
      const bits = [];
      if (changes.content_locale)
        bits.push(`locale ${row.content_locale} → ${changes.content_locale}`);
      if (changes.translations) bits.push("丢弃重复译文");
      console.log(`  ${row.slug.slice(0, 38).padEnd(40)} ${bits.join("，")}`);
    }
    console.log(`\ndry-run，未写库。加 --apply 才会执行（会先落备份）。`);
    return;
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = rows.length && batch.length ? batch[0].row.id.slice(0, 8) : "empty";
  const backupPath = path.join(BACKUP_DIR, `before-${stamp}.json`);
  await writeFile(
    backupPath,
    `${JSON.stringify(batch.map(({ row }) => row), null, 2)}\n`
  );
  console.log(`\n原始快照已备份：${backupPath}`);

  let ok = 0;
  let failed = 0;
  for (const { row, changes } of batch) {
    const patchUrl = new URL("/rest/v1/cases", baseUrl);
    patchUrl.searchParams.set("id", `eq.${row.id}`);
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(changes),
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
