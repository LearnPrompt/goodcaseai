import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { getCaseListData, type CaseFilter } from "@/lib/cases";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "案例库",
  description:
    "浏览正在传播的 AI 案例：AI 图像、AI 视频、AI 编程(UI) 与 AI 文案，点赞解锁完整 Prompt 与推荐模型。",
  alternates: {
    canonical: "/cases",
  },
};

const FILTER_OPTIONS: Array<{ value: CaseFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "video", label: "AI 视频" },
  { value: "web", label: "AI 编程(UI)" },
  { value: "image", label: "AI 图像" },
];

function normalizeFilter(value?: string): CaseFilter {
  return value === "video" || value === "web" || value === "image" || value === "all"
    ? value
    : "all";
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = normalizeFilter(params.filter);
  const caseItems = await getCaseListData(activeFilter);

  return (
    <SiteShell footerNote="案例库是当前内容中台，点赞解锁、Prompt 复制和榜单都从这里生长出来。">
      <section className="mb-7 grid gap-4 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Case library
        </p>
        <h1 className="max-w-[13ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-7xl">
          案例先吸引人，再让 Prompt 和榜单留下人。
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
          第一版先聚焦图像、视频、网页和文案四类内容。真正的后端接上之后，这里会承接点赞、收藏、Prompt
          解锁和稳定榜复测结果。
        </p>
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const isActive = option.value === activeFilter;
          const href = option.value === "all" ? "/cases" : `/cases?filter=${option.value}`;

          return (
            <Link
              key={option.value}
              href={href}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isActive
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg-strong)]"
                  : "border-[var(--line)] bg-white/60 text-[var(--ink)]"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </section>

      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {caseItems.map((item) => (
          <article
            key={item.slug}
            className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_20px_60px_rgba(43,28,18,0.12)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e1d5]">
              {item.mediaType === "image" ? (
                <Image
                  src={item.mediaUrl}
                  alt={item.title}
                  fill
                  sizes="(min-width: 1536px) 31vw, (min-width: 768px) 48vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <video
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                  poster={item.posterUrl}
                  className="h-full w-full object-cover"
                >
                  <source src={item.mediaUrl} type="video/mp4" />
                </video>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {item.category}
                </span>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs">{item.source}</span>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs">
                  稳定 {item.stabilityScore}
                </span>
                <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                  {item.favoriteScore >= item.stabilityScore ? "编辑精选" : "值得学习"}
                </span>
              </div>

              <div className="space-y-3">
                <h2 className="font-[family-name:var(--font-display)] text-3xl leading-[0.96] tracking-[-0.04em] sm:text-4xl">
                  {item.title}
                </h2>
                <p className="text-sm leading-7 text-[var(--muted)]">{item.summary}</p>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                <LikeButton
                  caseSlug={item.slug}
                  initialCount={item.likedCount}
                />
                <Link
                  href={`/cases/${item.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] px-4 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  查看详情
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
