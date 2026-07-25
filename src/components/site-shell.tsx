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
      <footer className="grid gap-3 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] md:grid-cols-[auto_1fr] md:items-center md:px-6">
        <span className="text-[var(--ink)]">GoodCase.ai · 中文 AI Case 证据库</span>
        {footerNote ? <span className="md:text-right">{footerNote}</span> : null}
      </footer>
    </div>
  );
}
