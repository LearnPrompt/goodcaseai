#!/usr/bin/env node
/**
 * 把已发布 Case 的外链媒体全量镜像到自有 Vercel Blob。
 *
 * 背景：194 条案例的 media_url 挂在 cms-assets.youmind.com（youmind 已被证实
 * 会删内容），75 条视频挂在 video.twimg.com（墙内不可达），poster 有 203 条在
 * pbs.twimg.com。第三方 CDN 一旦删档或被墙，站点媒体就整片开天窗。因此把这些
 * 文件全部搬进自己的 Blob store，做到"访客能打开站点就能看到媒体"。
 *
 * 额度硬约束（Vercel Hobby Blob，不要在这里放宽）：
 * - 存储 1GB：原始视频合计约 1.2GB 装不下，所以视频一律转 720p 网页版，
 *   目标全库总量 ≤ 700MB
 * - 流量 10GB/月：上传的对象带 1 年 Cache-Control，减少重复回源
 * - Advanced 操作 2k/月：一次 put 记一次，全量约 500 次；校验走公开 URL 的
 *   HTTP HEAD（走 CDN，不计 API 操作），不要改成 SDK 的 head()
 *
 * 其它约束：
 * - 只改 cases 表的 media_url / poster_url 两个字段，按 id 精确匹配，
 *   改前整行快照落 tmp/blob-migration-backup/
 * - manifest 必须保留 originalUrl，回退和溯源只能靠它，绝不能丢
 * - goodcase.ai 自己的相对路径 /media/... 不在范围内，一律不动
 * - public/media/thumbs 的缩略图是本地文件、按 slug 索引，不受本次迁移影响
 * - 临时下载文件用完即删，不要把上 GB 的原片堆在仓库里
 *
 * 视频转码规范（改了会退回"进度条 --:--"那个已修过的 bug）：
 *   h264 + aac，scale='min(1280,iw)':-2（只缩不放大），crf 26，preset medium，
 *   音频 96k，必须 -movflags +faststart 把 moov 前置，否则浏览器拿不到元数据。
 *   转码结果反而比原片大时用原片。
 *
 * 用法：
 *   node --env-file=.env.local scripts/media/migrate-media-to-blob.mjs --dry-run
 *   node --env-file=.env.local scripts/media/migrate-media-to-blob.mjs --dry-run --crf=28
 *   node --env-file=.env.local scripts/media/migrate-media-to-blob.mjs --limit=5
 *   node --env-file=.env.local scripts/media/migrate-media-to-blob.mjs
 *
 * 断点续跑：manifest 里 status=done 的条目直接跳过，重跑整条命令即可续。
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

const execFileAsync = promisify(execFile);

/** 需要镜像的外部域名。goodcase.ai 自己的相对路径不在其中。 */
const SCOPE_HOSTS = new Set([
  "cms-assets.youmind.com",
  "video.twimg.com",
  "pbs.twimg.com",
  "comfy-hub-assets.comfy.org",
  "liblibai-online.liblib.cloud",
  "rh-hk-images.xiaoyaoyou.com",
  "raw.githubusercontent.com",
  // comfy.org 是 comfy 视频的 og.png 动态封面，与 comfy-hub-assets 的视频配套，
  // 视频搬走了封面留在第三方就没意义，一起搬。
  "comfy.org",
]);

const REPO_ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "scripts",
  "media",
  "blob-migration-manifest.json"
);
const BACKUP_DIR = path.join(REPO_ROOT, "tmp", "blob-migration-backup");
const WORK_DIR = path.join(REPO_ROOT, "tmp", "blob-migration", "work");
const REPORT_DIR = path.join(REPO_ROOT, "tmp", "blob-migration");

const DOWNLOAD_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 60_000;
const TRANSCODE_TIMEOUT_MS = 900_000;
const MAX_WIDTH = 1280;
/** 一年，减少重复回源占用每月 10GB 流量额度。 */
const CACHE_MAX_AGE = 31_536_000;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: Infinity,
    crf: 26,
    concurrency: 3,
    budgetMb: 700,
    only: null,
    force: false,
  };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--force") args.force = true;
    else if (raw.startsWith("--limit=")) args.limit = Number(raw.slice(8)) || Infinity;
    else if (raw.startsWith("--crf=")) args.crf = Number(raw.slice(6)) || 26;
    else if (raw.startsWith("--concurrency="))
      args.concurrency = Math.min(3, Math.max(1, Number(raw.slice(14)) || 3));
    else if (raw.startsWith("--budget-mb=")) args.budgetMb = Number(raw.slice(12)) || 700;
    else if (raw.startsWith("--only=")) args.only = raw.slice(7);
    else {
      console.error(`未知参数：${raw}`);
      process.exit(1);
    }
  }
  return args;
}

