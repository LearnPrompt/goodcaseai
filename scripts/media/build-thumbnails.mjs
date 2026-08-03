#!/usr/bin/env node
/**
 * 为已发布 Case 生成本地缩略图。
 *
 * 背景：314 条已发布 Case 里 302 条的媒体是外链（youmind / twimg 等），
 * 两家 CDN 都不接受缩放参数，Vercel Hobby 的图片转换额度又只有每月 5000 次。
 * 因此在本地生成固定宽度缩略图并随仓库发布，列表用缩略图、详情仍链回原始来源。
 *
 * 约束（不要在这里放宽）：
 * - 只生成缩略图，不下载原图或视频文件
 * - 不做任何裁剪水印、去署名的处理
 * - 作者与原帖链接由页面负责展示，本脚本不改数据库
 *
 * 依赖 macOS 自带的 sips 做缩放，不引入运行时依赖；产物提交进仓库。
 *
 * 用法：
 *   node scripts/media/build-thumbnails.mjs --limit=10           先看样本
 *   node scripts/media/build-thumbnails.mjs --limit=10 --dry-run 只列计划
 *   node scripts/media/build-thumbnails.mjs                      全量
 */

import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const THUMB_WIDTH = 400;
const THUMB_DIR = path.join(process.cwd(), "public", "media", "thumbs");
const MANIFEST_PATH = path.join(THUMB_DIR, "manifest.json");
const REQUEST_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = { limit: Infinity, dryRun: false, force: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--force") args.force = true;
    else if (raw.startsWith("--limit=")) {
      const value = Number.parseInt(raw.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value > 0) args.limit = value;
    }
  }
  return args;
}

function readEnvLocal() {
  return readFile(path.join(process.cwd(), ".env.local"), "utf8")
    .then((text) => {
      const env = {};
      for (const line of text.split("\n")) {
        const match = line.trim().match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
        if (!match) continue;
        let value = match[2].trim();
        if (
          value.length >= 2 &&
          value[0] === value[value.length - 1] &&
          (value[0] === '"' || value[0] === "'")
        ) {
          value = value.slice(1, -1);
        }
        env[match[1]] = value;
      }
      return env;
    })
    .catch(() => ({}));
}

async function fetchPublishedCases(baseUrl, serviceRoleKey) {
  const url = new URL("/rest/v1/cases", baseUrl);
  url.searchParams.set(
    "select",
    "slug,media_kind,media_url,poster_url,created_at"
  );
  url.searchParams.set("is_published", "eq.true");
  url.searchParams.set("order", "created_at.desc");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`读取 cases 失败：${response.status}`);
  }
  return response.json();
}

/** 视频用 poster，图片用 media_url；本地资源不需要再存一份。 */
export function pickThumbnailSource(row) {
  const candidate =
    row.media_kind === "video" ? row.poster_url || "" : row.media_url || "";
  if (!candidate || !/^https?:\/\//i.test(candidate)) {
    return null;
  }
  return candidate;
}

export function thumbnailFileName(slug) {
  return `${slug}.jpg`;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function downloadTo(url, destination) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "goodcase-thumbnailer/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
  return buffer.length;
}

async function resizeInPlace(target) {
  // sips 是 macOS 自带工具，避免为一次性离线任务引入 sharp 这类原生依赖。
  await execFileAsync("sips", [
    "--resampleWidth",
    String(THUMB_WIDTH),
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "72",
    target,
    "--out",
    target,
  ]);
  const info = await stat(target);
  return info.size;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = { ...(await readEnvLocal()), ...process.env };
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const rows = await fetchPublishedCases(baseUrl, serviceRoleKey);
  const targets = [];
  let skippedLocal = 0;
  for (const row of rows) {
    const source = pickThumbnailSource(row);
    if (!source) {
      skippedLocal += 1;
      continue;
    }
    targets.push({ slug: row.slug, source });
  }

  console.log(
    `已发布 ${rows.length} 条；需要缩略图 ${targets.length} 条；本地媒体或无外链跳过 ${skippedLocal} 条`
  );

  const planned = targets.slice(0, args.limit);
  if (args.dryRun) {
    planned.forEach((item, index) =>
      console.log(`  ${String(index + 1).padStart(3)} ${item.slug}  ←  ${item.source.slice(0, 70)}`)
    );
    console.log(`\ndry-run，未写入任何文件。计划处理 ${planned.length} 条。`);
    return;
  }

  await mkdir(THUMB_DIR, { recursive: true });
  const manifest = (await exists(MANIFEST_PATH))
    ? JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
    : {};

  let done = 0;
  let skipped = 0;
  let failed = 0;
  let sourceBytes = 0;
  let thumbBytes = 0;

  for (const item of planned) {
    const fileName = thumbnailFileName(item.slug);
    const destination = path.join(THUMB_DIR, fileName);
    if (!args.force && (await exists(destination))) {
      skipped += 1;
      continue;
    }

    try {
      const original = await downloadTo(item.source, destination);
      const resized = await resizeInPlace(destination);
      sourceBytes += original;
      thumbBytes += resized;
      manifest[item.slug] = {
        file: `/media/thumbs/${fileName}`,
        source: item.source,
      };
      done += 1;
      console.log(
        `  ✓ ${item.slug}  ${(original / 1024).toFixed(0)}KB → ${(resized / 1024).toFixed(0)}KB`
      );
    } catch (error) {
      failed += 1;
      await rm(destination, { force: true });
      console.log(`  ✗ ${item.slug}  ${error.message}`);
    }
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\n生成 ${done} 条，跳过已存在 ${skipped} 条，失败 ${failed} 条`
  );
  if (done > 0) {
    console.log(
      `原图合计 ${(sourceBytes / 1024 / 1024).toFixed(1)}MB → 缩略图合计 ${(thumbBytes / 1024 / 1024).toFixed(1)}MB` +
        `（平均每张 ${(thumbBytes / done / 1024).toFixed(0)}KB，压缩到 ${((thumbBytes / sourceBytes) * 100).toFixed(0)}%）`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
