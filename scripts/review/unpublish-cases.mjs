#!/usr/bin/env node
/**
 * 按 slug 下架已发布的 Case（is_published = false）。
 *
 * 用于溯源审计判定「prompt 对不上原始出处」的条目：站点主打可验证出处，
 * 编造的 prompt 必须先下线，但不删数据——判定可能有误，作者也可能后补出处，
 * 所以只翻 is_published，随时能翻回来。
 *
 * 安全约束（沿用 recalibrate-content-locale.mjs 的既有规矩）：
 *   - 先按 slug 查出 id，之后一律按 id 精确 PATCH，绝不按 slug 模糊匹配
 *   - 写库前把受影响行的完整快照落到本地私有备份
 *   - 默认 dry-run，必须显式 --apply 才写库
 *   - 传入的 slug 有任何一条查不到就整体中止，不做部分执行
 *
 * 用法：
 *   node scripts/review/unpublish-cases.mjs --slugs=a,b,c            # dry-run
 *   node scripts/review/unpublish-cases.mjs --slugs=a,b,c --apply    # 备份后写库
 *   node scripts/review/unpublish-cases.mjs --slugs=a --apply --restore  # 翻回已发布
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BACKUP_DIR = path.join(process.cwd(), "tmp", "unpublish-cases");

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
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

async function main() {
  const apply = process.argv.includes("--apply");
  const restore = process.argv.includes("--restore");
  const slugs = getArg("--slugs")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!slugs.length) {
    throw new Error("--slugs 必须提供至少一个 slug");
  }

  const env = { ...(await readEnvLocal()), ...process.env };
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const url = new URL("/rest/v1/cases", baseUrl);
  url.searchParams.set("select", "id,slug,title,is_published,source_url");
  url.searchParams.set("slug", `in.(${slugs.map((s) => `"${s}"`).join(",")})`);
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`查询失败：${response.status} ${await response.text()}`);
  }
  const rows = await response.json();

  const found = new Set(rows.map((row) => row.slug));
  const missing = slugs.filter((slug) => !found.has(slug));
  if (missing.length) {
    // 少一条就整体中止：部分执行会让「下架了哪几条」这件事说不清楚。
    throw new Error(`以下 slug 在库里不存在，已中止：${missing.join("、")}`);
  }

  const target = restore ? true : false;
  const needChange = rows.filter((row) => row.is_published !== target);

  console.log(`命中 ${rows.length} 条，其中需要变更 ${needChange.length} 条`);
  for (const row of rows) {
    const state = row.is_published ? "已发布" : "已下架";
    const mark = row.is_published === target ? "（无需变更）" : "→ " + (target ? "已发布" : "已下架");
    console.log(`  ${row.slug.slice(0, 42).padEnd(44)} ${state} ${mark}`);
  }

  if (!apply) {
    console.log("\ndry-run，未写库。加 --apply 才会执行（会先落备份）。");
    return;
  }
  if (!needChange.length) {
    console.log("\n没有需要变更的行。");
    return;
  }

  await mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(
    BACKUP_DIR,
    `before-${target ? "restore" : "unpublish"}-${rows[0].id.slice(0, 8)}.json`
  );
  await writeFile(backupPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`\n原始快照已备份：${backupPath}`);

  let ok = 0;
  let failed = 0;
  for (const row of needChange) {
    const patchUrl = new URL("/rest/v1/cases", baseUrl);
    patchUrl.searchParams.set("id", `eq.${row.id}`);
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ is_published: target }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      ok += 1;
    } else {
      failed += 1;
      console.log(`  ✗ ${row.slug}  HTTP ${res.status} ${await res.text()}`);
    }
  }

  console.log(`\n写入成功 ${ok} 条，失败 ${failed} 条`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