/** .env.local 里的值可能带引号，node --env-file 已处理，这里再兜一层。 */
function stripQuotes(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    trimmed[0] === trimmed[trimmed.length - 1] &&
    (trimmed[0] === '"' || trimmed[0] === "'")
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function requireEnv(name) {
  const value = stripQuotes(process.env[name]);
  if (!value) throw new Error(`缺少环境变量 ${name}（用 --env-file=.env.local 运行）`);
  return value;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function inScope(url) {
  const host = hostOf(url);
  return Boolean(host && SCOPE_HOSTS.has(host));
}

async function loadPublishedCases(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("is_published", true)
      .order("slug", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`读取 cases 失败：${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/**
 * 一行最多产出两个任务（media_url / poster_url）。
 * kind 决定 Blob 路径与转码方式：video / poster / image。
 */
function buildTasks(rows) {
  const tasks = [];
  for (const row of rows) {
    if (inScope(row.media_url)) {
      tasks.push({
        key: `${row.slug}:media_url`,
        id: row.id,
        slug: row.slug,
        field: "media_url",
        kind: row.media_kind === "video" ? "video" : "image",
        originalUrl: row.media_url,
      });
    }
    if (inScope(row.poster_url)) {
      tasks.push({
        key: `${row.slug}:poster_url`,
        id: row.id,
        slug: row.slug,
        field: "poster_url",
        kind: "poster",
        originalUrl: row.poster_url,
      });
    }
  }
  return tasks;
}

async function fetchWithRetry(url, init, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { "User-Agent": "goodcase-blob-migrator/1.0", ...(init?.headers || {}) },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (i + 1 < attempts) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError;
}

async function downloadTo(url, destination) {
  const response = await fetchWithRetry(url, {});
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
  return {
    bytes: buffer.length,
    contentType: (response.headers.get("content-type") || "").split(";")[0].trim(),
  };
}

async function probe(target) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,codec_name",
      "-show_entries", "format=duration,size,format_name,bit_rate",
      "-of", "json",
      target,
    ],
    { timeout: PROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }
  );
  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0] || {};
  const format = parsed.format || {};
  return {
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    codec: stream.codec_name || "",
    duration: Number(format.duration) || 0,
    formatName: format.format_name || "",
  };
}

const CONTENT_TYPE_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

function extFromContentType(contentType, fallbackUrl) {
  const known = CONTENT_TYPE_EXT[contentType];
  if (known) return known;
  const match = (() => {
    try {
      return new URL(fallbackUrl).pathname.match(/\.([a-z0-9]+)$/i);
    } catch {
      return null;
    }
  })();
  return match ? match[1].toLowerCase() : "bin";
}

const EXT_CONTENT_TYPE = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

function videoArgs(source, destination, crf, filter) {
  return [
    "-y", "-loglevel", "error",
    "-i", source,
    "-vf", filter,
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "96k",
    // moov 必须前置，否则浏览器要下完整个文件才知道时长，就是之前 --:-- 的症状。
    "-movflags", "+faststart",
    destination,
  ];
}

async function transcodeVideo(source, destination, crf) {
  try {
    await execFileAsync(
      "ffmpeg",
      videoArgs(source, destination, crf, "scale='min(1280,iw)':-2"),
      { timeout: TRANSCODE_TIMEOUT_MS }
    );
  } catch {
    // 极少数奇数宽度素材会让 yuv420p 报错，退到强制偶数宽度再来一次。
    await execFileAsync(
      "ffmpeg",
      videoArgs(source, destination, crf, "scale='min(1280,trunc(iw/2)*2)':-2"),
      { timeout: TRANSCODE_TIMEOUT_MS }
    );
  }
  return (await stat(destination)).size;
}

async function transcodeImage(source, destination) {
  await execFileAsync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-i", source,
      "-frames:v", "1",
      "-vf", `scale='min(${MAX_WIDTH},iw)':-1`,
      "-q:v", "4",
      destination,
    ],
    { timeout: PROBE_TIMEOUT_MS }
  );
  return (await stat(destination)).size;
}

/**
 * 下载 + 转码，产出"准备上传的那个文件"。
 *
 * dry-run（--precise）与实跑共用这一个函数，保证 dry-run 报出来的体积
 * 就是实跑真正会占用的体积，而不是模型外推值。
 */
async function prepareUpload(task, srcPath, outPath, crf) {
  const downloaded = await downloadTo(task.originalUrl, srcPath);
  const originalBytes = downloaded.bytes;

  if (task.kind === "video") {
    const meta = await probe(srcPath).catch(() => ({ formatName: "" }));
    const transcodedPath = `${outPath}.mp4`;
    const transcodedBytes = await transcodeVideo(srcPath, transcodedPath, crf);
    const isMp4Container = /mp4|mov|m4a/.test(meta.formatName || "");
    // 转码反而更大时用原片，但前提是原片本身就是 mp4 容器，
    // 否则 .mp4 的路径名会和实际容器对不上。
    const keepOriginal = transcodedBytes >= originalBytes && isMp4Container;
    return {
      originalBytes,
      uploadedBytes: keepOriginal ? originalBytes : transcodedBytes,
      uploadFile: keepOriginal ? srcPath : transcodedPath,
      uploadPath: `media/video/${task.slug}.mp4`,
      contentType: "video/mp4",
      note: keepOriginal ? "转码后更大，改传原片" : null,
      sourceWidth: meta.width || 0,
      sourceHeight: meta.height || 0,
      duration: meta.duration || 0,
    };
  }

  if (task.kind === "poster") {
    const meta = await probe(srcPath).catch(() => ({ width: 0 }));
    const isJpeg = downloaded.contentType === "image/jpeg";
    if (isJpeg && meta.width && meta.width <= MAX_WIDTH) {
      return {
        originalBytes,
        uploadedBytes: originalBytes,
        uploadFile: srcPath,
        uploadPath: `media/poster/${task.slug}.jpg`,
        contentType: "image/jpeg",
        note: "已是小图 jpg，原样传",
        sourceWidth: meta.width,
      };
    }
    const jpgPath = `${outPath}.jpg`;
    const bytes = await transcodeImage(srcPath, jpgPath);
    return {
      originalBytes,
      uploadedBytes: bytes,
      uploadFile: jpgPath,
      uploadPath: `media/poster/${task.slug}.jpg`,
      contentType: "image/jpeg",
      note: null,
      sourceWidth: meta.width || 0,
    };
  }

  const meta = await probe(srcPath).catch(() => ({ width: 0 }));
  const sourceExt = extFromContentType(downloaded.contentType, task.originalUrl);
  // gif 一律原样传：缩放会毁掉动画，这批 gif 源站已经限宽 1000px。
  const isAnimated = sourceExt === "gif";
  if (isAnimated || !meta.width || meta.width <= MAX_WIDTH) {
    return {
      originalBytes,
      uploadedBytes: originalBytes,
      uploadFile: srcPath,
      uploadPath: `media/image/${task.slug}.${sourceExt}`,
      contentType:
        EXT_CONTENT_TYPE[sourceExt] || downloaded.contentType || "application/octet-stream",
      note: isAnimated ? "gif 原样传" : "已是小图，原样传",
      sourceWidth: meta.width || 0,
    };
  }
  const jpgPath = `${outPath}.jpg`;
  const bytes = await transcodeImage(srcPath, jpgPath);
  return {
    originalBytes,
    uploadedBytes: bytes,
    uploadFile: jpgPath,
    uploadPath: `media/image/${task.slug}.jpg`,
    contentType: "image/jpeg",
    note: null,
    sourceWidth: meta.width,
  };
}

/**
 * 校验走公开 URL 的 HTTP HEAD：命中 CDN，不消耗 Blob API 的 Advanced 操作额度。
 * 刚 put 完偶尔会有一拍的边缘传播延迟，失败重试一次再判死。
 */
async function verifyBlob(url, expectedContentType, expectedBytes) {
  let last = { ok: false, reason: "未执行" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status !== 200) {
        last = { ok: false, reason: `HEAD ${response.status}` };
        continue;
      }
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
      if (contentType !== expectedContentType) {
        return { ok: false, reason: `content-type=${contentType}，期望 ${expectedContentType}` };
      }
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > 0 && length !== expectedBytes) {
        return { ok: false, reason: `content-length=${length}，期望 ${expectedBytes}` };
      }
      return { ok: true };
    } catch (error) {
      last = { ok: false, reason: error.message };
    }
  }
  return last;
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/** 改任何字段之前，整行快照落盘；同一 slug 只写一次，保留最早的原始状态。 */
async function backupRow(row) {
  const target = path.join(BACKUP_DIR, `${row.slug}.json`);
  try {
    await stat(target);
    return;
  } catch {
    await writeFile(target, `${JSON.stringify(row, null, 2)}\n`, "utf8");
  }
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}
// ---------------------------------------------------------------- dry-run

/**
 * dry-run 走的是和实跑完全一样的下载 + 转码路径，只是不上传、不写库，
 * 文件量完体积立刻删掉。
 *
 * 早期版本用"每秒每百万像素字节数"外推，抽样 12 条得到的中位数会把
 * 4K 降码率的那一类少算一半（实测区间 97~375 KB/s/Mpx，总量预估从 658MB
 * 到 923MB 都说得通），压根没法拿来判断 700MB 预算够不够。多下载一遍
 * 1.4GB 换一个确定数字，比拿模型赌 1GB 存储额度划算。
 *
 * 结果缓存在 tmp/blob-migration/precise-sizes.json，改 crf 会重新量。
 */
async function dryRun(tasks, args) {
  await mkdir(WORK_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const cachePath = path.join(REPORT_DIR, "precise-sizes.json");
  let cache = {};
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8"));
    if (parsed.crf === args.crf) cache = parsed.entries || {};
  } catch {
    cache = {};
  }

  const entries = [];
  let scanned = 0;
  await runPool(tasks, args.concurrency, async (task) => {
    const cached = cache[task.key];
    if (cached) {
      entries.push(cached);
      scanned += 1;
      return;
    }
    const workBase = path.join(WORK_DIR, `dry-${task.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
    const srcPath = `${workBase}.src`;
    const outPath = `${workBase}.out`;
    const entry = {
      key: task.key,
      slug: task.slug,
      field: task.field,
      kind: task.kind,
      host: hostOf(task.originalUrl),
      originalUrl: task.originalUrl,
      originalBytes: 0,
      uploadedBytes: 0,
      contentType: "",
      status: "ok",
    };
    try {
      const prepared = await prepareUpload(task, srcPath, outPath, args.crf);
      entry.originalBytes = prepared.originalBytes;
      entry.uploadedBytes = prepared.uploadedBytes;
      entry.contentType = prepared.contentType;
      entry.blobPath = prepared.uploadPath;
      if (prepared.note) entry.note = prepared.note;
      if (prepared.sourceWidth) entry.sourceWidth = prepared.sourceWidth;
      if (prepared.duration) entry.duration = prepared.duration;
    } catch (error) {
      entry.status = "unreachable";
      entry.error = error.message;
    } finally {
      await rm(srcPath, { force: true });
      await rm(`${outPath}.mp4`, { force: true });
      await rm(`${outPath}.jpg`, { force: true });
    }
    entries.push(entry);
    scanned += 1;
    if (scanned % 25 === 0) {
      const soFar = entries.reduce((sum, e) => sum + e.uploadedBytes, 0);
      console.log(`  已量 ${scanned}/${tasks.length}，累计 ${mb(soFar)}MB`);
      await writeFile(
        cachePath,
        `${JSON.stringify({ crf: args.crf, entries: Object.fromEntries(entries.map((e) => [e.key, e])) }, null, 2)}\n`,
        "utf8"
      );
    }
  });

  const byHost = {};
  for (const entry of entries) {
    const bucket = (byHost[entry.host] ||= {
      count: 0,
      originalBytes: 0,
      uploadedBytes: 0,
      unreachable: 0,
      video: 0,
      image: 0,
      poster: 0,
    });
    bucket.count += 1;
    bucket[entry.kind] += 1;
    bucket.originalBytes += entry.originalBytes;
    bucket.uploadedBytes += entry.uploadedBytes;
    if (entry.status !== "ok") bucket.unreachable += 1;
  }

  const totalOriginal = entries.reduce((sum, e) => sum + e.originalBytes, 0);
  const totalUploaded = entries.reduce((sum, e) => sum + e.uploadedBytes, 0);
  const ok = entries.filter((e) => e.status === "ok");

  console.log(`\n=== dry-run 体积核算（实测，crf=${args.crf}）===`);
  console.log(
    "域名".padEnd(32) + "条数".padStart(6) + "原始MB".padStart(11) + "转码后MB".padStart(11) + "失败".padStart(7)
  );
  for (const [host, bucket] of Object.entries(byHost).sort(
    (a, b) => b[1].originalBytes - a[1].originalBytes
  )) {
    console.log(
      host.padEnd(32) +
        String(bucket.count).padStart(6) +
        mb(bucket.originalBytes).padStart(11) +
        mb(bucket.uploadedBytes).padStart(11) +
        String(bucket.unreachable).padStart(7)
    );
  }
  console.log("-".repeat(67));
  console.log(
    "合计".padEnd(32) +
      String(entries.length).padStart(6) +
      mb(totalOriginal).padStart(11) +
      mb(totalUploaded).padStart(11)
  );

  const byKind = {};
  for (const entry of ok) {
    const bucket = (byKind[entry.kind] ||= { count: 0, original: 0, uploaded: 0 });
    bucket.count += 1;
    bucket.original += entry.originalBytes;
    bucket.uploaded += entry.uploadedBytes;
  }
  console.log("\n按类型：");
  for (const [kind, bucket] of Object.entries(byKind)) {
    console.log(
      `  ${kind.padEnd(7)} ${String(bucket.count).padStart(4)} 条  ${mb(bucket.original)}MB → ${mb(bucket.uploaded)}MB`
    );
  }

  console.log(
    `\n上传后总占用 ${mb(totalUploaded)}MB，预算 ${args.budgetMb}MB，` +
      `1GB 存储额度占用 ${((totalUploaded / 1024 ** 3) * 100).toFixed(0)}%`
  );
  console.log(`计划 put ${ok.length} 次（Advanced 操作月额度 2000）`);
  if (totalUploaded > args.budgetMb * 1024 * 1024) {
    console.log(`\n超预算 ${mb(totalUploaded - args.budgetMb * 1024 * 1024)}MB，先把 crf 提到 28 重估再说。`);
  }

  await writeFile(
    cachePath,
    `${JSON.stringify({ crf: args.crf, entries: Object.fromEntries(entries.map((e) => [e.key, e])) }, null, 2)}\n`,
    "utf8"
  );
  const reportPath = path.join(REPORT_DIR, `dry-run-report-crf${args.crf}.json`);
  await writeFile(
    reportPath,
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), crf: args.crf, byHost, byKind, totalOriginal, totalUploaded, entries },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`\n明细写入 ${reportPath}`);
}

