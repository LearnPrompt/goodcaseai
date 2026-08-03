import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 本地缩略图索引。
 *
 * 302 / 314 条已发布 Case 的媒体是外链（youmind、twimg 等），两家 CDN 都不接受
 * 缩放参数，Vercel Hobby 每月又只含 5000 次图片转换。因此列表用随仓库发布的
 * 400px 缩略图，详情页仍然走原始外链保证高清与视频可播。
 *
 * 缩略图由 scripts/media/build-thumbnails.mjs 离线生成并提交，
 * 这里只做一次同步读取，找不到就返回 undefined 让调用方回退到原始媒体。
 */
type ThumbnailManifest = Record<string, { file: string; source: string }>;

const MANIFEST_PATH = path.join(
  process.cwd(),
  "public",
  "media",
  "thumbs",
  "manifest.json"
);

let manifest: ThumbnailManifest | null = null;

function loadManifest(): ThumbnailManifest {
  if (manifest) {
    return manifest;
  }

  try {
    manifest = JSON.parse(
      readFileSync(MANIFEST_PATH, "utf8")
    ) as ThumbnailManifest;
  } catch {
    // 还没生成缩略图时按空索引处理，全站回退到原始媒体。
    manifest = {};
  }

  return manifest;
}

export function getThumbnailUrl(slug: string): string | undefined {
  const entry = loadManifest()[slug];
  return entry?.file;
}

export function getThumbnailCount(): number {
  return Object.keys(loadManifest()).length;
}
