import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function NotFound() {
  return (
    <SiteShell footerNote="这个版本先只做了核心路由，404 页面也保持同一视觉语言。">
      <section className="grid gap-4 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Not found
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-[-0.04em] md:text-7xl">
          这个页面还没做，或者路径不对。
        </h1>
        <div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--bg-strong)]"
          >
            返回首页
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
