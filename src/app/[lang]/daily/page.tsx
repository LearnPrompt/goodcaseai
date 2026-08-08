import type { Metadata } from "next";
import { socialMetadata } from "@/lib/social-metadata";
import { CaseCard } from "@/components/case-card";
import { FavoriteButton } from "@/components/favorite-button";
import { LikeButton } from "@/components/like-button";
import { LocalizedLink as Link } from "@/components/localized-link";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { localizeHref, SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { getLocaleFromParams } from "@/i18n/server";
import { toCaseCardItem } from "@/lib/case-card-item";
import { getCaseListData, type DisplayCaseItem } from "@/lib/cases";
import {
  DAILY_DIGEST_EPOCH,
  getDigestDateKey,
  selectDailyDigest,
  type DailyDigestPick,
} from "@/lib/daily-digest";
import { getRetestRecords } from "@/lib/retest-source";
import { deriveSkillCatalog, getCaseSkillLinks } from "@/lib/skills";
import { formatStabilityScore, resolveStabilityState } from "@/lib/stability";

/**
 * 早报内容按天变，但 ISR 的 revalidate 是「从生成那一刻起算多久过期」，
 * 不是「对齐到某个自然日边界」。写 86400 的话，页面在北京时间午夜之后
 * 最长可能还挂着昨天那一期整整一天，正好把这个页面唯一的卖点搞砸。
 * 所以内容是天级的，回源节流按小时给：过期最多滞后一小时。
 */
export const revalidate = 3_600;

// [lang] 是动态段，不加 generateStaticParams 的话上面的 revalidate 完全不起作用——
// 每次请求都会打 Supabase。只有两种语言，直接枚举。
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

function formatIssue(messages: Messages, issueNumber: number) {
  return messages.daily.issue.replace("{issue}", String(issueNumber));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const title = `${messages.daily.eyebrow} · ${messages.daily.title}`;
  const description = messages.daily.description;

  return {
    title,
    description,
    ...socialMetadata({ locale, title, description, path: "/daily" }),
    alternates: {
      canonical: localizeHref(locale, "/daily"),
      languages: {
        "zh-CN": "/daily",
        en: "/en/daily",
        "x-default": "/daily",
      },
      types: {
        "application/rss+xml": localizeHref(locale, "/daily/feed.xml"),
      },
    },
  };
}

function SlotHeader({
  index,
  label,
  note,
}: {
  index: string;
  label: string;
  note: string;
}) {
  return (
    <div className="border-b border-[var(--hair)] px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--mute)]">
        § {index}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
        <span className="mr-2 inline-block size-2 bg-[var(--orange)]" />
        {label}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--mute)]">{note}</p>
    </div>
  );
}

function DigestSlot({
  index,
  label,
  note,
  pick,
  locale,
  messages,
  skillCatalog,
}: {
  index: string;
  label: string;
  note: string;
  pick: DailyDigestPick<DisplayCaseItem> | null;
  locale: Locale;
  messages: Messages;
  skillCatalog: ReturnType<typeof deriveSkillCatalog>;
}) {
  return (
    <article className="border border-[var(--hair)] bg-white">
      <SlotHeader index={index} label={label} note={note} />
      <div className="p-5">
        {pick ? (
          <CaseCard
            item={toCaseCardItem(
              pick.item,
              getCaseSkillLinks(skillCatalog, pick.item.slug)
            )}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <LikeButton
                  caseSlug={pick.item.slug}
                  initialCount={pick.item.likedCount}
                />
                <FavoriteButton caseSlug={pick.item.slug} />
              </div>
            }
          />
        ) : (
          <div className="gc-empty-state">
            <p>{messages.daily.empty}</p>
            <Link className="gc-action mt-4 inline-flex" href="/cases">
              {messages.daily.browseAll} →
            </Link>
          </div>
        )}
      </div>
      {pick ? (
        <div className="grid grid-cols-3 gap-px border-t border-[var(--hair)] bg-[var(--hair)]">
          <div className="bg-white px-5 py-3">
            <div className="gc-stat-label">{messages.common.sourceHeat}</div>
            <div className="mt-1 font-mono text-sm text-[var(--ink)]">
              {pick.item.sourceHeatScore ?? messages.common.notAvailable}
            </div>
          </div>
          <div className="bg-white px-5 py-3">
            <div className="gc-stat-label">{messages.common.stability}</div>
            <div className="mt-1 font-mono text-sm text-[var(--ink)]">
              {/* 0 分要分两种：evidence_level 已经是 L2 的是「复测未通过」，
                  其余才是「还没测过」，见 src/lib/stability.ts。 */}
              {resolveStabilityState(
                pick.item.stabilityScore,
                pick.item.evidenceLevel
              ) === "pending"
                ? messages.common.notAvailable
                : formatStabilityScore(
                    pick.item.stabilityScore,
                    locale,
                    pick.item.evidenceLevel
                  )}
            </div>
          </div>
          <div className="bg-white px-5 py-3">
            <div className="gc-stat-label">
              {locale === "en" ? "Shortlist" : "候选名次"}
            </div>
            <div className="mt-1 font-mono text-sm text-[var(--ink)]">
              {pick.rank} / {pick.poolSize}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default async function DailyDigestPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = await getLocaleFromParams(params);
  const messages = getMessages(locale);
  const cases = await getCaseListData("all", locale);
  const skillCatalog = deriveSkillCatalog(cases, locale);
  const retestRecords = await getRetestRecords();

  // 取「现在」是这个页面唯一的非确定性输入；拿到 dateKey 之后一切都由日期决定。
  const dateKey = getDigestDateKey(new Date()) ?? "";
  const digest = selectDailyDigest(cases, dateKey, { retestRecords });
  const issueLabel = formatIssue(messages, digest.issueNumber);
  const isRetestPick = digest.review?.slot === "retest";

  return (
    <SiteShell footerNote={messages.daily.footerNote}>
      <PageHero
        eyebrow={`${messages.daily.eyebrow} · ${issueLabel}`}
        title={messages.daily.title}
        description={messages.daily.description}
      >
        <div>
          <div className="gc-stat-label">
            {locale === "en" ? "Issue" : "期数"}
          </div>
          <div className="gc-stat-value">{digest.issueNumber}</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            {locale === "en" ? "since" : "自"} {DAILY_DIGEST_EPOCH}
          </div>
        </div>
        <div>
          <div className="gc-stat-label">
            {locale === "en" ? "Date" : "日期"}
          </div>
          <div className="gc-stat-value font-mono text-2xl">
            {digest.dateKey}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
            UTC+8
          </div>
        </div>
      </PageHero>

      <div className="mb-6 flex flex-wrap gap-3">
        <a className="gc-btn" href={localizeHref(locale, "/daily/feed.xml")}>
          {messages.daily.subscribe} <span>→</span>
        </a>
        <Link className="gc-btn gc-btn-ghost" href="/cases">
          {messages.daily.browseAll}
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <DigestSlot
          index="01"
          label={messages.daily.freshLabel}
          note={
            digest.fresh?.fallback
              ? messages.daily.freshFallbackNote
              : messages.daily.freshNote
          }
          pick={digest.fresh}
          locale={locale}
          messages={messages}
          skillCatalog={skillCatalog}
        />
        <DigestSlot
          index="02"
          label={isRetestPick ? messages.daily.retestLabel : messages.daily.reviewLabel}
          note={isRetestPick ? messages.daily.retestNote : messages.daily.reviewNote}
          pick={digest.review}
          locale={locale}
          messages={messages}
          skillCatalog={skillCatalog}
        />
      </section>
    </SiteShell>
  );
}
