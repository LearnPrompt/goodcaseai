import type { Metadata } from "next";
import Link from "next/link";
import { CreatorAvatar } from "@/components/creator-avatar";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { getCreatorListData } from "@/lib/cases";
import { formatStabilityScore } from "@/lib/stability";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "创作者",
  description:
    "先看值得长期跟的 AI 创作者，再从代表案例切进去，学习 Prompt、模型选择与可复用方法。",
  alternates: {
    canonical: "/creators",
  },
};

export default async function CreatorsPage() {
  const creators = await getCreatorListData();

  return (
    <SiteShell footerNote="Creator 是 Case 的作者视图，不是另一套内容库。">
      <PageHero
        eyebrow="Creator index · 作者视图"
        title="先验证作品，再决定关注谁。"
        description="创作者不是凭简介进入榜单，而是由已收录 Case 反向聚合。每个人都必须能回到代表作品、来源和复测信号。"
      >
        <div>
          <div className="gc-stat-label">Creators</div>
          <div className="gc-stat-value">{creators.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">From cases</div>
        </div>
        <div>
          <div className="gc-stat-label">Rule</div>
          <div className="gc-stat-value">Case first</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">Evidence</div>
        </div>
      </PageHero>

      <section className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
        {creators.map((creator, index) => (
          <article
            key={creator.slug}
            className="gc-card flex h-full flex-col border-l-0 border-t-0 p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="gc-chip gc-chip-accent">
                {creator.highlightedLabel}
                </span>
                {creator.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="gc-chip">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="font-mono text-xs text-[var(--orange)]">
                #{String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <div className="mt-7 flex items-center gap-4">
              <CreatorAvatar
                name={creator.name}
                avatarUrl={creator.avatarUrl}
                size={64}
              />
              <h2 className="text-3xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-4xl">
                {creator.name}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{creator.bio}</p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="gc-stat">
                <div className="gc-stat-label">Cases</div>
                <div className="gc-stat-value">{creator.representativeCases.length}</div>
              </div>
              <div className="gc-stat">
                <div className="gc-stat-label">Source heat</div>
                <div className="gc-stat-value">{creator.averageSourceHeatScore ?? "—"}</div>
              </div>
              <div className="gc-stat">
                <div className="gc-stat-label">Stable</div>
                <div className="gc-stat-value">
                  {formatStabilityScore(creator.averageStabilityScore)}
                </div>
              </div>
            </div>

            <div className="mt-5 border border-[var(--hair)] bg-[var(--paper-2)] p-4">
              <p className="gc-eyebrow">
                代表案例
              </p>
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{creator.heroCase.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--muted)]">{creator.heroCase.summary}</p>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--hair)] pt-5">
              <Link
                href={`/creators/${creator.slug}`}
                className="gc-action gc-action-primary"
              >
                查看 Creator
              </Link>
              <Link
                href={`/cases/${creator.heroCase.slug}`}
                className="gc-action"
              >
                代表 Case →
              </Link>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
