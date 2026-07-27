import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CATEGORY_LABELS,
  getCaseCardPrompt,
  getCaseCardSummary,
} from "@/lib/case-presentation";
import { formatStabilityScore } from "@/lib/stability";

export type CaseCardItem = {
  slug: string;
  title: string;
  category: string;
  source: string;
  creator?: string;
  summary: string;
  promptPreview?: string | null;
  promptTranslationZh?: string | null;
  mediaType: string;
  mediaUrl: string | null;
  posterUrl?: string | null;
  stabilityScore: number;
  sourceHeatScore: number | null;
};

export function CaseCard({
  item,
  actions,
}: {
  item: CaseCardItem;
  actions?: ReactNode;
}) {
  const label =
    CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ||
    item.category;
  const summary = getCaseCardSummary(item.summary);
  const prompt = getCaseCardPrompt(
    item.promptPreview,
    item.promptTranslationZh
  );

  return (
    <article className="gc-card group flex h-full flex-col overflow-hidden">
      <Link
        href={`/cases/${item.slug}`}
        className="relative block aspect-[4/3] overflow-hidden border-b border-[var(--hair)] bg-[var(--ink)]"
      >
        {item.mediaUrl ? (
          item.mediaType === "image" ? (
            <Image
              src={item.mediaUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1536px) 31vw, (min-width: 768px) 48vw, 100vw"
              className="object-cover grayscale transition duration-300 group-hover:grayscale-0"
            />
          ) : (
            <video
              muted
              playsInline
              preload="none"
              poster={item.posterUrl || undefined}
              className="h-full w-full object-cover grayscale transition duration-300 group-hover:grayscale-0"
            >
              <source src={item.mediaUrl} type="video/mp4" />
            </video>
          )
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="gc-chip gc-chip-accent">{label}</span>
          <span className="gc-chip">{item.source}</span>
          {item.creator ? <span className="gc-chip">{item.creator}</span> : null}
        </div>

        <Link href={`/cases/${item.slug}`} className="mt-5 block">
          <h2 className="text-2xl font-semibold leading-[1.02] tracking-[-0.035em] text-[var(--ink)] sm:text-3xl">
            {item.title}
          </h2>
        </Link>
        {summary ? (
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
            {summary}
          </p>
        ) : null}

        {prompt.text ? (
          <div className="mt-5 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--orange)]">
              Prompt / 方法片段
            </p>
            <p className="mt-2 line-clamp-3 font-mono text-[11px] leading-5 text-[var(--ink)]">
              {prompt.text}
            </p>
          </div>
        ) : prompt.resourceUrl ? (
          <div className="mt-5 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--orange)]">
              方法 / 代码
            </p>
            <a
              href={prompt.resourceUrl}
              target="_blank"
              rel="noreferrer"
              className="gc-action mt-3 inline-flex"
            >
              查看方法 / 代码 ↗
            </a>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="gc-stat">
            <div className="gc-stat-label">Source heat</div>
            <div className="gc-stat-value">{item.sourceHeatScore ?? "—"}</div>
          </div>
          <div className="gc-stat">
            <div className="gc-stat-label">Stability</div>
            <div className="gc-stat-value">
              {formatStabilityScore(item.stabilityScore)}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] pt-4">
          {actions}
          <Link href={`/cases/${item.slug}`} className="gc-action ml-auto">
            查看 Case →
          </Link>
        </div>
      </div>
    </article>
  );
}
