import Link from "next/link";
import Image from "next/image";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { getHomeData } from "@/lib/cases";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { featuredCase, favoriteLeaderboard, stabilityLeaderboard } =
    await getHomeData();

  return (
    <SiteShell footerNote="登录、点赞、榜单和案例详情已联动，选择方向后可直接进入验证。">
      <section className="grid items-end gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="grid gap-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Case-backed model selection
          </p>
          <h1 className="max-w-[11ch] font-[family-name:var(--font-display)] text-6xl leading-[0.92] tracking-[-0.045em] md:text-[7rem]">
            先看真实 Case，
            <span className="block text-[var(--accent)]">再决定用哪个模型。</span>
          </h1>
          <p className="max-w-3xl text-base leading-8 text-[var(--muted)]">
            在这里你可以先看真实案例，再按喜爱度和稳定度快速判断模型；登录后点赞即可解锁完整 Prompt，直接拿去复用与二次创作。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/cases"
              className="inline-flex min-h-12 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-semibold !text-[var(--bg-strong)] transition hover:-translate-y-0.5"
            >
              浏览案例库
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-full border border-[var(--line)] bg-white/50 px-5 text-sm font-semibold transition hover:-translate-y-0.5"
            >
              登录并解锁 Prompt
            </Link>
          </div>
        </article>

        <article className="grid gap-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[#d9ccbb] shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
            {featuredCase.mediaType === "video" ? (
              <video
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                poster={featuredCase.posterUrl}
                className="h-full w-full object-cover"
              >
                <source src={featuredCase.mediaUrl} type="video/mp4" />
              </video>
            ) : (
              <Image
                src={featuredCase.mediaUrl}
                alt={featuredCase.title}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 text-sm text-[var(--bg-strong)]">
              <span>热门视频案例</span>
              <strong>先看真实效果，再决定模型与 Prompt。</strong>
            </div>
          </div>
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              核心路径
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em]">
              看案例，点点赞，解锁 Prompt，再做跨模型判断。
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              先用真实内容验证方向，再用榜单结果降低选型成本。
            </p>
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            AI 喜爱榜（Top 10）
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">点击标题进入详情，点赞后可解锁完整 Prompt。</p>
          <div className="mt-4 grid gap-4 md:max-h-[900px] md:overflow-auto md:pr-1">
            {favoriteLeaderboard.map((item, index) => (
              <div
                key={item.slug}
                className="flex items-start justify-between gap-4 border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"
              >
                <div>
                  <div className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                    #{index + 1}
                  </div>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em]">
                    <Link href={`/cases/${item.slug}`} className="transition hover:opacity-80">
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    喜爱分 {item.favoriteScore} · 点赞 {item.likedCount}
                  </p>
                </div>
                <LikeButton caseSlug={item.slug} initialCount={item.likedCount} />
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            AI 稳定榜（Top 10）
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">点击标题可直达模型效果区，快速看不同模型推荐。</p>
          <div className="mt-4 grid gap-4 md:max-h-[900px] md:overflow-auto md:pr-1">
            {stabilityLeaderboard.map((item, index) => (
              <div
                key={item.slug}
                className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"
              >
                <div className="rounded-full bg-[rgba(35,100,170,0.12)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-2)]">
                  #{index + 1}
                </div>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em]">
                  <Link href={`/cases/${item.slug}#model-effects`} className="transition hover:opacity-80">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  稳定分 {item.stabilityScore} · 推荐模型 {item.recommendedModels.join(" / ")}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            使用方式
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em]">
            三步看懂榜单并拿到可复用 Prompt。
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
            <li className="rounded-[18px] border border-[var(--line)] bg-white/50 px-4 py-3">
              先看喜爱榜：挑你关心的案例点进详情。
            </li>
            <li className="rounded-[18px] border border-[var(--line)] bg-white/50 px-4 py-3">
              登录并点赞后，可解锁完整 Prompt 与约束条件。
            </li>
            <li className="rounded-[18px] border border-[var(--line)] bg-white/50 px-4 py-3">
              再看稳定榜：对比推荐模型，快速决定用哪个模型开跑。
            </li>
            <li className="rounded-[18px] border border-[var(--line)] bg-white/50 px-4 py-3">
              在案例库按 AI 视频 / AI 编程(UI) / AI 图像筛选，直接进入目标方向。
            </li>
          </ul>
        </article>

        <article className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">联系我们</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em]">
            有好案例想上榜？来聊聊。
          </h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
            <p className="rounded-[16px] border border-[var(--line)] bg-white/50 px-4 py-3">
              邮箱：learnprompt2023@gmail.com
            </p>
            <p className="rounded-[16px] border border-[var(--line)] bg-white/50 px-4 py-3">
              X：https://x.com/aiwarts
            </p>
          </div>
        </article>
      </section>
    </SiteShell>
  );
}
