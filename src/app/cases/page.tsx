import type { Metadata } from "next";
import Link from "next/link";
import { CaseCard } from "@/components/case-card";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { SearchBox } from "@/components/search-box";
import { filterCasesByQuery, getCaseListData, type CaseFilter } from "@/lib/cases";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "案例库",
  description:
    "浏览有作品、作者、方法、原始来源与复测证据的 AI Case。",
  alternates: {
    canonical: "/cases",
  },
};

const FILTER_OPTIONS: Array<{ value: CaseFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "video", label: "AI 视频" },
  { value: "web", label: "AI 编程(UI)" },
  { value: "image", label: "AI 图像" },
  { value: "copy", label: "AI 文案" },
  { value: "hardware", label: "AI 硬件" },
];

function normalizeFilter(value?: string): CaseFilter {
  return value === "video" ||
    value === "web" ||
    value === "image" ||
    value === "copy" ||
    value === "hardware" ||
    value === "all"
    ? value
    : "all";
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = normalizeFilter(params.filter);
  const query = params.q?.trim() || "";
  const caseItems = filterCasesByQuery(await getCaseListData(activeFilter), query);

  return (
    <SiteShell footerNote="所有发现、榜单与创作者关系都回到 Case，不再拆成独立产品。">
      <PageHero
        eyebrow="Case library · 公开证据库"
        title="从作品结果，回到作者与方法。"
        description="这里不收资讯摘要，只收能指向作品、作者、过程和原始来源的 Case。榜单、收藏、作者页与复测记录都从同一条 Case 继续生长。"
      >
        <div>
          <div className="gc-stat-label">Current view</div>
          <div className="gc-stat-value">{caseItems.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">Cases</div>
        </div>
        <div>
          <div className="gc-stat-label">Filter</div>
          <div className="gc-stat-value">{FILTER_OPTIONS.find((item) => item.value === activeFilter)?.label}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">Selected</div>
        </div>
      </PageHero>

      <section className="grid gap-4 border-b border-[var(--hair)] py-6">
        <SearchBox defaultQuery={query} filter={activeFilter} />

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = option.value === activeFilter;
            const searchSuffix = query ? `q=${encodeURIComponent(query)}` : "";
            const filterParam = option.value === "all" ? "" : `filter=${option.value}`;
            const queryString = [filterParam, searchSuffix].filter(Boolean).join("&");
            const href = queryString ? `/cases?${queryString}` : "/cases";

            return (
              <Link
                key={option.value}
                href={href}
                className={`gc-action ${
                  isActive
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : ""
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </section>

      {caseItems.length === 0 ? (
        <section className="gc-empty-state mt-7">
          <p className="text-lg font-semibold text-[var(--ink)]">
            没有找到{query ? `与「${query}」相关的` : ""}案例。
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            换个关键词试试，或者去提交你见过的好案例。
          </p>
          <div>
            <Link
              href="/submit"
              className="gc-action gc-action-primary"
            >
              提交好案例
            </Link>
          </div>
        </section>
      ) : (
      <section className="grid gap-0 border-l border-t border-[var(--hair)] md:grid-cols-2 2xl:grid-cols-3">
        {caseItems.map((item) => (
          <CaseCard
            key={item.slug}
            item={item}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                  <LikeButton
                    caseSlug={item.slug}
                    initialCount={item.likedCount}
                  />
                  <FavoriteButton caseSlug={item.slug} />
                </div>
            }
          />
        ))}
      </section>
      )}
    </SiteShell>
  );
}
