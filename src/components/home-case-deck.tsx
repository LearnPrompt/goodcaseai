"use client";

import Image from "next/image";
import { useState } from "react";
import { LocalizedLink as Link } from "@/components/localized-link";

export type HomeDeckItem = {
  slug: string;
  title: string;
  summary: string;
  creator: string;
  categoryLabel: string;
  stabilityLabel: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  thumbnailUrl?: string;
};

const PER_PAGE = 6;

/**
 * 首页深度 Case 区的翻页。
 *
 * 数据在服务端一次取好整池传进来，翻页纯客户端切片：
 * 不再发请求，既不增加 Supabase 出网流量，也没有翻页等待，
 * 目的是让人愿意在首页多翻几屏而不是看完六条就走。
 */
export function HomeCaseDeck({
  items,
  locale,
  labels,
}: {
  items: HomeDeckItem[];
  locale: "zh-CN" | "en";
  labels: {
    previewTag: string;
    stability: string;
    viewPrompt: string;
    prev: string;
    next: string;
  };
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const visible = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const isEnglish = locale === "en";

  return (
    <>
      <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item, index) => {
          const media = item.thumbnailUrl || item.posterUrl || item.mediaUrl;
          return (
            <article
              key={item.slug}
              className="group flex min-h-[440px] flex-col border-b border-r border-[var(--hair)] bg-white"
            >
              <Link
                href={`/cases/${item.slug}`}
                className="block overflow-hidden border-b border-[var(--hair)]"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--ink)] transition duration-300 group-hover:scale-[1.015]">
                  <Image
                    src={media}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw"
                    className="object-cover grayscale transition duration-300 group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(194,65,12,0.18),transparent_46%,rgba(10,10,10,0.22))] transition-opacity duration-300 group-hover:opacity-0" />
                  <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                    {item.categoryLabel}
                  </span>
                </div>
              </Link>

              <div className="flex flex-1 flex-col p-6">
                <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
                  <span>
                    Case ·{" "}
                    {String(page * PER_PAGE + index + 1).padStart(4, "0")}
                  </span>
                  <span className="text-[var(--orange)]">
                    {labels.previewTag}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--mute)]">
                  {item.categoryLabel} · {item.creator}
                </p>
                <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
                  {item.summary}
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--hair)] pt-4 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span>
                    {labels.stability} {item.stabilityLabel}
                  </span>
                  <Link
                    href={`/cases/${item.slug}`}
                    className="text-[var(--orange)]"
                  >
                    {labels.viewPrompt} ↗
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-l border-r border-[var(--hair)] px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
            {isEnglish
              ? `${page + 1} / ${totalPages}`
              : `第 ${page + 1} / ${totalPages} 屏`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="gc-action disabled:pointer-events-none disabled:opacity-40"
            >
              ← {labels.prev}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="gc-action disabled:pointer-events-none disabled:opacity-40"
            >
              {labels.next} →
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
