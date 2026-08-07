import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { SearchBox } from "@/components/search-box";
import { LocalizedLink as Link } from "@/components/localized-link";
import { localizeHref, SUPPORTED_LOCALES } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import { getSkillCatalogData } from "@/lib/cases";
import { filterSkillsByQuery } from "@/lib/skills";
import type { CaseCategory } from "@/lib/mock-data";
import {
  getInstallableSkillPackages,
  getSkillDownloadPath,
} from "@/lib/installable-skills";

/** 与 /cases 的 CaseFilter 同构，多一个 "all"，用于分类筛选按钮。 */
type SkillCategoryFilter = CaseCategory | "all";

function normalizeCategory(value?: string): SkillCategoryFilter {
  return value === "video" ||
    value === "web" ||
    value === "image" ||
    value === "copy" ||
    value === "hardware"
    ? value
    : "all";
}

// 内容只在运营发布时变，发布会触发部署重新生成；这里当兜底，一小时一次足够。
export const revalidate = 3_600;

// [lang] 是动态段，不加 generateStaticParams 的话上面的 revalidate 完全不起作用——
// 每次请求都会打 Supabase。只有两种语言，直接枚举。
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  return {
    title: isEnglish ? "Installable Agent Skills" : "可安装 Agent Skills",
    description: isEnglish
      ? "Install evidence-derived Agent Skills built from published GoodCase examples."
      : "把已发布 GoodCase 证据沉淀为经过校验、可真正安装的 Agent Skills。",
    alternates: {
      canonical: localizeHref(locale, "/skills"),
      languages: {
        "zh-CN": "/skills",
        en: "/en/skills",
        "x-default": "/skills",
      },
    },
  };
}

export default async function SkillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  const messages = getMessages(locale);
  const catalog = await getSkillCatalogData(locale);
  const installable = new Set(
    getInstallableSkillPackages().map((item) => item.slug)
  );
  const sharedSkills = catalog.sharedSkills.filter((item) =>
    installable.has(item.slug)
  );
  const creatorMethods = catalog.creatorMethods.filter((item) =>
    installable.has(item.slug)
  );
  const allSkills = [...sharedSkills, ...creatorMethods];
  const evidenceCount = new Set(
    allSkills.flatMap((skill) => skill.cases.map((item) => item.slug))
  ).size;

  // 分类筛选 + 搜索都走 URL 查询参数，服务端过滤，两者可叠加。
  const queryParams = await searchParams;
  const activeCategory = normalizeCategory(queryParams.category);
  const query = queryParams.q?.trim() || "";
  const categoryOptions: Array<{ value: SkillCategoryFilter; label: string }> = [
    { value: "all", label: messages.category.all },
    { value: "video", label: messages.category.video },
    { value: "web", label: messages.category.web },
    { value: "image", label: messages.category.image },
    { value: "copy", label: messages.category.copy },
    { value: "hardware", label: messages.category.hardware },
  ];
  const byCategory = <T extends { category: CaseCategory }>(skill: T) =>
    activeCategory === "all" || skill.category === activeCategory;
  const visibleSharedSkills = filterSkillsByQuery(
    sharedSkills.filter(byCategory),
    query
  );
  const visibleCreatorMethods = filterSkillsByQuery(
    creatorMethods.filter(byCategory),
    query
  );
  const hasResults = visibleSharedSkills.length + visibleCreatorMethods.length > 0;

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Only validated, packaged, and installable Skills appear here."
          : "这里只展示已校验、已打包、可真实安装的 Skill。"
      }
    >
      <PageHero
        eyebrow="Agent Skills · Verified packages"
        title={isEnglish ? "Install methods, not just prompts." : "不只看方法，把它装进 Agent。"}
        description={
          isEnglish
            ? "Each Skill is derived from published Case evidence, packaged as a standard SKILL.md bundle, and tested against the same installation path used by LearnPrompt."
            : "每个 Skill 都来自已发布 Case 证据，按标准 SKILL.md 打包，并走 LearnPrompt 同款安装链路验收。"
        }
      >
        <div>
          <div className="gc-stat-label">{isEnglish ? "Installable" : "可安装"}</div>
          <div className="gc-stat-value">{allSkills.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            .skill packages
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Shared" : "通用 Skill"}</div>
          <div className="gc-stat-value">{sharedSkills.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            2+ creators
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Creator" : "作者 Skill"}</div>
          <div className="gc-stat-value">{creatorMethods.length}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish ? "Unofficial synthesis" : "非官方归纳"}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Evidence" : "证据 Case"}</div>
          <div className="gc-stat-value">{evidenceCount}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            Published only
          </div>
        </div>
      </PageHero>

      <section className="grid gap-4 border-b border-[var(--hair)] py-6">
        <SearchBox
          defaultQuery={query}
          filter={activeCategory}
          action={localizeHref(locale, "/skills")}
          hiddenParamName="category"
          placeholder={messages.search.skillsPlaceholder}
          ariaLabel={messages.search.skillsAriaLabel}
          analyticsEvent="skill_search"
        />

        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => {
            const isActive = option.value === activeCategory;
            const categoryParam =
              option.value === "all" ? "" : `category=${option.value}`;
            const searchParam = query ? `q=${encodeURIComponent(query)}` : "";
            const queryString = [categoryParam, searchParam]
              .filter(Boolean)
              .join("&");
            const href = queryString ? `/skills?${queryString}` : "/skills";

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

      {hasResults ? (
        <>
          <SkillSection
            title={isEnglish ? "Shared Skills" : "跨作者通用 Skills"}
            description={
              isEnglish
                ? "Patterns repeated across at least three published Cases and two creators."
                : "至少 3 个已发布 Case、2 位创作者重复出现的可复用方法。"
            }
            skills={visibleSharedSkills}
            isEnglish={isEnglish}
            categoryLabels={messages.category}
            latestExampleLabel={messages.common.latestExample}
          />

          {visibleCreatorMethods.length ? (
            <SkillSection
              title={isEnglish ? "Creator methods" : "作者方法 Skills"}
              description={
                isEnglish
                  ? "Unofficial workflows derived from at least three published Cases by the same creator. Attribution stays attached."
                  : "同一作者至少 3 个已发布 Case 中归纳的非官方工作流，安装后仍保留作者与证据署名。"
              }
              skills={visibleCreatorMethods}
              isEnglish={isEnglish}
              categoryLabels={messages.category}
              latestExampleLabel={messages.common.latestExample}
            />
          ) : null}
        </>
      ) : (
        <section className="gc-empty-state mt-7">
          <p className="text-lg font-semibold text-[var(--ink)]">
            {isEnglish
              ? `No Skills found${query ? ` for “${query}”` : ""}.`
              : `没有找到${query ? `与「${query}」相关的` : ""} Skill。`}
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            {isEnglish
              ? "Try another keyword or category."
              : "换个关键词或分类试试。"}
          </p>
        </section>
      )}
    </SiteShell>
  );
}

