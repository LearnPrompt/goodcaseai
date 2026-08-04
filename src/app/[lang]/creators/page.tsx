import type { Metadata } from "next";
import { CreatorAvatar } from "@/components/creator-avatar";
import { LocalizedLink as Link } from "@/components/localized-link";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { SearchBox } from "@/components/search-box";
import { getCreatorListData } from "@/lib/cases";
import { filterCreatorsByQuery } from "@/lib/creators";
import { formatStabilityScore } from "@/lib/stability";
import { localizeHref, SUPPORTED_LOCALES } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";

// 内容只在运营发布时变，发布会触发部署重新生成；这里当兜底，一小时一次足够。
export const revalidate = 3_600;

// [lang] 是动态段，不加 generateStaticParams 的话上面的 revalidate 完全不起作用——
// 每次请求都会打 Supabase。只有两种语言，直接枚举。
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

type PageParams = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  return {
    title: isEnglish ? "Creators" : "创作者",
    description: isEnglish
      ? "Evaluate AI creators through representative work, prompts, model choices, and reusable methods."
      : "先看值得长期跟的 AI 创作者，再从代表案例切进去，学习 Prompt、模型选择与可复用方法。",
    alternates: {
      canonical: localizeHref(locale, "/creators"),
      languages: {
        "zh-CN": "/creators",
        en: "/en/creators",
        "x-default": "/creators",
      },
    },
  };
}

export default async function CreatorsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const isEnglish = locale === "en";
  const allCreators = await getCreatorListData(locale);
  const queryParams = await searchParams;
  const query = queryParams.q?.trim() || "";
  const creators = filterCreatorsByQuery(allCreators, query);

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Creators are a view of existing cases, not a separate content library."
          : "Creator 是 Case 的作者视图，不是另一套内容库。"
      }
    >
      <PageHero
        eyebrow={
          isEnglish ? "Creator index · Evidence view" : "Creator index · 作者视图"
        }
        title={
          isEnglish
            ? "Verify the work before deciding whom to follow."
            : "先验证作品，再决定关注谁。"
        }
        description={
          isEnglish
            ? "Every creator in this index is aggregated from collected cases, and each entry traces back to representative work, sources, and retest signals."
            : "创作者由已收录 Case 反向聚合，每个人都能回到代表作品、来源和复测信号。"
        }
      >
        <div>
          <div className="gc-stat-label">
            {isEnglish ? "Creators" : "创作者"}
          </div>
          <div className="gc-stat-value">{creators.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">From cases</div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Rule" : "规则"}</div>
          <div className="gc-stat-value">
            {isEnglish ? "Case first" : "Case 优先"}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {messages.common.evidence}
          </div>
        </div>
      </PageHero>

      <section className="border-b border-[var(--hair)] py-6">
        <SearchBox
          defaultQuery={query}
          action={localizeHref(locale, "/creators")}
          placeholder={messages.search.creatorsPlaceholder}
          ariaLabel={messages.search.creatorsAriaLabel}
          analyticsEvent="creator_search"
        />
      </section>

      {creators.length === 0 ? (
        <section className="gc-empty-state mt-7">
          <p className="text-lg font-semibold text-[var(--ink)]">
            {isEnglish
              ? `No creators found${query ? ` for “${query}”` : ""}.`
              : `没有找到${query ? `与「${query}」相关的` : ""}创作者。`}
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            {isEnglish ? "Try another keyword." : "换个关键词试试。"}
          </p>
        </section>
      ) : (
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
                <div className="gc-stat-label">{messages.common.cases}</div>
                <div className="gc-stat-value">{creator.caseCount}</div>
              </div>
              <div className="gc-stat">
                <div className="gc-stat-label">{messages.common.sourceHeat}</div>
                <div className="gc-stat-value">{creator.averageSourceHeatScore ?? "—"}</div>
              </div>
              <div className="gc-stat">
                <div className="gc-stat-label">{messages.common.stability}</div>
                <div className="gc-stat-value">
                  {formatStabilityScore(creator.averageStabilityScore, locale)}
                </div>
              </div>
            </div>

            <div className="mt-5 border border-[var(--hair)] bg-[var(--paper-2)] p-4">
              <p className="gc-eyebrow">
                {isEnglish ? "Representative case" : "代表案例"}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{creator.heroCase.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--muted)]">{creator.heroCase.summary}</p>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--hair)] pt-5">
              <Link
                href={`/creators/${creator.slug}`}
                className="gc-action gc-action-primary"
              >
                {messages.common.viewCreator}
              </Link>
              <Link
                href={`/cases/${creator.heroCase.slug}`}
                className="gc-action"
              >
                {isEnglish ? "Representative case" : "代表 Case"} →
              </Link>
            </div>
          </article>
        ))}
      </section>
      )}
    </SiteShell>
  );
}
