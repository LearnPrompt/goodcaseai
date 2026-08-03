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
  const args = { limit: Infinity, dryRun: false, force: false, onlyVideo: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--force") args.force = true;
    else if (raw === "--only-video") args.onlyVideo = true;
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

/**
 * 视频优先从原片抓代表帧，其次退回平台 poster；图片直接用 media_url。
 *
 * 平台给的 poster 常常是第一帧，很多 AI 视频第一帧是空镜或渐入黑场，
 * 缩略图里看不到任何有效信息（用户实测反馈）。ffmpeg 对远程 mp4 做 seek
 * 只拉取需要的片段，单条约 0.5 秒，不用下载整个视频。
 */
export function pickThumbnailSource(row) {
  if (row.media_kind === "video") {
    const video = row.media_url || "";
    if (/^https?:\/\//i.test(video) && /\.(mp4|m4v|mov)(\?|#|$)/i.test(video)) {
      return { kind: "video-frame", url: video, fallback: row.poster_url || "" };
    }
    const poster = row.poster_url || "";
    return /^https?:\/\//i.test(poster)
      ? { kind: "image", url: poster, fallback: "" }
      : null;
  }

  const image = row.media_url || "";
  return /^https?:\/\//i.test(image)
    ? { kind: "image", url: image, fallback: "" }
    : null;
}

/** 从远程视频的第 SEEK_SECONDS 秒抓一帧。太靠前容易抓到黑场或渐入。 */
const SEEK_SECONDS = 2;

async function grabVideoFrame(url, destination) {
  await execFileAsync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-ss", String(SEEK_SECONDS),
      "-i", url,
      "-frames:v", "1",
      "-vf", `scale=${THUMB_WIDTH}:-2`,
      "-q:v", "4",
      destination,
    ],
    { timeout: 60_000 }
  );
  const info = await stat(destination);
  if (!info.size) {
    throw new Error("ffmpeg 产出空文件");
  }
  return info.size;
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
    if (args.onlyVideo && source.kind !== "video-frame") continue;
    targets.push({ slug: row.slug, source });
  }

  console.log(
    `已发布 ${rows.length} 条；需要缩略图 ${targets.length} 条；本地媒体或无外链跳过 ${skippedLocal} 条`
  );

  const planned = targets.slice(0, args.limit);
  if (args.dryRun) {
    planned.forEach((item, index) =>
      console.log(
        `  ${String(index + 1).padStart(3)} ${item.slug}  ←  [${item.source.kind}] ${item.source.url.slice(0, 62)}`
      )
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
  let thumbBytes = 0;

  for (const item of planned) {
    const fileName = thumbnailFileName(item.slug);
    const destination = path.join(THUMB_DIR, fileName);
    if (!args.force && (await exists(destination))) {
      skipped += 1;
      continue;
    }

    try {
      let resized;
      let note;
      if (item.source.kind === "video-frame") {
        try {
          resized = await grabVideoFrame(item.source.url, destination);
          note = `帧@${SEEK_SECONDS}s`;
        } catch (frameError) {
          // 抓帧失败（编码不支持、远程不支持 range 等）时退回平台 poster，别整条丢掉。
          if (!item.source.fallback) throw frameError;
          await downloadTo(item.source.fallback, destination);
          resized = await resizeInPlace(destination);
          note = "退回 poster";
        }
      } else {
        await downloadTo(item.source.url, destination);
        resized = await resizeInPlace(destination);
        note = "原图缩放";
      }

      thumbBytes += resized;
      manifest[item.slug] = {
        file: `/media/thumbs/${fileName}`,
        source: item.source.url,
        via: note,
      };
      done += 1;
      console.log(`  ✓ ${item.slug}  ${(resized / 1024).toFixed(0)}KB  ${note}`);
    } catch (error) {
      failed += 1;
      await rm(destination, { force: true });
      console.log(`  ✗ ${item.slug}  ${error.message.slice(0, 80)}`);
    }
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\n生成 ${done} 条，跳过已存在 ${skipped} 条，失败 ${failed} 条`
  );
  if (done > 0) {
    console.log(
      `缩略图合计 ${(thumbBytes / 1024 / 1024).toFixed(1)}MB，平均每张 ${(thumbBytes / done / 1024).toFixed(0)}KB`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
