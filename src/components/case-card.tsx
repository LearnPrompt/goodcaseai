"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { CaseCardPrompt } from "@/components/case-card-prompt";
import { LocalizedLink as Link } from "@/components/localized-link";
import { useLocale, useMessages } from "@/i18n/client";
import { getPresentableCaseSummary } from "@/lib/case-presentation";
import { slugifyCreatorName } from "@/lib/creator-slug";
import type { SkillLink } from "@/lib/skills";
import { formatStabilityScore, hasMeasuredStability } from "@/lib/stability";
import type { Locale } from "@/i18n/config";

export type CaseCardItem = {
  slug: string;
  title: string;
  category: string;
  source: string;
  creator?: string;
  summary: string;
  promptPreview?: string | null;
  contentLocale?: "zh-CN" | "en";
  promptTranslationZh?: string | null;
  promptTranslationEn?: string | null;
  mediaType: string;
  mediaUrl: string | null;
  posterUrl?: string | null;
  /** 三段式复用方法，第一段是关键决定；摘要是自动生成的套话时拿它兜底。 */
  promptContributionNotes?: string[];
  /** 本地 400px 缩略图；列表用它省流量与图片转换额度，详情页仍用原图。 */
  thumbnailUrl?: string;
  stabilityScore: number;
  sourceHeatScore: number | null;
  sourcePublishedAt?: string | null;
  skills?: SkillLink[];
};

/**
 * 案例时效性：AI 模型更新很快，卡片需要来源发布日期。为空时不显示占位符。
 * 日期格式跟随 locale；这里不复用详情页 formatPublishedDate（那个固定输出 ISO
 * 日期，不区分语言），避免影响已经在用的详情页格式。
 */
