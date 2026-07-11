import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { PromptPanel } from "@/components/prompt-panel";
import { CaseMedia } from "@/components/case-media";
import { getCaseDetailData, getCaseSlugs, getCreatorForCase } from "@/lib/cases";

function modelCardTone(index: number) {
  if (index === 0) return "border-[rgba(203,92,47,0.38)] bg-[rgba(203,92,47,0.08)]";
  if (index === 1) return "border-[rgba(35,100,170,0.35)] bg-[rgba(35,100,170,0.08)]";
  return "border-[var(--line)] bg-white/60";
}

function modelEffectText(model: string, category: string) {
  if (category === "video") {
    return `${model}：动态连续性更稳，适合先出叙事主版本，再做节奏微调。`;
  }

  if (category === "web") {
    return `${model}：结构化产出更快，适合先搭UI骨架，再补业务细节。`;
  }

  if (category === "image") {
    return `${model}：画面质感与风格一致性更好，适合先确定主视觉方向。`;
  }

  return `${model}：文本约束执行更稳定，适合先定结构再优化表达。`;
}

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
    url: `https://goodcase.ai/cases/${item.slug}`,
    inLanguage: "zh-CN",
    creator: {
      "@type": "Person",
      name: item.creator,
    },
  };

  return (
    <SiteShell footerNote="Case 详情页现在同时承接分层解锁、编辑判断与稳定复测阅读路径。">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
        <article className="flex min-w-0 flex-col gap-5 self-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {item.category}
            </span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs">{item.source}</span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs">作者 {item.creator}</span>
            <span className="rounded-full bg-[rgba(35,100,170,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent-2)]">
              传播势能 {item.spreadScore}
            </span>
          </div>
          <h1 className="max-w-[12ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {item.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{item.summary}</p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LikeButton
              caseSlug={item.slug}
              initialCount={item.likedCount}
            />
            <FavoriteButton caseSlug={item.slug} />
            <ShareButton caseSlug={item.slug} title={item.title} />
            <div className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-4 text-sm">
              复刻 {item.remakeCount}
            </div>
            <div className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-4 text-sm">
              稳定 {item.stabilityScore}
            </div>
          </div>
        </article>

        <CaseMedia
          mediaType={item.mediaType}
          mediaUrl={item.mediaUrl}
          posterUrl={item.posterUrl}
          title={item.title}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:mt-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-5">
          <PromptPanel
            caseSlug={item.slug}
            promptPreview={item.promptPreview}
            promptFull={item.promptFull}
            promptPublicNote={item.promptPublicNote}
            promptLoginNotes={item.promptLoginNotes}
            promptContributionNotes={item.promptContributionNotes}
          />

          <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Editor&apos;s note</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
              为什么这条案例值得继续学，而不只是看一眼就走。
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.editorNote}</p>
            <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white/60 p-4 text-sm leading-7 text-[var(--muted)]">
              <p className="font-semibold text-[var(--ink)]">当前信号拆解</p>
              <p className="mt-2">传播势能 {item.spreadScore} / 喜爱分 {item.favoriteScore} / 稳定分 {item.stabilityScore}</p>
              <p className="mt-2 text-xs leading-5">{item.spreadScoreNote}</p>
            </div>
          </article>
        </div>

        <div className="grid gap-5">
          <article
            id="model-effects"
            className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Model effects</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
              稳定榜直达区：快速看推荐模型与预期效果。
            </h2>
            <div className="mt-5 grid gap-3">
              {item.recommendedModels.map((model, index) => (
                <article key={model} className={`rounded-[16px] border px-4 py-4 ${modelCardTone(index)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-[var(--ink)]">{model}</h3>
                    <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs">
                      稳定参考 {Math.max(60, item.stabilityScore - index)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{modelEffectText(model, item.category)}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
              成本档位：
              <strong className="ml-2 text-[var(--ink)]">{costBandLabel(item.costBand)}</strong>
            </p>
          </article>

          <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-2)]">Lab note</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
              如果你是从稳定榜点进来，先这样试。
            </h2>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
              {item.labNote.map((note) => (
                <p key={note} className="rounded-[16px] border border-[var(--line)] bg-white/60 px-4 py-3">
                  {note}
                </p>
              ))}
            </div>
          </article>

          {creator ? (
            <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Creator module</p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
                这个案例背后的 creator：{creator.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{creator.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {creator.highlightedLabel}
                </span>
                {creator.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                <span>来源 {creator.sourceFootprint.join(" / ")}</span>
                <span>点赞 {creator.totalLikes}</span>
                <span>稳定 {creator.averageStabilityScore}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/creators/${creator.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  查看 creator 页面
                </Link>
                <Link
                  href={`/cases/${creator.heroCase.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/50 px-4 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  查看代表案例
                </Link>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </SiteShell>
  );
}
