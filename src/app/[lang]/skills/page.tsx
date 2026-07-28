import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { LocalizedLink as Link } from "@/components/localized-link";
import { localizeHref } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import { getSkillCatalogData } from "@/lib/cases";
import {
  getInstallableSkillPackages,
  getSkillDownloadPath,
} from "@/lib/installable-skills";

export const revalidate = 300;

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
}: {
  params: Promise<{ lang: string }>;
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

      <SkillSection
        title={isEnglish ? "Shared Skills" : "跨作者通用 Skills"}
        description={
          isEnglish
            ? "Patterns repeated across at least three published Cases and two creators."
            : "至少 3 个已发布 Case、2 位创作者重复出现的可复用方法。"
        }
        skills={sharedSkills}
        isEnglish={isEnglish}
        categoryLabels={messages.category}
      />

      {creatorMethods.length ? (
        <SkillSection
          title={isEnglish ? "Creator methods" : "作者方法 Skills"}
          description={
            isEnglish
              ? "Unofficial workflows derived from at least three published Cases by the same creator. Attribution stays attached."
              : "同一作者至少 3 个已发布 Case 中归纳的非官方工作流，安装后仍保留作者与证据署名。"
          }
          skills={creatorMethods}
          isEnglish={isEnglish}
          categoryLabels={messages.category}
        />
      ) : null}
    </SiteShell>
  );
}

function SkillSection({
  title,
  description,
  skills,
  isEnglish,
  categoryLabels,
}: {
  title: string;
  description: string;
  skills: Awaited<ReturnType<typeof getSkillCatalogData>>["allSkills"];
  isEnglish: boolean;
  categoryLabels: ReturnType<typeof getMessages>["category"];
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
