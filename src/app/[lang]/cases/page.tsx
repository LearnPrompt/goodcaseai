import type { Metadata } from "next";
import { CaseCard } from "@/components/case-card";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { SearchBox } from "@/components/search-box";
import { CASES_PAGE_SIZE, Pagination } from "@/components/pagination";
import { LocalizedLink as Link } from "@/components/localized-link";
import { localizeHref } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import {
  filterCasesByQuery,
  getCaseListData,
  type CaseFilter,
  type DisplayCaseItem,
} from "@/lib/cases";
import { filterCasesByModel, getModelFamily, getModelLabel } from "@/lib/models";
import { deriveSkillCatalog, getCaseSkillLinks } from "@/lib/skills";
import { hasMeasuredStability } from "@/lib/stability";

export const revalidate = 300;

type PageParams = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  return {
    title: isEnglish ? "Case Library" : "案例库",
    description: isEnglish
      ? "Browse AI cases with finished work, creators, methods, original sources, and reproduction evidence."
      : "浏览有作品、作者、方法、原始来源与复测证据的 AI Case。",
    alternates: {
      canonical: localizeHref(locale, "/cases"),
      languages: {
        "zh-CN": "/cases",
        en: "/en/cases",
        "x-default": "/cases",
      },
    },
  };
}

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

type SortOption = "heat" | "stability" | "latest";

/** 默认排序，默认值不写进 URL，避免同一内容出现两个 URL。 */
const DEFAULT_SORT: SortOption = "heat";

function normalizeSort(value?: string): SortOption {
  return value === "stability" || value === "latest" ? value : DEFAULT_SORT;
}

/**
 * 稳定度排序时，没有实测分（占位分，hasMeasuredStability 判定为 false）的案例
 * 统一排到最后，避免这些占位分挤占靠前的位置。
 */
