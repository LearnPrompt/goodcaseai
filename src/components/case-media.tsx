"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * 详情页媒体区。
 *
 * 图片走原始外链保证高清（列表才用本地 400px 缩略图）。原图动辄几 MB，
 * 所以先把本地缩略图放大模糊铺底，原图加载完再淡入替换，避免长时间空白。
 * 视频保持原始 mp4 + controls，播放链路一个字节都不改。
 */
export function CaseMedia({
  mediaType,
  mediaUrl,
  posterUrl,
  thumbnailUrl,
  title,
}: {
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const showPlaceholder = mediaType === "image" && Boolean(thumbnailUrl);

  return (
    <article className="overflow-hidden border border-[var(--hair)] bg-[var(--ink)] xl:sticky xl:top-24">
      <div className="relative aspect-[4/3] min-h-[240px] overflow-hidden bg-[#e9e1d5] sm:min-h-[320px] lg:aspect-[16/10] xl:aspect-[4/5] xl:min-h-[520px]">
        {mediaType === "image" ? (
          <>
            {showPlaceholder && !loaded ? (
              <Image
                src={thumbnailUrl as string}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 38vw, 100vw"
                className="scale-105 object-cover blur-lg"
                priority
              />
            ) : null}
            <Image
              src={mediaUrl}
              alt={title}
              fill
              sizes="(min-width: 1280px) 38vw, 100vw"
              onLoad={() => setLoaded(true)}
              className={`object-cover transition-opacity duration-500 ${
                showPlaceholder && !loaded ? "opacity-0" : "opacity-100"
              }`}
            />
          </>
        ) : (
          <video
            muted
            playsInline
            preload="metadata"
            poster={posterUrl}
            controls
            className="h-full w-full object-cover"
          >
            <source src={mediaUrl} type="video/mp4" />
          </video>
        )}
      </div>
    </article>
  );
}
