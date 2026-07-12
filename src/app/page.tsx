import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { getHomeData, type DisplayCaseItem } from "@/lib/cases";

export const revalidate = 300;

const categoryLabels: Record<DisplayCaseItem["category"], string> = {
  image: "AI-IMAGE",
  video: "AI-VIDEO",
  web: "CODING-WF",
  copy: "COPY-WF",
};

const costLabels: Record<DisplayCaseItem["costBand"], string> = {
  low: "LOW",
  medium: "MID",
  high: "HIGH",
};

function uniqueCases(items: DisplayCaseItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.slug)) {
      return false;
    }
    seen.add(item.slug);
    return true;
  });
}

function MediaTile({
  item,
  rank,
  className = "",
}: {
  item: DisplayCaseItem;
  rank?: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden border border-[var(--hair)] bg-[var(--ink)] ${className}`}>
      {item.mediaType === "video" && item.posterUrl ? (
        <Image src={item.posterUrl} alt={item.title} fill sizes="(min-width: 1024px) 20vw, 33vw" className="object-cover opacity-90 grayscale" />
      ) : item.mediaType === "video" ? (
        <video
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          poster={item.posterUrl}
          className="h-full w-full object-cover opacity-90 grayscale"
        >
          <source src={item.mediaUrl} type="video/mp4" />
        </video>
      ) : (
        <Image src={item.mediaUrl} alt={item.title} fill sizes="(min-width: 1024px) 20vw, 33vw" className="object-cover opacity-90 grayscale" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,87,51,0.32),transparent_46%,rgba(10,10,10,0.38))]" />
      {rank ? (
        <span className="absolute left-2 top-2 bg-[var(--orange)] px-2 py-1 font-mono text-[10px] text-white">
          {rank}
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
        {categoryLabels[item.category]}
      </span>
    </div>
  );
}

function EvidenceTile({ item }: { item: DisplayCaseItem }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden border border-[var(--hair)] bg-[var(--ink)]">
      {item.mediaType === "video" && item.posterUrl ? (
        <Image src={item.posterUrl} alt={item.title} fill sizes="120px" className="object-cover opacity-80 grayscale" />
      ) : item.mediaType === "video" ? (
        <video
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          poster={item.posterUrl}
          className="h-full w-full object-cover opacity-80 grayscale"
        >
          <source src={item.mediaUrl} type="video/mp4" />
        </video>
      ) : (
        <Image src={item.mediaUrl} alt={item.title} fill sizes="120px" className="object-cover opacity-80 grayscale" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,87,51,0.28),transparent_54%,rgba(0,0,0,0.46))]" />
      <span className="absolute bottom-0 right-0 bg-black/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.05em] text-white">
        {item.recommendedModels[0] || categoryLabels[item.category]}
      </span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--concrete)] bg-white p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{value}</div>
    </div>
  );
}

function RankingList({
  items,
  renderRow,
  scrollable = true,
  maxHeightClassName = "max-h-[560px]",
}: {
  items: DisplayCaseItem[];
  renderRow: (item: DisplayCaseItem, index: number) => ReactNode;
  scrollable?: boolean;
  maxHeightClassName?: string;
}) {
  return (
    <div className={scrollable ? `${maxHeightClassName} overflow-y-auto` : undefined}>
      {items.map((item, index) => renderRow(item, index))}
    </div>
  );
}

function renderFavoriteRow(item: DisplayCaseItem, index: number) {
  return (
    <div key={item.slug} className="grid grid-cols-[34px_56px_1fr_72px] items-center gap-4 border-b border-[var(--concrete)] px-5 py-3 last:border-b-0">
      <span className={`font-mono text-xs ${index < 3 ? "text-[var(--orange)]" : "text-[var(--mute)]"}`}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <Link href={`/cases/${item.slug}`}>
        <MediaTile item={item} className="aspect-[3/4]" />
      </Link>
      <div>
        <Link href={`/cases/${item.slug}`} className="font-semibold leading-tight hover:text-[var(--orange)]">
          {item.title}
        </Link>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--mute)]">
          {item.creator} · {categoryLabels[item.category]}
        </div>
      </div>
      <div className="text-right font-mono text-xs">
        ♥ <b className="text-[var(--orange)]">{item.favoriteScore}</b>
      </div>
    </div>
  );
}

function renderStabilityRow(item: DisplayCaseItem, index: number) {
  return (
    <div
      key={item.slug}
      className="grid grid-cols-[30px_50px_minmax(0,1fr)_70px] items-center gap-3 border-b border-[var(--concrete)] px-5 py-4 last:border-b-0 md:grid-cols-[34px_56px_minmax(0,1fr)_112px_72px] md:gap-4"
    >
      <span className={`font-mono text-xs ${index < 2 ? "text-[var(--orange)]" : "text-[var(--mute)]"}`}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <Link href={`/cases/${item.slug}#model-effects`}>
        <EvidenceTile item={item} />
      </Link>
      <div>
        <Link href={`/cases/${item.slug}#model-effects`} className="font-semibold leading-tight hover:text-[var(--orange)]">
          {item.title}
        </Link>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--mute)]">
          N=Beta · {item.recommendedModels.slice(0, 2).join(" / ")}
        </div>
      </div>
      <div className="hidden flex-wrap gap-1 md:flex">
        {item.recommendedModels.slice(0, 2).map((model) => (
          <span key={model} className="border border-[var(--concrete)] px-1.5 py-1 font-mono text-[9px] text-[var(--mute)]">
            {model}
          </span>
        ))}
      </div>
      <div className="text-right font-mono text-xs">
        <b className="text-[var(--orange)]">{item.stabilityScore}%</b>
      </div>
    </div>
  );
}

