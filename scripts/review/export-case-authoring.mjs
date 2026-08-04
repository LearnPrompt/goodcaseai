#!/usr/bin/env node
/**
 * 导出待翻译与待写方法的 Case，供离线模型（Codex 沙箱无网络）批量加工。
 *
 * 分工：本脚本负责联网取数与落盘，模型只在本地 JSON 上工作，
 * 加工结果由 import-case-authoring.mjs 校验后写回，模型全程不碰数据库。
 *
 * 两件事写进同一份导出，避免模型读两遍上下文：
 *   promptZh        —— 英文原文 Case 的中文 Prompt 翻译（275 条）
 *   resultBreakdown —— 三段式复用方法（关键决定 / 换到你的题材 / 容易翻车）
 *
 * resultBreakdown 复用数据库里已有的 translations[locale].resultBreakdown 三元组，
 * 不需要改表结构。
 *
 * 用法：
 *   node scripts/review/export-case-authoring.mjs
 *   node scripts/review/export-case-authoring.mjs --limit=20
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "tmp", "case-authoring");
const OUT_PATH = path.join(OUT_DIR, "export.json");

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

/** Prompt 里的参数占位符，翻译时必须原样保留，导入前按这个清单对账。 */
export function extractPlaceholders(text) {
  return (String(text || "").match(/\{argument\s+[^}]*\}/g) || []).sort();
}

function parseArgs(argv) {
  const raw = argv.find((a) => a.startsWith("--limit="));
  const n = raw ? Number.parseInt(raw.slice("--limit=".length), 10) : NaN;
  return { limit: Number.isFinite(n) && n > 0 ? n : Infinity };
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

  const url = new URL("/rest/v1/cases", baseUrl);
  url.searchParams.set(
    "select",
    "id,slug,title,category,creator_name,source_platform,recommended_models,summary,prompt_full,prompt_preview,content_locale,stability_score,translations"
  );
  url.searchParams.set("is_published", "eq.true");
  url.searchParams.set("order", "created_at.desc");
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`读取 cases 失败：${response.status}`);
  }
  const rows = await response.json();

  const items = [];
  for (const row of rows.slice(0, args.limit)) {
    const prompt = row.prompt_full || row.prompt_preview || "";
    if (!prompt.trim()) continue;

    const translations = row.translations || {};
    const hasZhPrompt = Boolean(translations["zh-CN"]?.promptFull);
    const hasMethod =
      Array.isArray(translations["zh-CN"]?.resultBreakdown) &&
      translations["zh-CN"].resultBreakdown.length === 3;

    items.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      creator: row.creator_name,
      platform: row.source_platform,
      models: row.recommended_models || [],
      summary: row.summary,
      contentLocale: row.content_locale,
      stabilityScore: row.stability_score,
      prompt,
      placeholders: extractPlaceholders(prompt),
      // 只有英文原文才需要中文 Prompt 翻译；中文原文本来就能读。
      needsPromptZh: row.content_locale === "en" && !hasZhPrompt,
      needsMethod: !hasMethod,
      // 待填字段，模型只写这两个 key，其余原样保留
      promptZh: null,
      resultBreakdown: null,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(items, null, 2)}\n`);

  const needTrans = items.filter((i) => i.needsPromptZh).length;
  const needMethod = items.filter((i) => i.needsMethod).length;
  const withPlaceholders = items.filter((i) => i.placeholders.length).length;
  console.log(`导出 ${items.length} 条 → ${OUT_PATH}`);
  console.log(`  需要中文 Prompt 翻译：${needTrans} 条`);
  console.log(`  需要复用方法：${needMethod} 条`);
  console.log(`  含参数占位符（翻译时必须原样保留）：${withPlaceholders} 条`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