function sortCaseItems(
  list: DisplayCaseItem[],
  sort: SortOption
): DisplayCaseItem[] {
  const sorted = [...list];

  if (sort === "stability") {
    sorted.sort((a, b) => {
      const aMeasured = hasMeasuredStability(a.stabilityScore);
      const bMeasured = hasMeasuredStability(b.stabilityScore);
      if (aMeasured !== bMeasured) {
        return aMeasured ? -1 : 1;
      }
      if (!aMeasured) {
        return 0;
      }
      return b.stabilityScore - a.stabilityScore;
    });
    return sorted;
  }

  if (sort === "latest") {
    sorted.sort((a, b) => {
      const aTime = a.sourcePublishedAt
        ? new Date(a.sourcePublishedAt).getTime()
        : NaN;
      const bTime = b.sourcePublishedAt
        ? new Date(b.sourcePublishedAt).getTime()
        : NaN;
      const aValid = Number.isFinite(aTime);
      const bValid = Number.isFinite(bTime);
      if (aValid !== bValid) {
        return aValid ? -1 : 1;
      }
      if (!aValid) {
        return 0;
      }
      return bTime - aTime;
    });
    return sorted;
  }

  // 默认按来源热度降序；没有热度快照（null）的排到最后。
  sorted.sort((a, b) => {
    if (a.sourceHeatScore === null && b.sourceHeatScore === null) return 0;
    if (a.sourceHeatScore === null) return 1;
    if (b.sourceHeatScore === null) return -1;
    return b.sourceHeatScore - a.sourceHeatScore;
  });
  return sorted;
}

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<{
    filter?: string;
    q?: string;
    model?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const isEnglish = locale === "en";
  const filterOptions: Array<{ value: CaseFilter; label: string }> = [
    { value: "all", label: messages.category.all },
    { value: "video", label: messages.category.video },
    { value: "web", label: messages.category.web },
    { value: "image", label: messages.category.image },
    { value: "copy", label: messages.category.copy },
    { value: "hardware", label: messages.category.hardware },
  ];
  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: "heat", label: messages.sort.heat },
    { value: "stability", label: messages.sort.stability },
    { value: "latest", label: messages.sort.latest },
  ];
  const queryParams = await searchParams;
  const activeFilter = normalizeFilter(queryParams.filter);
  const query = queryParams.q?.trim() || "";
  const activeModel = getModelFamily(queryParams.model);
  const activeSort = normalizeSort(queryParams.sort);
  const filteredCases = await getCaseListData(activeFilter, locale);
  const skillCatalog = deriveSkillCatalog(filteredCases, locale);
  const caseItems = sortCaseItems(
    filterCasesByModel(filterCasesByQuery(filteredCases, query), activeModel?.slug),
    activeSort
  );
  const clearModelQuery = [
    activeFilter === "all" ? "" : `filter=${activeFilter}`,
    query ? `q=${encodeURIComponent(query)}` : "",
    activeSort === DEFAULT_SORT ? "" : `sort=${activeSort}`,
  ]
    .filter(Boolean)
    .join("&");
  const clearModelHref = clearModelQuery ? `/cases?${clearModelQuery}` : "/cases";

  const totalCount = caseItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CASES_PAGE_SIZE));
  const requestedPage = Number.parseInt(queryParams.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;
  const pagedItems = caseItems.slice(
    (currentPage - 1) * CASES_PAGE_SIZE,
    currentPage * CASES_PAGE_SIZE
  );

  /** 翻页时保留筛选、搜索、模型和排序条件；第一页不带 page 参数，默认排序不带 sort 参数，避免同一内容多个 URL。 */
  const buildPageHref = (page: number) => {
    const parts = [
      activeFilter === "all" ? "" : `filter=${activeFilter}`,
      query ? `q=${encodeURIComponent(query)}` : "",
      activeModel ? `model=${activeModel.slug}` : "",
      activeSort === DEFAULT_SORT ? "" : `sort=${activeSort}`,
      page > 1 ? `page=${page}` : "",
    ].filter(Boolean);
    return parts.length ? `/cases?${parts.join("&")}` : "/cases";
  };

  /** 切换排序时保留筛选、搜索和模型条件，并重置回第一页（不带 page 参数）。 */
  const buildSortHref = (sort: SortOption) => {
    const parts = [
      activeFilter === "all" ? "" : `filter=${activeFilter}`,
      query ? `q=${encodeURIComponent(query)}` : "",
      activeModel ? `model=${activeModel.slug}` : "",
      sort === DEFAULT_SORT ? "" : `sort=${sort}`,
    ].filter(Boolean);
    return parts.length ? `/cases?${parts.join("&")}` : "/cases";
  };

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Discovery, rankings, and creator relationships all resolve to one Case source of truth."
          : "所有发现、榜单与创作者关系都回到 Case，不再拆成独立产品。"
      }
    >
      <PageHero
        eyebrow={
          isEnglish
            ? "Case library · Public evidence"
            : "案例库 · 公开证据"
        }
        title={
          isEnglish
            ? "Start with the work. Trace it back to the maker and method."
            : "从作品结果，回到作者与方法。"
        }
        description={
          isEnglish
            ? "No news summaries—only cases that point to finished work, creators, process, and original sources. Rankings, favorites, creator pages, and retests all grow from the same case."
            : "这里不收资讯摘要，只收能指向作品、作者、过程和原始来源的 Case。榜单、收藏、作者页与复测记录都从同一条 Case 继续生长。"
        }
      >
        <div>
          <div className="gc-stat-label">
            {isEnglish ? "Current view" : "当前结果"}
          </div>
          <div className="gc-stat-value">{totalCount}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish
              ? `Cases · page ${currentPage}/${totalPages}`
              : `案例 · 第 ${currentPage}/${totalPages} 页`}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Filter" : "筛选"}</div>
          <div className="gc-stat-value">
            {filterOptions.find((item) => item.value === activeFilter)?.label}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish ? "Selected" : "已选择"}
          </div>
        </div>
      </PageHero>

      <section className="grid gap-4 border-b border-[var(--hair)] py-6">
        <SearchBox defaultQuery={query} filter={activeFilter} />

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const isActive = option.value === activeFilter;
            const searchSuffix = query ? `q=${encodeURIComponent(query)}` : "";
            const filterParam = option.value === "all" ? "" : `filter=${option.value}`;
            const modelParam = activeModel ? `model=${activeModel.slug}` : "";
            const sortParam = activeSort === DEFAULT_SORT ? "" : `sort=${activeSort}`;
            const queryString = [filterParam, searchSuffix, modelParam, sortParam]
              .filter(Boolean)
              .join("&");
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="gc-eyebrow">{messages.sort.label}</span>
          {sortOptions.map((option) => {
            const isActive = option.value === activeSort;
            return (
              <Link
                key={option.value}
                href={buildSortHref(option.value)}
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

        {activeModel ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="gc-eyebrow">{messages.model.browseTitle}</span>
            <Link
              href={clearModelHref}
              className="gc-action border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
            >
              {getModelLabel(activeModel, locale)} ×
            </Link>
            <Link href={`/models/${activeModel.slug}`} className="gc-action">
              {isEnglish
                ? `${getModelLabel(activeModel, locale)} page`
                : `${getModelLabel(activeModel, locale)} 模型页`}{" "}
              →
            </Link>
          </div>
        ) : null}
      </section>

      {totalCount === 0 ? (
        <section className="gc-empty-state mt-7">
          <p className="text-lg font-semibold text-[var(--ink)]">
            {isEnglish
              ? `No cases found${query ? ` for “${query}”` : ""}.`
              : `没有找到${query ? `与「${query}」相关的` : ""}案例。`}
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            {isEnglish
              ? "Try another search, or submit a strong case you have seen."
              : "换个关键词试试，或者去提交你见过的好案例。"}
          </p>
          <div>
            <Link
              href="/submit"
              className="gc-action gc-action-primary"
            >
              {isEnglish ? "Submit a case" : "提交好案例"}
            </Link>
          </div>
        </section>
      ) : (
      <>
      <section className="grid gap-0 border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
        {pagedItems.map((item) => (
          <CaseCard
            key={item.slug}
            variant="gallery"
            item={{
              ...item,
              skills: getCaseSkillLinks(skillCatalog, item.slug),
            }}
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

      <Pagination
        currentPage={currentPage}
        totalItems={totalCount}
        buildHref={buildPageHref}
        locale={locale}
      />
      </>
      )}
    </SiteShell>
  );
}
