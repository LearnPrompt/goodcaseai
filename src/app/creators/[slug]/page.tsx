import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getCreatorDetailData, getCreatorListData } from "@/lib/cases";

export const revalidate = 300;

export async function generateStaticParams() {
  const creators = await getCreatorListData();
  return creators.map((creator) => ({ slug: creator.slug }));
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
  const creator = await getCreatorDetailData(slug);

  if (!creator) {
    // 提前触发 404，避免流式渲染下先发 200 再渲染 not-found（软 404）。
    notFound();
  }

  const description = truncateDescription(creator.bio);

  return {
    title: creator.name,
    description,
    alternates: {
      canonical: `/creators/${slug}`,
    },
    openGraph: {
      type: "profile",
      locale: "zh_CN",
      siteName: "GoodCase.ai",
      url: `/creators/${slug}`,
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const creator = await getCreatorDetailData(slug);

  if (!creator) {
    notFound();
  }

  return (
    <SiteShell footerNote="creator 详情页把方法论、代表案例与原有 case 详情链路串成同一条学习路径。">
      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <article className="grid gap-4 self-start">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {creator.highlightedLabel}
            </span>
            {creator.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="max-w-[10ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {creator.name}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{creator.bio}</p>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span>来源：{creator.sourceFootprint.join(" / ")}</span>
            <span>点赞 {creator.totalLikes}</span>
            <span>复刻 {creator.totalRemakes}</span>
            <span>稳定 {creator.averageStabilityScore}</span>
          </div>
        </article>

        <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            学习切入点
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em]">
            先从这位 creator 的代表作切进去。
          </h2>
          <div className="mt-5 rounded-[18px] border border-[var(--line)] bg-white/50 p-4">
            <p className="text-sm text-[var(--muted)]">当前主案例</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{creator.heroCase.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{creator.heroCase.summary}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span>{creator.heroCase.category}</span>
              <span>{creator.heroCase.source}</span>
              <span>稳定 {creator.heroCase.stabilityScore}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/cases/${creator.heroCase.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                查看代表案例详情
              </Link>
              <Link
                href="/cases"
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/50 px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                返回案例库
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-8 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              Representative cases
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em]">
              代表案例
            </h2>
          </div>
          <Link
            href="/creators"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            查看更多 creator
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creator.representativeCases.map((item) => (
            <article key={item.slug} className="rounded-[20px] border border-[var(--line)] bg-white/50 p-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {item.category}
                </span>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                  {item.source}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold leading-tight text-[var(--ink)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                <span>点赞 {item.likedCount}</span>
                <span>稳定 {item.stabilityScore}</span>
              </div>
              <Link
                href={`/cases/${item.slug}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                进入案例详情
              </Link>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
