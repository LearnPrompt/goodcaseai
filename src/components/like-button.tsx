"use client";

import {
  toggleLocalLike,
  useHasLikedCase,
} from "@/lib/local-likes";
import { useMessages } from "@/i18n/client";

export function LikeButton({
  caseSlug,
  initialCount,
}: {
  caseSlug: string;
  initialCount: number;
}) {
  const messages = useMessages();
  // SSR 与首次 hydration 一律按未点赞渲染，挂载后读本机状态，避免 hydration mismatch。
  const hasLiked = useHasLikedCase(caseSlug);
  const likedCount = initialCount + (hasLiked ? 1 : 0);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => toggleLocalLike(caseSlug)}
        className={`gc-action whitespace-nowrap ${
          hasLiked
            ? "border-[var(--orange)] bg-[var(--orange)] text-white"
            : ""
        }`}
      >
        <span aria-hidden="true">{hasLiked ? "♥" : "♡"}</span>
        <span>{likedCount}</span>
        <span>
          {hasLiked ? messages.interaction.liked : messages.interaction.like}
        </span>
      </button>
    </div>
  );
}
