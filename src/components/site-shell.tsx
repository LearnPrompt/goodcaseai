import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export function SiteShell({
  children,
  footerNote,
}: {
  children: ReactNode;
  footerNote?: string;
}) {
  return (
    <div className="mx-auto my-3 w-[calc(100%_-_12px)] max-w-[1440px] border border-[var(--hair)] bg-[rgba(250,250,247,0.92)] shadow-[0_48px_110px_-72px_rgba(10,10,10,0.75)] backdrop-blur-xl md:my-4 md:w-[calc(100%_-_24px)]">
      <SiteHeader />
      <main className="px-4 py-7 md:px-6 md:py-8">{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] md:px-6">
        <span className="text-[var(--ink)]">GoodCase.ai</span>
        <span>{footerNote ?? "点赞解锁、媒体分发和双榜单已经纳入当前可操作版本。"}</span>
      </footer>
    </div>
  );
}
