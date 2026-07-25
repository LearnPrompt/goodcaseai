import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorAvatar } from "@/components/creator-avatar";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { PromptPanel } from "@/components/prompt-panel";
import { CaseMedia } from "@/components/case-media";
import { TrackEvent } from "@/components/track-event";
import { getCaseDetailData, getCaseSlugs, getCreatorForCase } from "@/lib/cases";
import { absoluteUrl } from "@/lib/site";

function costBandLabel(costBand: "low" | "medium" | "high") {
  if (costBand === "low") return "低";
  if (costBand === "medium") return "中";
  return "高";
}

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getCaseSlugs();
  return slugs.map((slug) => ({ slug }));
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getCaseDetailData(slug);

  if (!item) {
    // 提前触发 404，避免流式渲染下先发 200 再渲染 not-found（软 404）。
    notFound();
  }

  const description = truncateDescription(item.summary);

  return {
    title: item.title,
    description,
    alternates: {
      canonical: `/cases/${slug}`,
    },
    openGraph: {
      type: "article",
      locale: "zh_CN",
      siteName: "GoodCase.ai",
      url: `/cases/${slug}`,
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [item, creator] = await Promise.all([
    getCaseDetailData(slug),
    getCreatorForCase(slug),
  ]);

  if (!item) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: item.title,
    description: item.summary,
    url: absoluteUrl(`/cases/${item.slug}`),
    inLanguage: "zh-CN",
    creator: {
      "@type": "Person",
      name: item.creator,
    },
  };

  return (
    <SiteShell footerNote="Case 详情页把作品、方法、作者与复测证据放在同一条阅读路径里。">
      <TrackEvent name="case_open" properties={{ caseSlug: item.slug }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="grid gap-0 border-b border-[var(--hair)] pb-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
        <article className="flex min-w-0 flex-col gap-5 self-start py-8 xl:pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="gc-chip gc-chip-accent">
              {item.category}
            </span>
            <span className="gc-chip">{item.source}</span>
            {item.evidenceLevel ? (
              <span className="gc-chip">证据 {item.evidenceLevel}</span>
            ) : null}
          </div>
          <h1 className="max-w-[12ch] text-5xl font-medium leading-[0.92] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            {item.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{item.summary}</p>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="gc-action w-fit"
            >
              查看原始来源 ↗
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
          promptTranslationZh={item.promptTranslationZh}
          promptContributionNotes={item.promptContributionNotes}
          recommendedModels={item.recommendedModels}
          stabilityScore={item.stabilityScore}
          costBand={costBandLabel(item.costBand)}
        />

        {creator ? (
          <article className="gc-panel grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <CreatorAvatar
                name={creator.name}
                avatarUrl={creator.avatarUrl}
                size={64}
              />
              <div>
                <p className="gc-eyebrow">Creator</p>
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
              查看 Creator →
            </Link>
          </article>
        ) : null}
      </section>
    </SiteShell>
  );
}