// ---------------------------------------------------------------- 实跑

async function migrateOne(task, row, ctx) {
  const { args, token, supabase, manifest } = ctx;
  const workBase = path.join(WORK_DIR, task.key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  const srcPath = `${workBase}.src`;
  const outPath = `${workBase}.out`;
  const cleanup = async () => {
    await rm(srcPath, { force: true });
    await rm(outPath, { force: true });
    await rm(`${outPath}.mp4`, { force: true });
    await rm(`${outPath}.jpg`, { force: true });
  };

  const entry = {
    slug: task.slug,
    caseId: task.id,
    field: task.field,
    kind: task.kind,
    originalUrl: task.originalUrl,
    originalHost: hostOf(task.originalUrl),
    blobUrl: null,
    blobPath: null,
    originalBytes: 0,
    uploadedBytes: 0,
    contentType: null,
    status: "failed",
    error: null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const prepared = await prepareUpload(task, srcPath, outPath, args.crf);
    entry.originalBytes = prepared.originalBytes;
    entry.uploadedBytes = prepared.uploadedBytes;
    if (prepared.note) entry.note = prepared.note;
    const { uploadPath, contentType, uploadFile } = prepared;

    entry.blobPath = uploadPath;
    entry.contentType = contentType;

    const body = await readFile(uploadFile);
    const uploaded = await put(uploadPath, body, {
      access: "public",
      token,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: CACHE_MAX_AGE,
    });
    entry.blobUrl = uploaded.url;
    ctx.putCount += 1;

    const verified = await verifyBlob(uploaded.url, contentType, entry.uploadedBytes);
    if (!verified.ok) {
      entry.status = "failed";
      entry.error = `校验失败：${verified.reason}`;
      return entry;
    }

    await backupRow(row);
    const { error } = await supabase
      .from("cases")
      .update({ [task.field]: uploaded.url })
      .eq("id", task.id);
    if (error) {
      entry.status = "failed";
      entry.error = `写库失败：${error.message}`;
      return entry;
    }

    entry.status = "done";
    return entry;
  } catch (error) {
    entry.status = "failed";
    entry.error = error.message;
    return entry;
  } finally {
    await cleanup();
    manifest[task.key] = entry;
  }
}

async function migrate(tasks, rowsById, args, ctx) {
  await mkdir(WORK_DIR, { recursive: true });
  await mkdir(BACKUP_DIR, { recursive: true });

  // 同一 slug 的 video 与 poster 放同一组顺序处理，保证配套翻。
  const groups = new Map();
  for (const task of tasks) {
    if (!groups.has(task.slug)) groups.set(task.slug, []);
    groups.get(task.slug).push(task);
  }
  const groupList = [...groups.values()];

  let processed = 0;
  await runPool(groupList, args.concurrency, async (group) => {
    for (const task of group) {
      const row = rowsById.get(task.id);
      const entry = await migrateOne(task, row, ctx);
      processed += 1;
      ctx.uploadedBytes += entry.status === "done" ? entry.uploadedBytes : 0;
      const tag = entry.status === "done" ? "OK " : "FAIL";
      console.log(
        `[${String(processed).padStart(3)}/${tasks.length}] ${tag} ${task.key} ` +
          `${mb(entry.originalBytes)}→${mb(entry.uploadedBytes)}MB` +
          (entry.error ? `  ${entry.error}` : "") +
          (entry.note ? `  (${entry.note})` : "")
      );
    }
    // 每组落一次 manifest，进程被打断也能从上次的位置续跑。
    await writeManifest(ctx.manifest);
    if (ctx.uploadedBytes > args.budgetMb * 1024 * 1024) {
      throw new Error(
        `已上传 ${mb(ctx.uploadedBytes)}MB，超过预算 ${args.budgetMb}MB，停止。manifest 已保存，可续跑。`
      );
    }
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const rows = await loadPublishedCases(supabase);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  let tasks = buildTasks(rows);
  if (args.only) tasks = tasks.filter((t) => t.slug === args.only);

  const manifest = await readManifest();
  const pending = args.force
    ? tasks
    : tasks.filter((t) => manifest[t.key]?.status !== "done");

  console.log(
    `已发布 ${rows.length} 条；范围内媒体 ${tasks.length} 项；` +
      `manifest 已完成 ${tasks.length - pending.length} 项；待处理 ${pending.length} 项`
  );

  const planned = pending.slice(0, args.limit);

  if (args.dryRun) {
    await dryRun(planned, args);
    return;
  }

  const token = requireEnv("BLOB_READ_WRITE_TOKEN");
  // 预算是对整个 store 的，续跑时要把之前已经传上去的算进来，
  // 否则每次续跑都从 0 起算，budget 形同虚设。
  const alreadyUploaded = Object.values(manifest)
    .filter((e) => e.status === "done")
    .reduce((sum, e) => sum + (e.uploadedBytes || 0), 0);
  const ctx = {
    args,
    token,
    supabase,
    manifest,
    putCount: 0,
    uploadedBytes: alreadyUploaded,
  };

  try {
    await migrate(planned, rowsById, args, ctx);
  } finally {
    await writeManifest(manifest);
    await rm(WORK_DIR, { recursive: true, force: true });
  }

  const all = Object.values(manifest);
  const done = all.filter((e) => e.status === "done");
  const failed = all.filter((e) => e.status === "failed");
  const totalBytes = done.reduce((sum, e) => sum + e.uploadedBytes, 0);

  console.log("\n=== 实跑结果 ===");
  console.log(`成功 ${done.length}，失败 ${failed.length}，本次 put ${ctx.putCount} 次`);
  console.log(
    `Blob 总占用 ${mb(totalBytes)}MB（1GB 额度的 ${((totalBytes / 1024 ** 3) * 100).toFixed(0)}%）`
  );
  if (failed.length) {
    console.log("\n失败清单：");
    for (const entry of failed) console.log(`  ${entry.slug}:${entry.field}  ${entry.error}`);
  }
  console.log(`\nmanifest：${MANIFEST_PATH}`);
  console.log(`备份：${BACKUP_DIR}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
