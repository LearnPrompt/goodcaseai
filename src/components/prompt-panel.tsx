"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getCaseLikeState, LIKES_UPDATED_EVENT } from "@/lib/likes";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

export function PromptPanel({
  caseSlug,
  promptPreview,
  promptFull,
}: {
  caseSlug: string;
  promptPreview: string;
  promptFull: string;
}) {
  const { user, isReady, isConfigured } = useAuth();
  const [hasLiked, setHasLiked] = useState(false);

  const syncState = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      return false;
    }

    const state = await getCaseLikeState({
      supabase,
      caseSlug,
      userId: user?.id || null,
      fallbackCount: 0,
    });

    return state.hasLiked;
  }, [caseSlug, user?.id]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const nextHasLiked = await syncState();
      if (!cancelled) {
        setHasLiked(nextHasLiked);
      }
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
          const nextHasLiked = await syncState();
          if (!cancelled) {
            setHasLiked(nextHasLiked);
          }
        })();
      }
    };

    window.addEventListener(LIKES_UPDATED_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(LIKES_UPDATED_EVENT, handler);
    };
  }, [caseSlug, syncState]);

  const canUnlock = Boolean(user) && hasLiked && isConfigured;
  const hasExpandedPrompt = promptFull.trim() !== promptPreview.trim();

  return (
    <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6 xl:min-h-[360px]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        Prompt preview
      </p>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
        {canUnlock
          ? "已解锁：预览与完整 Prompt 都会保留显示。"
          : "先看预览，点赞后解锁完整 Prompt、负向约束和测试记录。"}
      </h2>
      <div className="mt-5 rounded-[20px] border border-[var(--line)] bg-white/60 p-4 text-sm leading-7 text-[var(--muted)] whitespace-pre-line sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          预览段
        </p>
        {promptPreview}
      </div>
      {canUnlock && hasExpandedPrompt ? (
        <div className="mt-4 rounded-[20px] border border-[rgba(203,92,47,0.28)] bg-[rgba(203,92,47,0.06)] p-4 text-sm leading-7 text-[var(--muted)] whitespace-pre-line sm:p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            完整段
          </p>
          {promptFull}
        </div>
      ) : null}
      {!isConfigured ? (
        <p className="mt-4 text-xs leading-5 text-[var(--accent)]">
          当前未配置 Supabase，无法验证点赞解锁状态。
        </p>
      ) : null}
      {isConfigured && !user ? (
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          登录并点赞后，这里会显示完整 Prompt。
        </p>
      ) : null}
      {isConfigured && user && !hasLiked ? (
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          你已登录，点一下爱心即可解锁完整 Prompt。
        </p>
      ) : null}
    </article>
  );
}
