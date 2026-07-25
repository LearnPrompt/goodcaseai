import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/cases", label: "案例" },
  { href: "/creators", label: "创作者" },
  { href: "/favorites", label: "收藏" },
  { href: "/submit", label: "投稿" },
  { href: "/changelog", label: "更新日志" },
  { href: "/connect#feedback", label: "反馈" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[rgba(250,250,247,0.94)] backdrop-blur-xl">
      <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center border border-[var(--hair)] bg-white text-[var(--ink)]">
            <Image src="/goodcase-mark.svg" alt="GoodCase.ai" width={18} height={18} className="size-[18px]" priority />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold tracking-[-0.01em] text-[var(--ink)]">GoodCase.ai</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] sm:block">
              中文 AI Case 证据库
            </span>
          </span>
        </Link>

        <nav
          aria-label="主导航"
          className="order-3 flex w-full max-w-full overflow-x-auto border border-[var(--hair)] bg-white font-mono text-[10px] uppercase tracking-[0.08em] sm:w-auto md:order-none md:flex-nowrap md:overflow-visible"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center border-r border-[var(--hair)] px-3 text-[var(--muted)] transition last:border-r-0 hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/connect"
          className="order-2 inline-flex min-h-11 shrink-0 items-center border border-[var(--orange)] bg-[var(--orange)] px-3 text-xs font-semibold text-white transition hover:border-[var(--ink)] hover:bg-[var(--ink)] md:order-none"
        >
          Agent 接入 <span aria-hidden>→</span>
        </Link>
      </div>
    </header>
  );
}
