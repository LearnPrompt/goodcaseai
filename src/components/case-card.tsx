import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaseCardPrompt } from "@/components/case-card-prompt";
import {
  CATEGORY_LABELS,
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

        <CaseCardPrompt
          promptPreview={item.promptPreview}
          promptTranslationZh={item.promptTranslationZh}
        />

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="gc-stat">
            <div className="gc-stat-label">来源热度 / Source Heat</div>
            <div className="gc-stat-value">{item.sourceHeatScore ?? "—"}</div>
          </div>
          <div className="gc-stat">
            <div className="gc-stat-label">稳定度 / Stability</div>
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
