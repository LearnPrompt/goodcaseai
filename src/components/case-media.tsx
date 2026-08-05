"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";

/**
 * 详情页媒体区。
 *
 * 图片走原始外链保证高清（列表才用本地 400px 缩略图）。原图动辄几 MB，
 * 所以先把本地缩略图放大模糊铺底，原图加载完再淡入替换，避免长时间空白。
 * 视频保持原始 mp4 + controls，播放链路一个字节都不改；唯一新增的是
 * 加载失败/卡死时的兜底 UI（详情页视频挂在第三方 CDN 上，用户网络到
 * 那些域链路不稳时之前只会看到 poster + --:--，没有任何提示）。
 */
export function CaseMedia({
  mediaType,
  mediaUrl,
  posterUrl,
  thumbnailUrl,
  title,
  sourceUrl,
}: {
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  title: string;
  sourceUrl?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const showPlaceholder = mediaType === "image" && Boolean(thumbnailUrl);

  const messages = useMessages();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  // 每次重试自增，当 key 传给 <video>，逼 React 整个卸载重挂，
  // 等于「重新挂 source 重新 load」，不用手动摆弄 <source> 节点。
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (mediaType !== "video") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    // 纯网络卡死（连不上 CDN、连接悬着）不会触发 error 事件，
    // 只能靠超时兜底：15 秒了 metadata 还没出来（readyState 仍是
    // HAVE_NOTHING）就当失败处理。
    const timeoutId = window.setTimeout(() => {
      if (video.readyState === 0) {
        setVideoFailed(true);
      }
    }, 15_000);

    const handleError = () => {
      setVideoFailed(true);
      window.clearTimeout(timeoutId);
    };

    // <source> 的 error 事件不会冒泡到 <video>，但事件流的捕获阶段
    // 仍然会经过祖先节点——在 video 上挂 capture:true 的监听器就能接住它，
    // 不用另外给 <source> 单独挂监听。
    video.addEventListener("error", handleError, true);

    return () => {
      video.removeEventListener("error", handleError, true);
      window.clearTimeout(timeoutId);
    };
  }, [mediaType, attempt]);

  const handleRetry = () => {
    setVideoFailed(false);
    setAttempt((value) => value + 1);
  };

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
        ) : videoFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 38vw, 100vw"
                className="object-cover opacity-40"
              />
            ) : null}
            <div className="relative z-10 flex flex-col items-center gap-4 border border-[var(--hair)] bg-[var(--paper)] px-5 py-6">
              <p className="max-w-xs text-sm text-[var(--muted)]">
                {messages.mediaFallback.videoError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="gc-action"
                >
                  {messages.common.retry}
                </button>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="gc-action"
                  >
                    {messages.mediaFallback.viewSource} ↗
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <video
            key={attempt}
            ref={videoRef}
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
