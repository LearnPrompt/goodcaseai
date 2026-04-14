"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  getCaseLikeState,
  LIKES_UPDATED_EVENT,
  toggleCaseLike,
} from "@/lib/likes";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

export function LikeButton({
  caseSlug,
  initialCount,
  initialHasLiked = false,
  initialIsLoggedIn = false,
}: {
  caseSlug: string;
  initialCount: number;
  initialHasLiked?: boolean;
  initialIsLoggedIn?: boolean;
}) {
  const { user, isReady, isConfigured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [likedCount, setLikedCount] = useState(initialCount);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isPending, setIsPending] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    setLikedCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    setHasLiked(initialHasLiked);
  }, [initialHasLiked]);

  const syncState = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return {
        hasLiked: false,
        likedCount: initialCount,
        error: "",
      };
    }

    const state = await getCaseLikeState({
      supabase,
      caseSlug,
      userId: user?.id || null,
      fallbackCount: initialCount,
    });

    return {
      hasLiked: state.hasLiked,
      likedCount: state.likedCount,
      error: state.error || "",
    };
  }, [caseSlug, initialCount, user?.id]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const state = await syncState();
      if (cancelled) {
        return;
      }
      setHasLiked(state.hasLiked);
      setLikedCount(state.likedCount);
      setErrorText(state.error);
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, syncState]);

  useEffect(() => {
    let cancelled = false;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ caseSlug?: string }>).detail;
      if (!detail?.caseSlug || detail.caseSlug === caseSlug) {
        void (async () => {
          const state = await syncState();
          if (cancelled) {
            return;
          }
          setHasLiked(state.hasLiked);
          setLikedCount(state.likedCount);
          setErrorText(state.error);
        })();
      }
    };

    window.addEventListener(LIKES_UPDATED_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(LIKES_UPDATED_EVENT, handler);
    };
  }, [caseSlug, syncState]);

  const isLoggedIn = isReady ? Boolean(user) : initialIsLoggedIn;

  async function handleClick() {
    if (!isReady) {
      return;
    }

    if (!user) {
      const next = encodeURIComponent(pathname || "/");
      router.push(`/login?next=${next}`);
      return;
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setErrorText("请先配置 Supabase 环境变量。");
      return;
    }

    setIsPending(true);
    setErrorText("");

    const state = await toggleCaseLike({
      supabase,
      caseSlug,
      userId: user.id,
      hasLiked,
      fallbackCount: likedCount,
    });

    setHasLiked(state.hasLiked);
    setLikedCount(state.likedCount);
    setErrorText(state.error || "");

    window.dispatchEvent(
      new CustomEvent(LIKES_UPDATED_EVENT, { detail: { caseSlug } })
    );

    setIsPending(false);
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !isConfigured || !isReady}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-70 ${
          hasLiked
            ? "border-[var(--accent)] bg-[rgba(203,92,47,0.14)] text-[var(--ink)]"
            : "border-[var(--line)] bg-white/60 text-[var(--ink)] hover:-translate-y-0.5"
        }`}
      >
        <span aria-hidden="true">{hasLiked ? "♥" : "♡"}</span>
        <span>{likedCount}</span>
        <span>
          {!isConfigured
            ? "需配置 Supabase"
            : isLoggedIn
              ? hasLiked
                ? "已点赞"
                : "点赞解锁"
              : "登录后点赞"}
        </span>
      </button>

      {errorText ? (
        <p className="max-w-56 text-xs leading-5 text-[var(--accent)]">{errorText}</p>
      ) : null}
    </div>
  );
}