export default async function Home() {
  const {
    featuredCase,
    totalCaseCount,
    totalCreatorCount,
    featuredCreators,
    spreadLeaderboard,
    favoriteLeaderboard,
    stabilityLeaderboard,
  } = await getHomeData();

  const previewCases = uniqueCases([
    ...spreadLeaderboard,
    ...favoriteLeaderboard,
    ...stabilityLeaderboard,
  ]);
  const heroThumbs = previewCases.slice(0, 3);
  const skillCases = previewCases.slice(0, 6);

  return (
    <SiteShell footerNote="GoodCase.ai · Case / Creator / Lab / Skill 持续更新。">
      <section className="grid min-w-0 gap-10 py-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(560px,1fr)] lg:items-end lg:py-16">
        <article className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--mute)]">
            平台 · 不只看案例，也要顺着创作者继续学。
          </p>
          <h1 className="mt-6 max-w-full text-[3.45rem] font-medium leading-[0.92] tracking-normal text-[var(--ink)] sm:text-6xl md:max-w-[10ch] md:text-8xl">
            <span className="block md:inline">看清什么</span>
            <span className="block md:inline">
              <span className="text-[var(--orange)]">真有效</span>，
            </span>
            <span className="block md:inline">关注持续</span>
            <span className="block md:inline">产出的人。</span>
          </h1>
          <p className="mt-7 max-w-xl break-words text-base leading-8 text-[var(--mute)]">
            GoodCase.ai 追踪正在传播的 AI case，用同提示复现实验验证稳定性，再把反复成立的创作者模式沉淀成可复用方法包。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="gc-btn gc-btn-primary" href="/cases">
              查看榜单 <span>→</span>
            </Link>
            <Link className="gc-btn" href="/creators">
              浏览创作者
            </Link>
            <Link className="gc-btn gc-btn-ghost" href="/submit">
              提交案例
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--mute)]">
            <span>
              <b className="text-[var(--ink)]">{totalCaseCount}</b> cases
            </span>
            <span>
              <b className="text-[var(--ink)]">{totalCreatorCount}</b> creators
            </span>
            <span>
              <b className="text-[var(--ink)]">{skillCases.length}</b> skill seeds
            </span>
          </div>
        </article>

        <article className="relative min-w-0 border border-[var(--hair)] bg-white shadow-[0_44px_90px_-52px_rgba(10,10,10,0.7)]">
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--hair)] bg-[var(--paper-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
            <span>实时预览 · Beta</span>
            <span className="text-[var(--orange)]">● 实时</span>
          </div>

          <div className="border-b border-[var(--hair)] bg-[var(--paper-2)] p-4">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
              <span>方法论 · Skill</span>
              <span className="text-[var(--orange)]">Open</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{skillCases[0].title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--mute)]">{skillCases[0].summary.slice(0, 60)}...</p>
            <Link href={`/cases/${skillCases[0].slug}`} className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-[var(--orange)]">
              查看方法包 <span>→</span>
            </Link>
          </div>

          <div className="grid gap-px bg-[var(--hair)] md:grid-cols-2">
            <div className="min-w-0 bg-white p-4">
              <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>Love Ranking · 喜爱榜</span>
                <span>Top 1</span>
              </div>
              <RankingList items={favoriteLeaderboard.slice(0, 1)} renderRow={renderFavoriteRow} scrollable={false} />
            </div>
            <div className="min-w-0 bg-white p-4">
              <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>Stability Ranking · 稳定榜</span>
                <span>Top 1</span>
              </div>
              <RankingList items={stabilityLeaderboard.slice(0, 1)} renderRow={renderStabilityRow} scrollable={false} />
            </div>
          </div>

          <div className="bg-white p-4">
            <div className="mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
              <span>正在传播 · 24h</span>
              <span className="text-[var(--orange)]">● 实时</span>
            </div>
            <Link href={`/cases/${heroThumbs[0].slug}`} className="flex items-center gap-3">
              <MediaTile item={heroThumbs[0]} rank="#01" className="aspect-[3/4] w-20 shrink-0" />
              <div>
                <div className="font-semibold leading-tight">{heroThumbs[0].title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--mute)]">
                  {heroThumbs[0].creator} · {categoryLabels[heroThumbs[0].category]}
                </div>
              </div>
            </Link>
          </div>
        </article>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 01 · 榜单</div>
          <div>
            <h2 className="gc-section-title">一个读人群偏好，一个读模型稳定性。</h2>
          </div>
        </div>
        <div className="grid border-t border-[var(--hair)] lg:grid-cols-2">
          <article className="border border-t-0 border-[var(--hair)] bg-white">
            <div className="flex justify-between border-b border-[var(--hair)] px-5 py-4">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">
                <span className="mr-2 inline-block size-2 bg-[var(--orange)]" />
                Love Ranking · 喜爱榜
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">24h</span>
            </div>
            <RankingList items={favoriteLeaderboard} renderRow={renderFavoriteRow} />
          </article>

          <article className="border border-t-0 border-[var(--hair)] bg-white lg:border-l-0">
            <div className="flex justify-between border-b border-[var(--hair)] px-5 py-4">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">
                <span className="mr-2 inline-block size-2 bg-[var(--orange)]" />
                Stability Ranking · 稳定榜
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">Beta 实验</span>
            </div>
            <RankingList items={stabilityLeaderboard} renderRow={renderStabilityRow} />
          </article>
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 02 · 方法包</div>
          <div>
            <h2 className="gc-section-title">当模式反复出现，就升级成 Skill。</h2>
          </div>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
          {skillCases.map((item, index) => (
            <article key={item.slug} className="min-h-80 border-b border-r border-[var(--hair)] bg-white p-6">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
                <span>Skill · {String(index + 1).padStart(4, "0")}</span>
                <span className={index % 3 === 2 ? "text-[var(--mute)]" : "text-[var(--orange)]"}>
                  {index % 3 === 2 ? "Like-unlock" : "Open"}
                </span>
              </div>
              <h3 className="mt-7 text-2xl font-semibold tracking-[-0.03em]">{item.title}</h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--mute)]">
                {categoryLabels[item.category]} · Beta 方法种子
              </p>
              <div className="mt-6 grid gap-3 font-mono text-[11px]">
                <div className="grid grid-cols-[76px_1fr] gap-3 border-b border-dashed border-[var(--concrete)] pb-3">
                  <span className="text-[var(--mute)]">Stack</span>
                  <span>{item.recommendedModels.slice(0, 2).join(" / ")}</span>
                </div>
                <div className="grid grid-cols-[76px_1fr] gap-3 border-b border-dashed border-[var(--concrete)] pb-3">
                  <span className="text-[var(--mute)]">Output</span>
                  <span>{item.summary.slice(0, 58)}...</span>
                </div>
                <div className="grid grid-cols-[76px_1fr] gap-3">
                  <span className="text-[var(--mute)]">By</span>
                  <span>{item.creator}</span>
                </div>
              </div>
              <div className="mt-7 flex items-center justify-between border-t border-[var(--hair)] pt-4 font-mono text-[10px] uppercase tracking-[0.08em]">
                <span>{item.remakeCount} related runs</span>
                <Link href={`/cases/${item.slug}`} className="text-[var(--orange)]">
                  View ↗
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 03 · 创作者</div>
          <div>
            <h2 className="gc-section-title">为持续交付的创作者设计，而不是为一次性爆款设计。</h2>
          </div>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-4">
          {featuredCreators.map((creator) => (
            <Link key={creator.slug} href={`/creators/${creator.slug}`} className="min-h-80 border-b border-r border-[var(--hair)] bg-white p-6 transition hover:bg-[var(--paper-2)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="flex size-12 items-center justify-center border border-[var(--hair)] bg-[var(--paper-2)] font-mono text-sm font-semibold">
                    {creator.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <span className="block font-semibold">{creator.name}</span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--mute)]">
                      {categoryLabels[creator.primaryCategory]} · {creator.sourceFootprint.slice(0, 2).join(" / ")}
                    </span>
                  </span>
                </div>
                <span className="border border-[var(--orange)] px-2 py-1 font-mono text-[10px] text-[var(--orange)]">
                  {creator.highlightedLabel}
                </span>
              </div>
              <p className="mt-6 text-sm leading-7 text-[var(--mute)]">{creator.bio}</p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <MiniMetric label="Cases" value={creator.representativeCases.length} />
                <MiniMetric label="Love" value={creator.averageFavoriteScore} />
                <MiniMetric label="Stab." value={creator.averageStabilityScore} />
              </div>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
                Method maturity · {Math.min(5, Math.max(2, Math.round(creator.averageStabilityScore / 20)))}/5
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 04 · 流程</div>
          <div>
            <h2 className="gc-section-title">Case, Creator, Lab, Skill：让爆款不只是刷过去。</h2>
          </div>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-4">
          {[
            ["01", "CASE", "发现可学习案例", "从 X、小红书、B 站、GitHub 等入口抓住正在传播的案例。"],
            ["02", "CREATOR", "看谁持续产出", "把单条案例回挂到创作者，判断是不是一次性运气。"],
            ["03", "LAB", "跨模型复现实验", "用同提示、同变量复跑，记录稳定分、漂移和成本。"],
            ["04", "SKILL", "沉淀方法包", "当同一创作者反复跑出同类模式，就升级为可复用 Skill。"],
          ].map(([num, label, title, copy]) => (
            <article key={label} className="min-h-64 border-b border-r border-[var(--hair)] bg-white p-7">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mute)]">
                <span>{num}</span>
                <b className="font-medium text-[var(--orange)]">{label}</b>
              </div>
              <div className="mt-8 flex size-12 items-center justify-center border border-[var(--hair)] font-mono text-lg">
                {label.slice(0, 1)}
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-[var(--mute)]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 05 · 转换</div>
          <div>
            <h2 className="gc-section-title">从碎片化爆款，到可复用方法。</h2>
          </div>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_48px_1fr]">
          <article className="min-h-[520px] border border-[var(--hair)] bg-[var(--paper-2)] p-7">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mute)]">
              <span>A · 原始 / 分散</span>
              <span>互联网</span>
            </div>
            <div className="relative mt-8 min-h-[410px]">
              <div className="absolute left-0 top-0 w-[62%] -rotate-2 border border-[var(--hair)] bg-white p-4">
                <div className="font-mono text-[10px] text-[var(--mute)]">{featuredCase.creator} · {featuredCase.source}</div>
                <p className="mt-2 text-sm leading-6">{featuredCase.summary}</p>
              </div>
              <div className="absolute right-0 top-8 h-52 w-[34%] rotate-2">
                <MediaTile item={featuredCase} className="h-full" />
              </div>
              <div className="absolute left-[8%] top-[48%] w-[70%] rotate-1 border border-[var(--hair)] bg-white p-4 font-mono text-[11px] leading-6">
                <span className="text-[var(--mute)]">PROMPT FRAGMENT</span>
                <br />
                {featuredCase.promptPreview.slice(0, 120)}...
              </div>
              <div className="absolute bottom-6 right-3 w-[48%] -rotate-2 border border-[var(--hair)] bg-white p-3 font-mono text-[10px] text-[var(--mute)]">
                #AIcase #prompt #model #workflow #creator
              </div>
            </div>
          </article>
          <div className="hidden items-center justify-center lg:flex">
            <span className="font-mono text-3xl text-[var(--orange)]">→</span>
          </div>
          <article className="min-h-[520px] border border-[var(--hair)] bg-white p-7">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mute)]">
              <span>B · 结构化案例页</span>
              <span className="text-[var(--orange)]">GoodCase.ai</span>
            </div>
            <div className="mt-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.03em]">{featuredCase.title}</h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--mute)]">
                    {categoryLabels[featuredCase.category]} · {featuredCase.source}
                  </p>
                </div>
                <span className="bg-[var(--orange)] px-2 py-1 font-mono text-[10px] text-white">
                  #{spreadLeaderboard.findIndex((item) => item.slug === featuredCase.slug) + 1 || 1} Signal
                </span>
              </div>
              {[
                ["SOURCE", `${featuredCase.source} · ${featuredCase.creator}`],
                ["PROMPT", `${featuredCase.promptPreview.length} chars · normalized preview`],
                ["MODEL STACK", featuredCase.recommendedModels.join(" · ")],
                ["CREATOR", `${featuredCase.creator} · pattern owner`],
              ].map(([key, value]) => (
                <div key={key} className="grid grid-cols-[116px_1fr] gap-4 border-b border-dashed border-[var(--concrete)] py-4 font-mono text-[11px]">
                  <span className="text-[var(--mute)]">{key}</span>
                  <span>{value}</span>
                </div>
              ))}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <MiniMetric label="Spread" value={featuredCase.spreadScore} />
                <MiniMetric label="Stability" value={featuredCase.stabilityScore} />
                <MiniMetric label="Cost" value={costLabels[featuredCase.costBand]} />
              </div>
              <div className="mt-6 border border-[var(--hair)] p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">Promoted skill seed</div>
                <div className="mt-2 text-base font-semibold">{featuredCase.title} 方法包 · Beta</div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="gc-section pb-6">
        <div className="grid gap-6 border border-[var(--hair)] bg-[var(--ink)] p-8 text-[var(--paper)] md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--orange)]">GoodCase.ai Beta</p>
            <h2 className="mt-5 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.045em] md:text-7xl">
              不只收藏案例，顺着创作者找到方法。
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/cases" className="gc-btn border-white text-white hover:bg-white hover:text-[var(--ink)]">
              进入案例库
            </Link>
            <Link href="/creators" className="gc-btn bg-[var(--orange)] text-white hover:bg-white hover:text-[var(--ink)]">
              浏览创作者
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
