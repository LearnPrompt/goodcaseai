"use client";

import { useMemo } from "react";
import { toggleLocalLike, useHasLikedCase } from "@/lib/local-likes";

export function PromptPanel({
  caseSlug,
  promptPreview,
  promptFull,
  promptPublicNote,
  promptLoginNotes,
  promptContributionNotes,
}: {
  caseSlug: string;
  promptPreview: string;
  promptFull: string;
  promptPublicNote: string;
  promptLoginNotes: string[];
  promptContributionNotes: string[];
}) {
  // SSR 与首次 hydration 一律按未解锁渲染，挂载后由 useHasLikedCase 读 localStorage 更新，避免 hydration mismatch。
  const hasLiked = useHasLikedCase(caseSlug);

  const isUnlocked = hasLiked;
  const hasExpandedPrompt = promptFull.trim() !== promptPreview.trim();
  const unlockNotes = useMemo(
    () => [...promptLoginNotes, ...promptContributionNotes],
    [promptLoginNotes, promptContributionNotes]
  );

  const tierCards = [
    {
      key: "public",
      label: "公开层",
      status: "已可见",
      description: "先看预览与这条案例为什么值得继续读。",
    },
    {
      key: "unlock",
      label: "点赞解锁层",
      status: isUnlocked ? "已解锁" : "点赞可解锁",
      description: "点一下爱心，解锁完整 Prompt、结构化拆解与更深材料。",
    },
  ];

  return (
    <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6 xl:min-h-[360px]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Prompt unlock</p>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
        {isUnlocked
          ? "你已点赞解锁，完整方法都在下面。"
          : "先公开看预览，点赞解锁这条案例的完整方法。"}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        这不是一刀切锁内容：公开层负责建立判断，点赞解锁层再给完整 Prompt、结构化拆解与更深记录。
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {tierCards.map((card) => {
          const cardUnlocked = card.key === "public" || isUnlocked;

          return (
            <article
              key={card.key}
              className={`rounded-[18px] border p-4 ${
                cardUnlocked
                  ? "border-[rgba(203,92,47,0.32)] bg-[rgba(203,92,47,0.08)]"
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

      <div className={`mt-4 rounded-[20px] border p-4 sm:p-5 ${isUnlocked ? "border-[rgba(203,92,47,0.28)] bg-[rgba(203,92,47,0.06)]" : "border-[var(--line)] bg-white/40"}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">点赞解锁层｜完整 Prompt 与结构化拆解</p>
        <ul className="grid gap-2 text-sm leading-7 text-[var(--muted)]">
          {unlockNotes.map((note) => (
            <li key={note} className="rounded-[14px] border border-[var(--line)] bg-white/60 px-3 py-2">
              {isUnlocked ? note : "点赞解锁后可见：这条案例的结构化拆解、补充提示与先试建议。"}
            </li>
          ))}
        </ul>
        {isUnlocked && hasExpandedPrompt ? (
          <div className="mt-4 rounded-[16px] border border-[rgba(203,92,47,0.2)] bg-white/70 p-4 text-sm leading-7 text-[var(--muted)] whitespace-pre-line">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">已解锁完整 Prompt</p>
            {promptFull}
          </div>
        ) : null}
      </div>

      {!isUnlocked ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs leading-5 text-[var(--muted)]">
          <span>你现在停在公开层。</span>
          <button
            type="button"
            onClick={() => toggleLocalLike(caseSlug)}
            className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)] transition hover:opacity-80"
          >
            点一下爱心，点赞解锁完整 Prompt
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">你已点赞解锁。完整 Prompt 与拆解已全部展开，随时可以照着复测。</p>
      )}
    </article>
  );
}
