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
    <div className="mx-auto my-3 w-[min(100%-12px,1360px)] border border-[var(--line)] bg-[rgba(255,250,241,0.72)] shadow-[0_20px_60px_rgba(43,28,18,0.12)] backdrop-blur-xl md:my-4 md:w-[min(100%-24px,1360px)]">
      <SiteHeader />
      <main className="px-4 py-7 md:px-6 md:py-8">{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-5 text-sm text-[var(--muted)] md:px-6">
        <span>GoodCase.ai</span>
        <span>{footerNote ?? "登录、点赞、媒体分发和双榜单已经纳入当前可操作版本。"}</span>
      </footer>
    </div>
  );
}
