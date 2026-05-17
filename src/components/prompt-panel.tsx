"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getCaseLikeState, LIKES_UPDATED_EVENT } from "@/lib/likes";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

export function PromptPanel({
  caseSlug,
  promptPreview,
  promptFull,
  promptPublicNote,
  promptLoginNotes,
  promptContributionNotes,
  initialIsLoggedIn,
  initialHasLiked,
}: {
  caseSlug: string;
  promptPreview: string;
  promptFull: string;
  promptPublicNote: string;
  promptLoginNotes: string[];
  promptContributionNotes: string[];
  initialIsLoggedIn: boolean;
  initialHasLiked: boolean;
}) {
  const pathname = usePathname();
  const { user, isReady, isConfigured } = useAuth();
  const [hasLiked, setHasLiked] = useState(initialHasLiked);

  useEffect(() => {
    setHasLiked(initialHasLiked);
  }, [initialHasLiked]);

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

  const isLoggedIn = isReady ? Boolean(user) : initialIsLoggedIn;
  const currentTier = hasLiked ? 3 : isLoggedIn ? 2 : 1;
  const hasExpandedPrompt = promptFull.trim() !== promptPreview.trim();
  const loginHref = pathname && pathname !== "/" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";

  const tierCards = useMemo(
    () => [
      {
        tier: 1,
        label: "公开层",
        status: currentTier >= 1 ? "已可见" : "未开启",
        description: "先看预览与这条案例为什么值得继续读。",
      },
      {
        tier: 2,
        label: "登录层",
        status: currentTier >= 2 ? "已解锁" : "登录可解锁",
        description: "登录后看更多结构化拆解、补充提示与试法建议。",
      },
      {
        tier: 3,
        label: "贡献层",
        status: currentTier >= 3 ? "已解锁" : "贡献可解锁",
        description: "Beta 期暂以点赞作为临时贡献信号，用来解锁完整 Prompt 与更深材料。",
      },
    ],
    [currentTier]
  );

  return (
    <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6 xl:min-h-[360px]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Prompt unlock</p>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
        {currentTier === 3
          ? "你现在看到的是 Beta 贡献层。"
          : currentTier === 2
            ? "你已进入登录层，再贡献一次就能看到最深材料。"
            : "先公开看预览，再逐层解锁这条案例的方法。"}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        这不是一刀切锁内容：公开层负责建立判断，登录层负责补结构，贡献层再给完整 Prompt 与更深记录。
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {tierCards.map((card) => {
          const isActive = card.tier === currentTier;
          const isUnlocked = currentTier >= card.tier;

          return (
            <article
              key={card.tier}
              className={`rounded-[18px] border p-4 ${
                isActive
                  ? "border-[rgba(203,92,47,0.32)] bg-[rgba(203,92,47,0.08)]"
                  : isUnlocked
                    ? "border-[var(--line)] bg-white/70"
                    : "border-[var(--line)] bg-white/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">{card.label}</span>
                <span className="rounded-full border border-[var(--line)] bg-white/70 px-2.5 py-1 text-[11px] text-[var(--muted)]">
                  {card.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.description}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-[20px] border border-[var(--line)] bg-white/60 p-4 text-sm leading-7 text-[var(--muted)] whitespace-pre-line sm:p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">公开层｜预览与值得看原因</p>
        <p>{promptPreview}</p>
        <p className="mt-3 border-t border-[var(--line)] pt-3">{promptPublicNote}</p>
      </div>

      <div className={`mt-4 rounded-[20px] border p-4 sm:p-5 ${currentTier >= 2 ? "border-[rgba(35,100,170,0.24)] bg-[rgba(35,100,170,0.06)]" : "border-[var(--line)] bg-white/40"}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-2)]">登录层｜结构化拆解</p>
        <ul className="grid gap-2 text-sm leading-7 text-[var(--muted)]">
          {promptLoginNotes.map((note) => (
            <li key={note} className="rounded-[14px] border border-[var(--line)] bg-white/60 px-3 py-2">
              {currentTier >= 2 ? note : "登录后可见：这条案例的补充提示、拆解重点与先试建议。"}
            </li>
          ))}
        </ul>
      </div>

      <div className={`mt-4 rounded-[20px] border p-4 sm:p-5 ${currentTier >= 3 ? "border-[rgba(203,92,47,0.28)] bg-[rgba(203,92,47,0.06)]" : "border-[var(--line)] bg-white/40"}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">贡献层｜完整 Prompt 与深度材料</p>
        <ul className="grid gap-2 text-sm leading-7 text-[var(--muted)]">
          {promptContributionNotes.map((note) => (
            <li key={note} className="rounded-[14px] border border-[var(--line)] bg-white/60 px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
        {currentTier >= 3 && hasExpandedPrompt ? (
          <div className="mt-4 rounded-[16px] border border-[rgba(203,92,47,0.2)] bg-white/70 p-4 text-sm leading-7 text-[var(--muted)] whitespace-pre-line">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">已解锁完整 Prompt</p>
            {promptFull}
          </div>
        ) : null}
      </div>

      {!isConfigured ? (
        <p className="mt-4 text-xs leading-5 text-[var(--accent)]">当前未配置 Supabase，无法验证登录与点赞解锁状态。</p>
      ) : null}

      {isConfigured && currentTier === 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs leading-5 text-[var(--muted)]">
          <span>你现在停在公开层。</span>
          <Link href={loginHref} className="font-semibold text-[var(--accent)] transition hover:opacity-80">
            去登录，进入下一层
          </Link>
        </div>
      ) : null}

      {isConfigured && currentTier === 2 ? (
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">你已到登录层。Beta 期点一下爱心，就把它当作一次临时贡献，继续解锁完整 Prompt。</p>
      ) : null}
    </article>
  );
}
