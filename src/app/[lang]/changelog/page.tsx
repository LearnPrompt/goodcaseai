import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { CHANGELOG } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "更新日志 · 好案例",
  description:
    "GoodCase.ai 的产品更新日志：搜索、收藏、RSS、公开 API、Skill 接入等功能的上线记录，用人话说清楚每次变化。",
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

export default function ChangelogPage() {
  return (
    <SiteShell footerNote="更新日志按时间倒序排列，只记录你能感知到的变化。">
      <div className="mx-auto max-w-[860px]">
        <header className="border-b border-[var(--hair)] pb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
            Changelog
          </p>
          <h1 className="mt-3 text-4xl font-medium leading-[0.98] tracking-[-0.045em] text-[var(--ink)] sm:text-5xl">
            更新日志
          </h1>
          <p className="mt-4 max-w-[36rem] text-sm leading-7 text-[var(--muted)]">
            这里记录 GoodCase.ai 每一次你能感知到的变化。新功能、体验调整、开放能力，都在这一页说清楚。
          </p>
        </header>

        <ol className="mt-2">
          {CHANGELOG.map((entry, index) => {
            const isPlan = entry.tags?.includes("规划") ?? false;
            return (
              <li
                key={`${entry.date}-${entry.title}`}
                className={`grid gap-3 border-b border-[var(--concrete)] py-8 sm:grid-cols-[160px_1fr] sm:gap-6 ${
                  index === CHANGELOG.length - 1 ? "border-b-0" : ""
                }`}
              >
                <div className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <time
                    dateTime={entry.date}
                    className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--muted)]"
                  >
                    {isPlan ? "ROADMAP" : formatDate(entry.date)}
                  </time>
                  {entry.tags?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                            tag === "规划"
                              ? "border-[var(--orange)] text-[var(--orange)]"
                              : "border-[var(--concrete-2)] text-[var(--muted)]"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <article>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-2xl">
                    {entry.title}
                  </h2>
                  <ul className="mt-4 grid gap-2.5">
                    {entry.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-sm leading-7 text-[var(--muted)]"
                      >
                        <span
                          aria-hidden
                          className="mt-[13px] h-px w-4 shrink-0 bg-[var(--orange)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--hair)] pt-8">
          <Link href="/cases" className="gc-btn gc-btn-primary">
            去看案例库
          </Link>
          <Link href="/connect" className="gc-btn gc-btn-ghost">
            把好案例接进你的 AI 助手
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
