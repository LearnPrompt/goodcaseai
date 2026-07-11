"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FavoriteButton } from "@/components/favorite-button";
import { LikeButton } from "@/components/like-button";
import { useFavoritedSlugs } from "@/lib/local-favorites";

type PublicCaseItem = {
  slug: string;
  title: string;
  category: string;
  source: string;
  summary: string;
  mediaType: string;
  mediaUrl: string | null;
  posterUrl: string | null;
  likedCount: number;
  stabilityScore: number;
  favoriteScore: number;
};

/** 公开 API 返回绝对 URL（https://goodcase.ai/...），本地环境下转回相对路径以便直接命中本站静态资源。 */
function toLocalMediaUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }
  return rawUrl.replace(/^https:\/\/goodcase\.ai(?=\/)/, "");
}

export function FavoritesList() {
  const favoritedSlugs = useFavoritedSlugs();
  const [cases, setCases] = useState<PublicCaseItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/cases?take=50")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`unexpected status ${response.status}`);
        }
        return response.json();
      })
      .then((data: { items?: PublicCaseItem[] }) => {
        if (!cancelled) {
          setCases(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const favoritedCases = (cases ?? []).filter((item) => favoritedSlugs.includes(item.slug));

  return (
    <>
      <p className="mb-6 rounded-[18px] border border-[var(--line)] bg-white/60 px-4 py-3 text-sm leading-7 text-[var(--muted)]">
        收藏保存在本机浏览器，清除浏览器数据或换设备不会同步。
      </p>

      {favoritedSlugs.length === 0 ? (
        <section className="grid gap-4 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center sm:p-12">
          <p className="text-lg font-semibold text-[var(--ink)]">还没有收藏，去案例库逛逛。</p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            在案例卡片或详情页点 ☆ 收藏，之后回到这里就能快速找到它们。
          </p>
          <div>
            <Link
              href="/cases"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--bg-strong)] transition hover:-translate-y-0.5"
            >
              去案例库逛逛
            </Link>
          </div>
        </section>
      ) : loadFailed ? (
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center text-sm leading-7 text-[var(--muted)] sm:p-12">
          案例数据加载失败，请刷新重试。
        </section>
      ) : cases === null ? (
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center text-sm leading-7 text-[var(--muted)] sm:p-12">
          正在加载收藏的案例…
        </section>
      ) : favoritedCases.length === 0 ? (
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-8 text-center text-sm leading-7 text-[var(--muted)] sm:p-12">
          收藏的案例暂时没有出现在最新案例列表里，去案例库看看有没有新的好案例。
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {favoritedCases.map((item) => {
            const mediaUrl = toLocalMediaUrl(item.mediaUrl);
            const posterUrl = toLocalMediaUrl(item.posterUrl) ?? undefined;

            return (
              <article
                key={item.slug}
                className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_20px_60px_rgba(43,28,18,0.12)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e1d5]">
                  {mediaUrl ? (
                    item.mediaType === "image" ? (
                      <Image
                        src={mediaUrl}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1536px) 31vw, (min-width: 768px) 48vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <video
                        muted
                        loop
                        autoPlay
                        playsInline
                        preload="metadata"
                        poster={posterUrl}
                        className="h-full w-full object-cover"
                      >
                        <source src={mediaUrl} type="video/mp4" />
                      </video>
                    )
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs">{item.source}</span>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs">
                      稳定 {item.stabilityScore}
                    </span>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                      {item.favoriteScore >= item.stabilityScore ? "编辑精选" : "值得学习"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h2 className="font-[family-name:var(--font-display)] text-3xl leading-[0.96] tracking-[-0.04em] sm:text-4xl">
                      {item.title}
                    </h2>
                    <p className="text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <LikeButton caseSlug={item.slug} initialCount={item.likedCount} />
                      <FavoriteButton caseSlug={item.slug} />
                    </div>
                    <Link
                      href={`/cases/${item.slug}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
