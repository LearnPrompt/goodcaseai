"use client";

import {
  toggleLocalLike,
  useHasLikedCase,
} from "@/lib/local-likes";

export function LikeButton({
  caseSlug,
  initialCount,
}: {
  caseSlug: string;
  initialCount: number;
}) {
  // SSR 与首次 hydration 一律按未点赞渲染，挂载后由 useHasLikedCase 读 localStorage 更新，避免 hydration mismatch。
  const hasLiked = useHasLikedCase(caseSlug);
  const likedCount = initialCount + (hasLiked ? 1 : 0);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => toggleLocalLike(caseSlug)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition ${
          hasLiked
            ? "border-[var(--accent)] bg-[rgba(203,92,47,0.14)] text-[var(--ink)]"
            : "border-[var(--line)] bg-white/60 text-[var(--ink)] hover:-translate-y-0.5"
        }`}
      >
        <span aria-hidden="true">{hasLiked ? "♥" : "♡"}</span>
        <span>{likedCount}</span>
        <span>{hasLiked ? "已点赞" : "点赞解锁"}</span>
      </button>
    </div>
  );
}
