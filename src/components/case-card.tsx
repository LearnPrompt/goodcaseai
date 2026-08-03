"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { CaseCardPrompt } from "@/components/case-card-prompt";
import { LocalizedLink as Link } from "@/components/localized-link";
import { useMessages } from "@/i18n/client";
import { getCaseCardSummary } from "@/lib/case-presentation";
import { slugifyCreatorName } from "@/lib/creator-slug";
import type { SkillLink } from "@/lib/skills";
import { formatStabilityScore, hasMeasuredStability } from "@/lib/stability";

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
  stabilityScore: number;
  sourceHeatScore: number | null;
  skills?: SkillLink[];
};

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
  const isGallery = variant === "gallery";
  const label =
    messages.category[item.category as keyof typeof messages.category] ||
    item.category;
  const summary = getCaseCardSummary(item.summary);
  const creatorSlug = item.creator ? slugifyCreatorName(item.creator) : "";
  const galleryBackdropUrl = isGallery
    ? item.mediaType === "image"
      ? item.mediaUrl
      : item.posterUrl
    : null;

  return (
    <article className="gc-card group flex h-full flex-col overflow-hidden">
      <Link
        href={`/cases/${item.slug}`}
        className={`relative block overflow-hidden border-b border-[var(--hair)] bg-[var(--ink)] ${
          isGallery ? "aspect-[16/10]" : "aspect-[4/3]"
        }`}
      >
        {galleryBackdropUrl ? (
          <>
            <Image
              src={galleryBackdropUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw"
              className="pointer-events-none z-0 scale-125 object-cover opacity-70 blur-2xl saturate-125"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10)_0%,transparent_55%),linear-gradient(to_top,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.03)_35%,rgba(0,0,0,0.16)_100%)]"
            />
          </>
        ) : null}

        {item.mediaUrl ? (
          item.mediaType === "image" ? (
            <Image
              src={item.mediaUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw"
              className={`transition duration-300 ${
                isGallery
                  ? "z-20 object-contain group-hover:scale-[1.015]"
                  : "object-cover grayscale group-hover:grayscale-0"
              }`}
            />
          ) : (
            <video
              muted
              playsInline
              preload="none"
              poster={item.posterUrl || undefined}
              className={`h-full w-full transition duration-300 ${
                isGallery
                  ? "relative z-20 object-contain group-hover:scale-[1.015]"
                  : "object-cover grayscale group-hover:grayscale-0"
              }`}
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
                ? "line-clamp-2 min-h-[2.35em] text-xl leading-[1.16] sm:text-2xl"
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
              ? "mt-4 gap-px border border-[var(--concrete)] bg-[var(--concrete)]"
              : "mt-5 gap-2"
          }`}
        >
          <div
            className={
              isGallery ? "bg-[var(--paper-2)] px-3 py-2" : "gc-stat"
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
              isGallery ? "bg-[var(--paper-2)] px-3 py-2" : "gc-stat"
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
