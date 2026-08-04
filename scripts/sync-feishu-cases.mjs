#!/usr/bin/env node
// 飞书多维表 → Supabase cases 表同步脚本
//
// 用法：
//   node scripts/sync-feishu-cases.mjs --seed [--dry-run]   # 用 mock-data.ts 的 12 条真实 case 灌库并下架假数据
//   node scripts/sync-feishu-cases.mjs [--dry-run]          # 从飞书 Base 拉「已采纳」记录增量同步（定时任务跑这个）
//
// 依赖：lark-cli（机器人身份需 bitable:app:readonly + base:record:retrieve scope）、.env.local 里的 Supabase 凭证

import { execFileSync } from "node:child_process";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { resolveContentLocale } from "./review/lib/content-locale.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEISHU_APP_TOKEN = "QeLabhd3WaySZNs31oCcCtIgnoe";
const FEISHU_TABLE_ID = "tblSN6XFmpdNRssf";
const LOG_FILE = path.join(APP_DIR, "logs", "sync-feishu-cases.log");

const isDryRun = process.argv.includes("--dry-run");
const isSeed = process.argv.includes("--seed");

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // 日志写不进去不阻塞同步
  }
}

function loadEnv() {
  const envPath = path.join(APP_DIR, ".env.local");
  const env = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(".env.local 缺少 Supabase 凭证");
  }
  return env;
}

function getSupabase() {
  const env = loadEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- seed 模式：mock-data.ts → cases ----------

function loadMockCases() {
  // mock-data.ts 里 caseItems 是纯 JSON 字面量数组，直接截取解析，避免引入 TS 编译
  const source = readFileSync(path.join(APP_DIR, "src/lib/mock-data.ts"), "utf8");
  const start = source.indexOf("export const caseItems");
  const open = source.indexOf("[", source.indexOf("=", start));
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return JSON.parse(source.slice(open, end + 1));
}

function mockToRow(item) {
  return {
    slug: item.slug,
    title: item.title,
    category: item.category,
    source_platform: item.source,
    creator_name: item.creator,
    summary: item.summary,
    prompt_preview: item.promptPreview,
    prompt_full: item.promptFull,
    content_locale: resolveContentLocale({
      content_locale: item.contentLocale,
      prompt_full: item.promptFull,
      prompt_preview: item.promptPreview,
    }),
    media_kind: item.mediaType,
    media_url: item.mediaUrl,
    poster_url: item.posterUrl ?? null,
    remake_count: item.remakeCount,
    stability_score: item.stabilityScore,
    favorite_score: item.favoriteScore,
    recommended_models: item.recommendedModels,
    cost_band: item.costBand,
    is_published: true,
  };
}

async function runSeed(supabase) {
  const rows = loadMockCases().map(mockToRow);
  const keepSlugs = new Set(rows.map((r) => r.slug));
  log(`seed：待写入 ${rows.length} 条真实 case`);
  rows.forEach((r) => log(`  upsert ${r.slug} | ${r.title}`));

  const { data: existing, error: listError } = await supabase
    .from("cases")
    .select("slug,title")
    .eq("is_published", true);
  if (listError) throw new Error(`读取现有数据失败：${listError.message}`);
  const toUnpublish = existing.filter((r) => !keepSlugs.has(r.slug));
  log(`seed：待下架旧假数据 ${toUnpublish.length} 条（is_published=false，不删行）`);
  toUnpublish.slice(0, 10).forEach((r) => log(`  unpublish ${r.slug} | ${r.title}`));
  if (toUnpublish.length > 10) log(`  ……等共 ${toUnpublish.length} 条`);

  if (isDryRun) {
    log("seed：dry-run 结束，未写库");
    return;
  }

  const { error: upsertError } = await supabase.from("cases").upsert(rows, { onConflict: "slug" });
  if (upsertError) throw new Error(`写入真实 case 失败：${upsertError.message}`);

  const unpublishSlugs = toUnpublish.map((r) => r.slug);
  if (unpublishSlugs.length > 0) {
    const { error: unpubError } = await supabase
      .from("cases")
      .update({ is_published: false })
      .in("slug", unpublishSlugs);
    if (unpubError) throw new Error(`下架旧数据失败：${unpubError.message}`);
  }
  log(`seed：完成。上架 ${rows.length} 条，下架 ${unpublishSlugs.length} 条`);
}

// ---------- 飞书同步模式：Bitable「已采纳」→ cases ----------

function larkApi(method, apiPath, data) {
  const args = ["api", method, apiPath, "--as", "bot"];
  if (data) args.push("--data", JSON.stringify(data));
  let raw;
  try {
    raw = execFileSync("lark-cli", args, { encoding: "utf8", timeout: 60_000 });
  } catch (error) {
    const detail = String(error.stdout || error.stderr || error.message).slice(0, 400);
    throw new Error(`lark-cli 调用失败 ${apiPath}：${detail}`);
  }
  const parsed = JSON.parse(raw);
  if (parsed.ok === false || (parsed.code !== undefined && parsed.code !== 0)) {
    throw new Error(`lark-cli 调用失败 ${apiPath}：${parsed.error?.message ?? parsed.msg}`);
  }
  return parsed.data ?? parsed;
}

function textOf(field) {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  if (Array.isArray(field)) return field.map((seg) => seg.text ?? "").join("").trim();
  if (typeof field === "object" && field.text) return String(field.text).trim();
  return String(field).trim();
}

function fetchFeishuRecords() {
  const records = [];
  let pageToken;
  do {
    const query = pageToken ? `?page_size=100&page_token=${pageToken}` : "?page_size=100";
    const data = larkApi(
      "GET",
      `/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records${query}`,
    );
    records.push(...(data.items ?? []));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);
  return records;
}

function slugifyTitle(title, recordId) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `fs-${base || "case"}-${recordId.slice(-6).toLowerCase()}`;
}

