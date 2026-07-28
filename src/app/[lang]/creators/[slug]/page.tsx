import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseCard } from "@/components/case-card";
import { CreatorAvatar } from "@/components/creator-avatar";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { LocalizedLink as Link } from "@/components/localized-link";
import { SUPPORTED_LOCALES, localizeHref } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import { getCreatorDetailData, getCreatorListData } from "@/lib/cases";
import { formatStabilityScore } from "@/lib/stability";

export const revalidate = 300;

export async function generateStaticParams() {
  const creators = await getCreatorListData();
  return SUPPORTED_LOCALES.flatMap((lang) =>
    creators.map((creator) => ({ lang, slug: creator.slug }))
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
  const creator = await getCreatorDetailData(slug, locale);

  if (!creator) {
    // 提前触发 404，避免流式渲染下先发 200 再渲染 not-found（软 404）。
    notFound();
  }

  const description = truncateDescription(creator.bio);

  return {
    title: creator.name,
    description,
    alternates: {
      canonical: localizeHref(locale, `/creators/${slug}`),
      languages: {
        "zh-CN": `/creators/${slug}`,
        en: `/en/creators/${slug}`,
        "x-default": `/creators/${slug}`,
      },
    },
    openGraph: {
      type: "profile",
      locale: locale === "en" ? "en_US" : "zh_CN",
      siteName: "GoodCase.ai",
      url: localizeHref(locale, `/creators/${slug}`),
      title: creator.name,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: creator.name,
      description,
    },
  };
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const isEnglish = locale === "en";
  const { slug } = await params;
  const creator = await getCreatorDetailData(slug, locale);

  if (!creator) {
    notFound();
  }

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Creator pages aggregate existing cases so every judgment traces back to the work."
          : "Creator 页只聚合已有 Case，所有判断都能回到作品证据。"
      }
    >
      <PageHero
        eyebrow={`Creator · ${creator.highlightedLabel}`}
        title={creator.name}
        description={creator.bio}
      >
        <div className="col-span-2 flex items-center gap-4">
          <CreatorAvatar
            name={creator.name}
            avatarUrl={creator.avatarUrl}
            size={72}
          />
          <div>
            <div className="gc-stat-label">
              {isEnglish ? "Creator profile" : "创作者资料"}
            </div>
            <div className="mt-1 text-lg font-semibold">{creator.name}</div>
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{messages.common.cases}</div>
          <div className="gc-stat-value">{creator.representativeCases.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {creator.sourceFootprint.join(" / ")}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Average" : "平均值"}</div>
          <div className="gc-stat-value">
            {formatStabilityScore(creator.averageStabilityScore)}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            Stability
          </div>
        </div>
        <div>
          <div className="gc-stat-label">
            {isEnglish ? "Source interactions" : "来源互动"}
          </div>
          <div className="gc-stat-value">{creator.totalSourceInteractions || "—"}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            Total
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{messages.common.evidence}</div>
          <div className="gc-stat-value">
            {
              creator.representativeCases.filter(
                (item) => item.evidenceLevel === "L1" || item.evidenceLevel === "L2"
              ).length
            }
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            L1 / L2 Cases
          </div>
        </div>
      </PageHero>

      <section className="gc-section">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hair)] pb-6">
          <div>
            <p className="gc-eyebrow">
              {isEnglish ? "Representative cases" : "代表案例"}
            </p>
            <h2 className="mt-3 text-4xl font-medium leading-[0.95] tracking-[-0.04em]">
              {isEnglish
                ? "Start with the representative work."
                : "从代表 Case 开始判断。"}
            </h2>
          </div>
          <Link
            href="/creators"
            className="gc-action"
          >
            {isEnglish ? "Back to creators" : "返回创作者索引"}
          </Link>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
          {creator.representativeCases.map((item) => (
            <CaseCard key={item.slug} item={item} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
