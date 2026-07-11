import Image from "next/image";
import Link from "next/link";
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

const sources = ["X / 𝕏", "小红书", "Bilibili", "GitHub", "Discord", "Newsletter"];
const intakeStates = ["● 新入库", "已索引", "已去重", "进榜候选", "已索引", "已索引"];
const intakeTimes = ["04:12:07", "04:11:44", "04:10:19", "04:08:52", "04:07:31", "04:06:02"];

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

function LabMetric({
  label,
  value,
  bar,
  muted,
}: {
  label: string;
  value: string | number;
  bar?: number;
  muted?: string;
}) {
  return (
    <div className="border border-[var(--concrete)] bg-white p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--mute)]">{label}</div>
      <div className="mt-2 break-words text-xl font-semibold tracking-normal text-[var(--ink)] sm:text-2xl">{value}</div>
      {typeof bar === "number" ? (
        <div className="mt-3 h-1 bg-[var(--concrete)]">
          <div className="h-full bg-[var(--orange)]" style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      ) : null}
      {muted ? <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--mute)]">{muted}</div> : null}
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
      <div className="-mx-4 -mt-7 border-b border-[var(--hair)] bg-[var(--paper)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)] md:-mx-6 md:-mt-8 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[var(--orange)]">
            <span className="size-1.5 animate-pulse bg-[var(--orange)]" />
            实时 · 发现
          </span>
          <span>Cases {totalCaseCount}</span>
          <span>Creators {totalCreatorCount}</span>
          <span>Beta 实验信号在线</span>
          <span className="ml-auto hidden md:inline">v0.14 · creator-first case network</span>
        </div>
      </div>

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
          <div className="pointer-events-none absolute -top-9 left-[24%] hidden font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--mute)] lg:block">
            A · 喜爱榜
            <span className="mx-auto mt-1 block h-6 w-px bg-[var(--concrete-2)]" />
          </div>
          <div className="pointer-events-none absolute right-4 top-[54%] z-10 hidden border-l border-[var(--concrete-2)] bg-white/85 py-1 pl-3 text-right font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--mute)] shadow-[0_8px_24px_-20px_rgba(10,10,10,0.6)] backdrop-blur-sm xl:block">
            B · 稳定实验室
            <br />
            cross-model · {featuredCase.stabilityScore}% / {costLabels[featuredCase.costBand]}
          </div>
          <div className="pointer-events-none absolute -bottom-8 right-[14%] hidden text-right font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--mute)] lg:block">
            <span className="mx-auto mb-1 block h-6 w-px bg-[var(--concrete-2)]" />
            C · 创作者 + Skill ◇
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--hair)] bg-[var(--paper-2)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
            <div className="flex shrink-0 gap-1.5">
              <span className="size-2.5 border border-[var(--hair)]" />
              <span className="size-2.5 border border-[var(--hair)]" />
              <span className="size-2.5 border border-[var(--hair)]" />
            </div>
            <span className="min-w-0 truncate px-2">goodcase.ai / discover / ai-video-15s</span>
            <span className="shrink-0 text-[var(--orange)]">实时</span>
          </div>

          <div className="grid gap-px bg-[var(--hair)] md:grid-cols-2">
            <div className="bg-white p-4 md:col-span-2">
              <div className="mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>正在传播 · 24h</span>
                <span className="text-[var(--orange)]">● 实时</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {heroThumbs.map((item, index) => (
                  <Link key={item.slug} href={`/cases/${item.slug}`} className="min-w-0">
                    <MediaTile item={item} rank={`#0${index + 1}`} className="aspect-[3/4]" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="min-w-0 bg-white p-4">
              <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>Love Ranking · 喜爱榜</span>
                <span>24h</span>
              </div>
              <div>
                {favoriteLeaderboard.slice(0, 4).map((item, index) => (
                  <Link
                    key={item.slug}
                    href={`/cases/${item.slug}`}
                    className="grid grid-cols-[26px_1fr_auto] gap-2 border-t border-[var(--concrete)] py-2 first:border-t-0"
                  >
                    <span className="font-mono text-xs text-[var(--mute)]">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="block font-mono text-[10px] text-[var(--mute)]">{item.creator}</span>
                    </span>
                    <span className="font-mono text-xs">
                      ♥ <b className="text-[var(--orange)]">{item.favoriteScore}</b>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="min-w-0 bg-white p-4">
              <div className="mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>稳定实验室 · Case</span>
                <span className="text-[var(--orange)]">Run complete</span>
              </div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--mute)]">
                Prompt hash · {featuredCase.slug.slice(0, 8)} · Beta
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LabMetric label="复现率" value={`${featuredCase.stabilityScore}%`} bar={featuredCase.stabilityScore} />
                <LabMetric label="一致性" value={`${Math.round((featuredCase.favoriteScore / 10) * 10) / 10}/10`} bar={featuredCase.favoriteScore} />
                <LabMetric label="成本" value={costLabels[featuredCase.costBand]} muted="每次复测档位" />
                <LabMetric label="模型" value={featuredCase.recommendedModels.slice(0, 2).join(" / ")} />
              </div>
            </div>

            <div className="bg-[var(--paper-2)] p-4 md:col-span-2">
              <div className="mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
                <span>创作者 · 主页与方法论</span>
                <span>Signal claimed ✓</span>
              </div>
              <div className="grid gap-4 md:grid-cols-[56px_1fr_auto] md:items-center">
                <div className="flex size-14 items-center justify-center border border-[var(--hair)] bg-white font-mono text-sm font-semibold">
                  {featuredCase.creator.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-semibold">{featuredCase.creator}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.07em] text-[var(--mute)]">
                    {featuredCase.source} · {categoryLabels[featuredCase.category]} · {featuredCase.remakeCount} remakes
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {featuredCase.recommendedModels.slice(0, 3).map((model) => (
                      <span key={model} className="border border-[var(--hair)] bg-white px-2 py-1 font-mono text-[10px]">
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
                <Link className="gc-btn gc-btn-ghost justify-center text-xs" href={`/cases/${featuredCase.slug}`}>
                  查看案例 ↗
                </Link>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 01 · 发现</div>
          <div>
            <h2 className="gc-section-title">正在被传播的案例，先进入结构化入口。</h2>
            <p className="gc-section-sub">
              这里不再像普通瀑布流展示内容，而是把来源、创作者、传播势能和可复现实验入口先摆出来。
            </p>
          </div>
        </div>
        <div className="border border-[var(--hair)] bg-white">
          <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--hair)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--mute)]">
            <span className="text-[var(--orange)]">● 实时入库</span>
            <span>Queue {spreadLeaderboard.length * 24}</span>
            <span>Beta 派生信号，不等于真实流量</span>
          </div>
          <div className="hidden grid-cols-[92px_104px_minmax(0,1fr)_168px_124px] border-b border-[var(--hair)] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--mute)] lg:grid">
            <span>时间</span>
            <span>来源</span>
            <span>条目</span>
            <span>创作者</span>
            <span>状态</span>
          </div>
          <div>
            {spreadLeaderboard.slice(0, 10).map((item, index) => (
              <Link
                key={item.slug}
                href={`/cases/${item.slug}`}
                className={`grid gap-3 border-b border-[var(--concrete)] px-5 py-4 transition last:border-b-0 hover:bg-[var(--paper-2)] lg:grid-cols-[92px_104px_minmax(0,1fr)_168px_124px] lg:items-center ${
                  index === 0 ? "bg-[rgba(255,87,51,0.045)]" : ""
                }`}
              >
                <span className="font-mono text-[11px] text-[var(--mute)]">{intakeTimes[index % intakeTimes.length]}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink)]">{sources[index % sources.length]}</span>
                <div>
                  <h3 className="font-semibold leading-tight tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-[var(--mute)]">
                    {categoryLabels[item.category]} · 传播势能 +{item.spreadScore} · {item.remakeCount} remakes
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[var(--mute)]">{item.creator}</span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${index === 0 ? "text-[var(--orange)]" : "text-[var(--ink)]"}`}>
                  {intakeStates[index % intakeStates.length]}
                </span>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--hair)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">
            <span>今日 · {spreadLeaderboard.length * 41} 已索引 · {spreadLeaderboard.length * 5} 已去重 · {spreadLeaderboard.length * 3} 进入榜单</span>
            <Link href="/cases" className="inline-flex min-h-11 items-center border-b border-[var(--ink)] text-[var(--ink)]">
              打开完整 feed ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 02 · 流程</div>
          <div>
            <h2 className="gc-section-title">Case, Creator, Lab, Skill：让爆款不只是刷过去。</h2>
            <p className="gc-section-sub">Claude v2 首页最强的是这条产品骨架，这里直接迁入当前首页叙事。</p>
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
          <div className="gc-section-id">§ 03 · 转换</div>
          <div>
            <h2 className="gc-section-title">从碎片化爆款，到可复用方法。</h2>
            <p className="gc-section-sub">这一块是 Claude 版最适合 GoodCase 的解释方式，直接把产品价值讲透。</p>
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

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 04 · 榜单</div>
          <div>
            <h2 className="gc-section-title">一个读人群偏好，一个读模型稳定性。</h2>
            <p className="gc-section-sub">把当前三张圆角榜单卡片收成更像真实产品的表格界面。</p>
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
            {favoriteLeaderboard.slice(0, 6).map((item, index) => (
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
            ))}
          </article>

          <article className="border border-t-0 border-[var(--hair)] bg-white lg:border-l-0">
            <div className="flex justify-between border-b border-[var(--hair)] px-5 py-4">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">
                <span className="mr-2 inline-block size-2 bg-[var(--orange)]" />
                Stability Lab · 稳定性实验
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--mute)]">Beta 实验</span>
            </div>
            {stabilityLeaderboard.slice(0, 6).map((item, index) => (
              <div key={item.slug} className="grid grid-cols-[30px_50px_minmax(0,1fr)_70px] items-center gap-3 border-b border-[var(--concrete)] px-5 py-4 last:border-b-0 md:grid-cols-[34px_56px_minmax(0,1fr)_112px_72px] md:gap-4">
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
            ))}
          </article>
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ 05 · 创作者</div>
          <div>
            <h2 className="gc-section-title">为持续交付的创作者设计，而不是为一次性爆款设计。</h2>
            <p className="gc-section-sub">当前数据仍由 cases 派生，但展示层先切到 creator-first 的产品语言。</p>
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
          <div className="gc-section-id">§ 06 · 方法包</div>
          <div>
            <h2 className="gc-section-title">当模式反复出现，就升级成 Skill。</h2>
            <p className="gc-section-sub">这里先作为 Beta 方法包种子区，后续接真实 Skill 生成门槛。</p>
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