async function runFeishuSync(supabase) {
  log("feishu：拉取多维表记录");
  const records = fetchFeishuRecords();
  const adopted = records.filter((r) => textOf(r.fields["采纳状态"]) === "已采纳");
  log(`feishu：共 ${records.length} 条记录，已采纳 ${adopted.length} 条`);

  const { data: existing, error: listError } = await supabase.from("cases").select("slug,title");
  if (listError) throw new Error(`读取现有数据失败：${listError.message}`);
  const existingTitles = new Map(existing.map((r) => [r.title.trim(), r.slug]));
  const existingSlugs = new Set(existing.map((r) => r.slug));

  let updated = 0;
  const inserted = [];
  for (const record of adopted) {
    const f = record.fields;
    const title = textOf(f["标题"]);
    if (!title) continue;
    const prompt = textOf(f["Prompt"]);
    const form = textOf(f["形式"]);
    const link = textOf(f["链接"]) || (typeof f["链接"] === "object" ? f["链接"]?.link ?? "" : "");
    const category = /视频|video/i.test(form) ? "video" : "image";

    const matchedSlug = existingTitles.get(title) ?? [...existingTitles.entries()].find(([t]) => t.includes(title) || title.includes(t))?.[1];

    if (matchedSlug) {
      // 已有条目：只更新 prompt 文本，不碰媒体、分数、发布状态
      if (prompt && !isDryRun) {
        const { error } = await supabase
          .from("cases")
          .update({ prompt_full: prompt, prompt_preview: `${prompt.slice(0, 160)}${prompt.length > 160 ? "..." : ""}` })
          .eq("slug", matchedSlug);
        if (error) throw new Error(`更新 ${matchedSlug} 失败：${error.message}`);
      }
      updated += 1;
      continue;
    }

    // 新条目：insert 为未发布（媒体附件与分数需人工/后续流程补齐后再上架）
    const slug = slugifyTitle(title, record.record_id);
    if (existingSlugs.has(slug)) continue;
    const row = {
      slug,
      title,
      category,
      source_platform: link || null,
      creator_name: textOf(f["作者联系方式"]) || null,
      summary: `来自飞书多维表的已采纳案例：${title}`,
      prompt_preview: prompt ? `${prompt.slice(0, 160)}${prompt.length > 160 ? "..." : ""}` : null,
      prompt_full: prompt || null,
      // 飞书表里没有语言字段，按 Prompt 正文判定；cases 表这一列是 not null，必须给值。
      content_locale: resolveContentLocale({ prompt_full: prompt }),
      media_kind: category === "video" ? "video" : "image",
      media_url: "",
      poster_url: null,
      remake_count: 0,
      stability_score: 0,
      favorite_score: 0,
      recommended_models: [],
      cost_band: "medium",
      is_published: false,
    };
    inserted.push(row);
    if (!isDryRun) {
      const { error } = await supabase.from("cases").insert(row);
      if (error) throw new Error(`新增 ${slug} 失败：${error.message}`);
    }
  }

  log(`feishu：同步完成。匹配更新 ${updated} 条，新增待发布 ${inserted.length} 条${isDryRun ? "（dry-run 未写库）" : ""}`);
  inserted.forEach((r) => log(`  new(unpublished) ${r.slug} | ${r.title}`));
  if (inserted.length > 0) {
    log("提示：新增条目缺媒体文件和榜单分数，补齐后把 is_published 置 true 上架");
  }
}

// ---------- 入口 ----------

try {
  const supabase = getSupabase();
  if (isSeed) {
    await runSeed(supabase);
  } else {
    await runFeishuSync(supabase);
  }
} catch (error) {
  log(`失败：${error.message}`);
  process.exit(1);
}
