import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatStabilityScore } from "@/lib/stability";

const categoryLabels: Record<string, string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程",
  copy: "AI 文案",
  hardware: "AI 硬件",
};

export type CaseCardItem = {
  slug: string;
  title: string;
  category: string;
  source: string;
  creator?: string;
  summary: string;
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
  const label = categoryLabels[item.category] || item.category;

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
        <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--muted)]">
          {item.summary}
        </p>

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
