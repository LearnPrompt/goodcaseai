import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getCreatorListData } from "@/lib/cases";
import { getServerAuthUser } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const user = await getServerAuthUser();
  const creators = await getCreatorListData(user?.id);

  return (
    <SiteShell footerNote="创作者页承接首页 creator-first 入口，并把代表案例继续导向详情与点赞解锁主链路。">
      <section className="grid gap-4 sm:gap-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Creator directory
        </p>
        <h1 className="max-w-[12ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-7xl">
          先看值得跟的 creator，再选代表案例切进去。
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
          这里把现有案例重新装配成 creator 视图。你可以先判断谁值得长期跟，再进入他的代表作，看 Prompt、模型选择和可复用方法。
        </p>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {creators.map((creator) => (
          <article
            key={creator.slug}
            className="flex h-full flex-col rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                {creator.highlightedLabel}
              </span>
              {creator.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
              {creator.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{creator.bio}</p>

            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              <span>覆盖来源：{creator.sourceFootprint.join(" / ")}</span>
              <span>点赞 {creator.totalLikes} · 复刻 {creator.totalRemakes}</span>
              <span>喜爱均分 {creator.averageFavoriteScore} · 稳定均分 {creator.averageStabilityScore}</span>
            </div>

            <div className="mt-5 rounded-[18px] border border-[var(--line)] bg-white/50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                代表案例
              </p>
              <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{creator.heroCase.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{creator.heroCase.summary}</p>
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              <Link
                href={`/creators/${creator.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                查看 creator
              </Link>
              <Link
                href={`/cases/${creator.heroCase.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/50 px-4 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                查看代表案例
              </Link>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
