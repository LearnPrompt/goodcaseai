"use client";

import { toggleFavorite, useFavoritedSlugs } from "@/lib/local-favorites";

export function FavoriteButton({ caseSlug }: { caseSlug: string }) {
  // SSR 与首次 hydration 一律按未收藏渲染（useFavoritedSlugs 初始为空数组），
  // 挂载后读 localStorage 更新，避免 hydration mismatch。
  const favoritedSlugs = useFavoritedSlugs();
  const isFavorited = favoritedSlugs.includes(caseSlug);

  return (
    <button
      type="button"
      aria-pressed={isFavorited}
      onClick={(event) => {
        // 卡片上有可点击区域时避免触发外层导航。
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(caseSlug);
      }}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${
        isFavorited
          ? "border-[var(--accent)] bg-[rgba(203,92,47,0.14)] text-[var(--ink)]"
          : "border-[var(--line)] bg-white/60 text-[var(--ink)] hover:-translate-y-0.5"
      }`}
    >
      <span aria-hidden="true" className={isFavorited ? "text-[var(--accent)]" : undefined}>
        {isFavorited ? "★" : "☆"}
      </span>
      <span>{isFavorited ? "已收藏" : "收藏"}</span>
    </button>
  );
}
