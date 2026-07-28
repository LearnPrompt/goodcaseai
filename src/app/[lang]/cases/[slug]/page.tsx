import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseCard } from "@/components/case-card";
import { CreatorAvatar } from "@/components/creator-avatar";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { PromptPanel } from "@/components/prompt-panel";
import { CaseMedia } from "@/components/case-media";
import { TrackEvent } from "@/components/track-event";
import { LocalizedLink as Link } from "@/components/localized-link";
import { SUPPORTED_LOCALES, localizeHref } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import {
  getCaseDetailData,
  getCaseDetailPageData,
  getCaseSlugs,
} from "@/lib/cases";
import {
  formatPublishedDate,
} from "@/lib/case-presentation";
import { MISSING_MODEL } from "@/lib/related-cases";
import { absoluteUrl } from "@/lib/site";

function costBandLabel(
  costBand: "low" | "medium" | "high",
  locale: "zh-CN" | "en"
) {
  if (locale === "en") {
    if (costBand === "low") return "Low";
    if (costBand === "medium") return "Medium";
    return "High";
  }
  if (costBand === "low") return "低";
  if (costBand === "medium") return "中";
  return "高";
}

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getCaseSlugs();
  return SUPPORTED_LOCALES.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
}

function truncateDescription(text: string, maxLength = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const { slug } = await params;
  const item = await getCaseDetailData(slug, locale);

  if (!item) {
    // 提前触发 404，避免流式渲染下先发 200 再渲染 not-found（软 404）。
    notFound();
  }

  const description = truncateDescription(item.summary);

  return {
    title: item.title,
    description,
    alternates: {
      canonical: localizeHref(locale, `/cases/${slug}`),
      languages: {
        "zh-CN": `/cases/${slug}`,
        en: `/en/cases/${slug}`,
        "x-default": `/cases/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      locale: locale === "en" ? "en_US" : "zh_CN",
      siteName: "GoodCase.ai",
      url: localizeHref(locale, `/cases/${slug}`),
      title: item.title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
    },
  };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const isEnglish = locale === "en";
  const { slug } = await params;
  const { item, creator, relatedCases } = await getCaseDetailPageData(
    slug,
    locale
  );

  if (!item) {
    notFound();
  }

  const publishedDate = formatPublishedDate(item.sourcePublishedAt);
  const searchableModels = item.recommendedModels.filter(
    (model) => model !== MISSING_MODEL
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: item.title,
    description: item.summary,
    url: absoluteUrl(localizeHref(locale, `/cases/${item.slug}`)),
    inLanguage: locale,
    creator: {
      "@type": "Person",
      name: item.creator,
    },
  };

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Each detail page keeps the work, method, creator, and retest evidence in one reading path."
          : "Case 详情页把作品、方法、作者与复测证据放在同一条阅读路径里。"
      }
    >
      <TrackEvent name="case_open" properties={{ caseSlug: item.slug }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="grid gap-0 border-b border-[var(--hair)] pb-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
        <article className="flex min-w-0 flex-col gap-5 self-start py-8 xl:pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/cases?filter=${item.category}`}
              className="gc-chip gc-chip-accent"
            >
              {messages.category[item.category]}
            </Link>
            <span className="gc-chip">{item.source}</span>
            {publishedDate ? (
              <span className="gc-chip font-mono">{publishedDate}</span>
            ) : null}
            {item.evidenceLevel ? (
              <span className="gc-chip">
                {messages.common.evidence} {item.evidenceLevel}
              </span>
            ) : null}
            {(item.tags ?? []).map((tag) => (
              <Link
                key={tag}
                href={`/cases?q=${encodeURIComponent(tag)}`}
                className="gc-chip"
              >
                #{tag}
              </Link>
            ))}
            {searchableModels.map((model) => (
              <Link
                key={model}
                href={`/cases?q=${encodeURIComponent(model)}`}
                className="gc-chip"
              >
                {model}
              </Link>
            ))}
          </div>
          <h1 className="max-w-[12ch] text-5xl font-medium leading-[0.92] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            {item.title}
          </h1>
          {creator ? (
            <Link
              href={`/creators/${creator.slug}`}
              className="group flex w-fit items-center gap-3"
            >
              <CreatorAvatar
                name={creator.name}
                avatarUrl={creator.avatarUrl}
                size={44}
              />
              <span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  {messages.common.creator}
                </span>
                <span className="mt-1 block text-sm font-semibold transition group-hover:text-[var(--orange)]">
                  {creator.name} →
                </span>
              </span>
            </Link>
          ) : (
            <p className="font-mono text-xs text-[var(--muted)]">
              {messages.common.creator} · {item.creator}
            </p>
          )}
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{item.summary}</p>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="gc-action w-fit"
            >
              {messages.common.originalSource} ↗
            </a>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LikeButton
              caseSlug={item.slug}
              initialCount={item.likedCount}
            />
            <FavoriteButton caseSlug={item.slug} />
            <ShareButton caseSlug={item.slug} title={item.title} />
          </div>
        </article>

        <CaseMedia
          mediaType={item.mediaType}
          mediaUrl={item.mediaUrl}
          posterUrl={item.posterUrl}
          title={item.title}
        />
      </section>

      <section className="grid gap-5 border-b border-[var(--hair)] py-8">
        <PromptPanel
          promptPreview={item.promptPreview}
          promptFull={item.promptFull}
          contentLocale={item.contentLocale}
          promptTranslationZh={item.promptTranslationZh}
          promptTranslationEn={item.promptTranslationEn}
          promptContributionNotes={item.promptContributionNotes}
          recommendedModels={item.recommendedModels}
          stabilityScore={item.stabilityScore}
          costBand={costBandLabel(item.costBand, locale)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--hair)] bg-[var(--paper-2)] px-4 py-3 text-sm">
          <span className="text-[var(--muted)]">
            {messages.prompt.noSkill}
          </span>
          <Link href="/connect#feedback" className="gc-action">
            {messages.prompt.requestSkill} →
          </Link>
        </div>

        {creator ? (
          <article className="gc-panel grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <CreatorAvatar
                name={creator.name}
                avatarUrl={creator.avatarUrl}
                size={64}
              />
              <div>
                <p className="gc-eyebrow">{messages.common.creator}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  {creator.name}
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--muted)]">{creator.bio}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="gc-chip gc-chip-accent">{creator.highlightedLabel}</span>
                  {creator.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="gc-chip">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <Link href={`/creators/${creator.slug}`} className="gc-action gc-action-primary">
              {messages.common.viewCreator} →
            </Link>
          </article>
        ) : null}
      </section>

      <section className="gc-section">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hair)] pb-6">
          <div>
            <p className="gc-eyebrow">
              {isEnglish ? "Keep exploring" : "继续探索"}
            </p>
            <h2 className="mt-3 text-4xl font-medium leading-[0.95] tracking-[-0.04em]">
              {isEnglish ? "Explore related cases." : "继续看相关 Case。"}
            </h2>
          </div>
          <Link
            href={`/cases?filter=${item.category}`}
            className="gc-action"
          >
            {isEnglish ? "View all" : "查看全部"}{" "}
            {messages.category[item.category]} Case →
          </Link>
        </div>

        {relatedCases.length > 0 ? (
          <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 2xl:grid-cols-3">
            {relatedCases.map((relatedCase) => (
              <CaseCard key={relatedCase.slug} item={relatedCase} />
            ))}
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}
