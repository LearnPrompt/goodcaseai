import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseCard } from "@/components/case-card";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { LocalizedLink as Link } from "@/components/localized-link";
import { SUPPORTED_LOCALES, localizeHref } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import {
  getSkillDetailData,
  getSkillSlugs,
} from "@/lib/cases";
import { slugifyCreatorName } from "@/lib/creator-slug";
import {
  getInstallableSkillPackage,
  getSkillDownloadPath,
  getSkillInstallCommand,
  getSkillSourceUrl,
} from "@/lib/installable-skills";
import { absoluteUrl } from "@/lib/site";

// 内容只在运营发布时变，发布会触发部署重新生成；这里当兜底，一小时一次足够。
export const revalidate = 3_600;

export async function generateStaticParams() {
  const slugs = await getSkillSlugs();
  return SUPPORTED_LOCALES.flatMap((lang) =>
    slugs.map((slug) => ({ lang, slug }))
  );
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
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const { slug } = await params;
  const skill = await getSkillDetailData(slug, locale);

  if (!skill) {
    notFound();
  }

  const description = truncateDescription(skill.description);
  return {
    title: `${skill.title} · Skill`,
    description,
    alternates: {
      canonical: localizeHref(locale, `/skills/${slug}`),
      languages: {
        "zh-CN": `/skills/${slug}`,
        en: `/en/skills/${slug}`,
        "x-default": `/skills/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      locale: locale === "en" ? "en_US" : "zh_CN",
      siteName: "GoodCase.ai",
      url: localizeHref(locale, `/skills/${slug}`),
      title: `${skill.title} · Skill`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${skill.title} · Skill`,
      description,
    },
  };
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const isEnglish = locale === "en";
  const { slug } = await params;
  const skill = await getSkillDetailData(slug, locale);

  if (!skill) {
    notFound();
  }

  const visibleCases = skill.cases.slice(0, 12);
  const visibleCreators = skill.creators.slice(0, 12);
  const installablePackage = getInstallableSkillPackage(skill.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: skill.title,
    description: skill.description,
    url: absoluteUrl(localizeHref(locale, `/skills/${skill.slug}`)),
    inLanguage: locale,
    isBasedOn: skill.cases.slice(0, 20).map((item) => ({
      "@type": "CreativeWork",
      name: item.title,
      url: absoluteUrl(localizeHref(locale, `/cases/${item.slug}`)),
    })),
  };

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "A Skill is a derived reading layer. Every claim must trace back to published Cases."
          : "Skill 是派生阅读层，所有判断都必须能回到已发布 Case。"
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHero
        eyebrow={
          skill.kind === "creator_method"
            ? isEnglish
              ? "Skill · Creator method"
              : "Skill · 作者方法"
            : isEnglish
              ? "Skill · Shared method"
              : "Skill · 跨作者通用方法"
        }
        title={skill.title}
        description={skill.description}
      >
        <div>
          <div className="gc-stat-label">{messages.common.cases}</div>
          <div className="gc-stat-value">{skill.caseCount}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish ? "Published evidence" : "已发布证据"}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{messages.common.creator}</div>
          <div className="gc-stat-value">{skill.creatorCount}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish ? "Creator evidence" : "作者证据"}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Category" : "分类"}</div>
          <div className="gc-stat-value">{messages.category[skill.category]}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            Case first
          </div>
        </div>
        <div>
          <div className="gc-stat-label">{isEnglish ? "Status" : "生成方式"}</div>
          <div className="gc-stat-value">{isEnglish ? "Derived" : "纯派生"}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {isEnglish ? "No separate submissions" : "无独立投稿"}
          </div>
        </div>
      </PageHero>

      {installablePackage ? (
        <section className="grid gap-5 border-b border-[var(--hair)] py-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]">
          <article className="border border-[var(--orange)] bg-[var(--orange)] p-5 text-white sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/75">
                {isEnglish ? "Verified installable Agent Skill" : "已验证 · 可安装 Agent Skill"}
              </p>
              <span className="border border-white/50 px-2 py-1 font-mono text-[10px] uppercase">
                SKILL.md + .skill
              </span>
            </div>
            <h2 className="mt-5 text-3xl font-medium leading-none tracking-[-0.04em]">
              {isEnglish ? "Install into your agent." : "把这套方法装进你的 Agent。"}
            </h2>
            <pre className="mt-5 overflow-x-auto border border-white/30 bg-black/20 p-4 font-mono text-xs leading-6 text-white">
              <code>{getSkillInstallCommand(skill.slug)}</code>
            </pre>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="gc-action border-white bg-white text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
                href={getSkillDownloadPath(skill.slug)}
                download
              >
                {isEnglish ? "Download .skill" : "下载 .skill"} ↓
              </a>
              <a
                className="inline-flex min-h-11 items-center justify-center border border-white bg-transparent px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white hover:text-[var(--ink)]"
                href={getSkillSourceUrl(skill.slug)}
                target="_blank"
                rel="noreferrer"
              >
                {isEnglish ? "Inspect source" : "查看源码"} ↗
              </a>
            </div>
          </article>

          <aside className="gc-panel-muted p-5 sm:p-6">
            <p className="gc-eyebrow">
              {isEnglish ? "Installation contract" : "安装合约"}
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted)]">
              <li>✓ {isEnglish ? "Standard SKILL.md frontmatter" : "标准 SKILL.md frontmatter"}</li>
              <li>✓ {isEnglish ? "Inputs, workflow, output, verification, safety" : "输入、流程、输出、验收、安全边界"}</li>
              <li>✓ {isEnglish ? "Bundled Case evidence and attribution" : "内置 Case 证据与作者署名"}</li>
              <li>✓ {isEnglish ? "Validated and packaged by skill-creator" : "已通过 skill-creator 校验与打包"}</li>
            </ul>
            {skill.kind === "creator_method" ? (
              <p className="mt-5 border-t border-[var(--hair)] pt-4 text-xs leading-6 text-[var(--muted)]">
                {isEnglish
                  ? "This is an unofficial evidence-derived synthesis, not an official Skill published or endorsed by the creator."
                  : "这是基于公开证据的非官方归纳，不代表作者本人发布或背书。"}
              </p>
            ) : null}
          </aside>
        </section>
      ) : null}

      <section className="grid gap-5 border-b border-[var(--hair)] py-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]">
        <article className="gc-panel p-5 sm:p-6">
          <p className="gc-eyebrow">
            {isEnglish ? "Method skeleton" : "方法骨架"}
          </p>
          <ol className="mt-5 grid gap-3">
            {skill.methodSteps.map((step, index) => (
              <li
                key={step}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 border-t border-[var(--hair)] pt-3"
              >
                <span className="font-mono text-sm text-[var(--orange)]">
                  0{index + 1}
                </span>
                <span className="text-base font-semibold leading-7">{step}</span>
              </li>
            ))}
          </ol>
        </article>

        <aside className="gc-panel-muted p-5 sm:p-6">
          <p className="gc-eyebrow">
            {isEnglish ? "Why it exists" : "为什么形成 Skill"}
          </p>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            {skill.kind === "creator_method"
              ? isEnglish
                ? `The same method appears in ${skill.caseCount} published cases by one creator. Popularity is not part of the threshold.`
                : `同一作者有 ${skill.caseCount} 个已发布 Case 重复出现这套方法；热度不参与成 Skill 的门槛。`
              : isEnglish
                ? `${skill.caseCount} published cases from ${skill.creatorCount} creators share the same explicit result pattern.`
                : `${skill.creatorCount} 位作者的 ${skill.caseCount} 个已发布 Case 出现同一类明确结果，达到跨作者复用门槛。`}
          </p>
          {skill.generalSkillSlug ? (
            <Link
              href={`/skills/${skill.generalSkillSlug}`}
              className="gc-action mt-5"
            >
              {isEnglish ? "View shared Skill" : "查看跨作者通用 Skill"} →
            </Link>
          ) : null}
        </aside>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <p className="gc-section-id">
            {isEnglish ? "Creator evidence" : "作者证据"}
          </p>
          <div>
            <h2 className="gc-section-title">
              {isEnglish
                ? "Methods stay attached to their makers."
                : "方法归纳出来，作者署名仍然留在证据上。"}
            </h2>
          </div>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCreators.map((creator) => {
            const creatorSlug = slugifyCreatorName(creator.name);
            return (
              <Link
                key={creator.name}
                href={`/creators/${creatorSlug}`}
                className="min-h-36 border-b border-r border-[var(--hair)] bg-white p-5 transition hover:bg-[var(--paper-2)]"
              >
                <span className="font-mono text-[10px] uppercase text-[var(--muted)]">
                  {creator.caseCount} Cases
                </span>
                <span className="mt-3 block text-lg font-semibold">
                  {creator.name}
                </span>
                <span className="mt-5 block text-sm font-semibold text-[var(--orange)]">
                  {isEnglish ? "View creator" : "查看作者"} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="gc-section">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hair)] pb-6">
          <div>
            <p className="gc-eyebrow">
              {isEnglish ? "Case evidence" : "Case 证据"}
            </p>
            <h2 className="mt-3 text-4xl font-medium leading-[0.95] tracking-[-0.04em]">
              {isEnglish
                ? "Judge the Skill through finished work."
                : "先看作品，再判断这套方法值不值得学。"}
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase text-[var(--muted)]">
            {visibleCases.length < skill.caseCount
              ? isEnglish
                ? `Showing ${visibleCases.length} of ${skill.caseCount}`
                : `展示 ${visibleCases.length} / ${skill.caseCount}`
              : `${skill.caseCount} Cases`}
          </span>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 2xl:grid-cols-3">
          {visibleCases.map((item) => (
            <CaseCard
              key={item.slug}
              item={{
                ...item,
                skills: [
                  {
                    slug: skill.slug,
                    title: skill.title,
                    kind: skill.kind,
                  },
                ],
              }}
            />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