function formatCardPublishedDate(
  value: string | null | undefined,
  locale: Locale
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function CaseCard({
  item,
  actions,
  variant = "default",
}: {
  item: CaseCardItem;
  actions?: ReactNode;
  variant?: "default" | "gallery";
}) {
  const messages = useMessages();
  const locale = useLocale();
  const isGallery = variant === "gallery";
  const label =
    messages.category[item.category as keyof typeof messages.category] ||
    item.category;
  // 自动生成的通用摘要（来自 X 的真实 XX 案例…）已被 getPresentableCaseSummary 判为无效，
  // 于是同一排卡片有的有推荐理由有的没有。这里用复用方法的第一句兜底，
  // 让每张卡都有一句能读的推荐理由，排版也不再忽长忽短。
  const summary = getPresentableCaseSummary(
    item.summary,
    item.promptContributionNotes
  );
  const creatorSlug = item.creator ? slugifyCreatorName(item.creator) : "";
  const publishedDate = formatCardPublishedDate(item.sourcePublishedAt, locale);
  // 列表卡片一律优先本地缩略图：外链原图动辄几 MB，一页 24 张会拖垮首屏。
  const cardMediaUrl = item.thumbnailUrl || item.mediaUrl || "";

  return (
    <article className="gc-card group flex h-full flex-col overflow-hidden">
      <Link
        href={`/cases/${item.slug}`}
        className={`relative block overflow-hidden border-b border-[var(--hair)] bg-[var(--ink)] ${
          isGallery ? "aspect-[16/10]" : "aspect-[4/3]"
        }`}
      >
        {item.mediaUrl ? (
          item.mediaType === "image" || item.thumbnailUrl ? (
            <Image
              src={cardMediaUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw"
              className="object-cover grayscale transition duration-300 group-hover:scale-[1.015] group-hover:grayscale-0"
            />
          ) : (
            <video
              muted
              playsInline
              preload="none"
              poster={item.posterUrl || undefined}
              className="h-full w-full object-cover grayscale transition duration-300 group-hover:scale-[1.015] group-hover:grayscale-0"
            >
              <source src={item.mediaUrl} type="video/mp4" />
            </video>
          )
        ) : null}
      </Link>

      <div
        className={`flex flex-1 flex-col ${isGallery ? "p-4 sm:p-5" : "p-5"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="gc-chip gc-chip-accent">{label}</span>
          <span className="gc-chip">{item.source}</span>
          {publishedDate ? (
            <span className="gc-chip font-mono">{publishedDate}</span>
          ) : null}
          {!isGallery && item.creator && creatorSlug ? (
            <Link
              href={`/creators/${creatorSlug}`}
              className="gc-chip transition hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              {item.creator} →
            </Link>
          ) : !isGallery && item.creator ? (
            <span className="gc-chip">{item.creator}</span>
          ) : null}
        </div>

        <Link
          href={`/cases/${item.slug}`}
          className={isGallery ? "mt-4 block" : "mt-5 block"}
        >
          <h2
            className={`font-semibold tracking-[-0.035em] text-[var(--ink)] ${
              isGallery
                ? "line-clamp-2 text-xl leading-[1.16] sm:text-2xl"
                : "text-2xl leading-[1.02] sm:text-3xl"
            }`}
          >
            {item.title}
          </h2>
        </Link>

        {isGallery && item.creator ? (
          <p className="mt-3 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
            {messages.common.creator}{" "}
            {creatorSlug ? (
              <Link
                href={`/creators/${creatorSlug}`}
                className="font-semibold text-[var(--ink)] hover:text-[var(--orange)]"
              >
                {item.creator} →
              </Link>
            ) : (
              <span className="font-semibold text-[var(--ink)]">{item.creator}</span>
            )}
          </p>
        ) : null}

        {summary ? (
          <p
            className={`mt-3 text-sm text-[var(--muted)] ${
              isGallery ? "line-clamp-2 leading-6" : "line-clamp-3 leading-7"
            }`}
          >
            {summary}
          </p>
        ) : null}

        {item.skills?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.skills
              .slice(0, isGallery ? 1 : item.skills.length)
              .map((skill) => (
                <Link
                  key={skill.slug}
                  href={`/skills/${skill.slug}`}
                  className="gc-chip transition hover:border-[var(--orange)] hover:text-[var(--orange)]"
                >
                  Skill · {skill.title}
                </Link>
              ))}
            {isGallery && item.skills.length > 1 ? (
              <span className="gc-chip">+{item.skills.length - 1}</span>
            ) : null}
          </div>
        ) : null}

        <CaseCardPrompt
          promptPreview={item.promptPreview}
          contentLocale={item.contentLocale}
          promptTranslationZh={item.promptTranslationZh}
          promptTranslationEn={item.promptTranslationEn}
          compact={isGallery}
        />

        <div
          className={`grid grid-cols-2 ${
            isGallery
              ? "mt-5 gap-px border border-[var(--concrete)] bg-[var(--concrete)]"
              : "mt-5 gap-2"
          }`}
        >
          <div
            className={
              isGallery ? "bg-white px-3 py-2" : "gc-stat"
            }
          >
            <div className="gc-stat-label">{messages.card.sourceHeat}</div>
            <div
              className={
                isGallery ? "mt-1 text-sm font-semibold" : "gc-stat-value"
              }
            >
              {item.sourceHeatScore ?? "—"}
            </div>
          </div>
          <div
            className={
              isGallery ? "bg-white px-3 py-2" : "gc-stat"
            }
          >
            <div className="gc-stat-label">{messages.card.stability}</div>
            <div
              className={
                isGallery ? "mt-1 text-sm font-semibold" : "gc-stat-value"
              }
            >
              {hasMeasuredStability(item.stabilityScore)
                ? formatStabilityScore(item.stabilityScore)
                : messages.stability.pending}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] pt-4">
          {actions}
          <Link href={`/cases/${item.slug}`} className="gc-action ml-auto">
            {messages.common.viewCase} →
          </Link>
        </div>
      </div>
    </article>
  );
}