function SkillSection({
  title,
  description,
  skills,
  isEnglish,
  categoryLabels,
  latestExampleLabel,
}: {
  title: string;
  description: string;
  skills: Awaited<ReturnType<typeof getSkillCatalogData>>["allSkills"];
  isEnglish: boolean;
  categoryLabels: ReturnType<typeof getMessages>["category"];
  latestExampleLabel: string;
}) {
  return (
    <section className="gc-section">
      <div className="gc-section-head">
        <p className="gc-section-id">Installable</p>
        <div>
          <h2 className="gc-section-title">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {description}
          </p>
        </div>
      </div>
      <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <article
            key={skill.slug}
            className="flex min-h-80 flex-col border-b border-r border-[var(--hair)] bg-white p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <span>{categoryLabels[skill.category]}</span>
              <span className="text-[var(--orange)]">
                {isEnglish ? "Verified package" : "已验证包"}
              </span>
            </div>
            <h3 className="mt-7 text-2xl font-medium leading-tight tracking-[-0.03em]">
              <Link href={`/skills/${skill.slug}`} className="hover:text-[var(--orange)]">
                {skill.title}
              </Link>
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {skill.description}
            </p>
            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
              <span className="font-mono text-[10px] uppercase text-[var(--muted)]">
                {skill.caseCount} Cases · {skill.creatorCount}{" "}
                {isEnglish ? "Creators" : "位作者"}
                {skill.latestExampleDate
                  ? ` · ${latestExampleLabel} ${skill.latestExampleDate}`
                  : ""}
              </span>
              <div className="flex gap-2">
                <a className="gc-action" href={getSkillDownloadPath(skill.slug)} download>
                  .skill ↓
                </a>
                <Link className="gc-action gc-action-primary" href={`/skills/${skill.slug}`}>
                  {isEnglish ? "Open" : "查看"} →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
