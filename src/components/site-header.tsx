"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/", label: "发现" },
  { href: "/cases", label: "榜单" },
  { href: "/creators", label: "创作者" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const loginHref = pathname && pathname !== "/" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";

  async function handleSignOut() {
    setIsPending(true);
    await signOut();
    setIsPending(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hair)] bg-[rgba(250,250,247,0.94)] backdrop-blur-xl">
      <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center border border-[var(--hair)] bg-white text-[var(--ink)]">
            <Image src="/goodcase-mark.svg" alt="GoodCase.ai" width={18} height={18} className="size-[18px]" priority />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold tracking-[-0.01em] text-[var(--ink)]">GoodCase.ai</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] sm:block">Case / Creator / Lab / Skill</span>
          </span>
        </Link>

        <nav className="order-3 flex w-full max-w-full overflow-x-auto border border-[var(--hair)] bg-white font-mono text-[10px] uppercase tracking-[0.08em] sm:w-auto md:order-none md:flex-wrap md:overflow-visible">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-r border-[var(--hair)] px-3 py-2 text-[var(--muted)] transition last:border-r-0 hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="border border-[var(--hair)] bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em]">{user.name}</div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="border border-[var(--hair)] px-3 py-2 text-sm text-[var(--ink)] transition hover:-translate-y-0.5 hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "退出中..." : "退出"}
              </button>
            </>
          ) : (
            <Link
              href={loginHref}
              className="whitespace-nowrap border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-xs text-[var(--paper)] transition hover:-translate-y-0.5 hover:bg-[var(--orange)] sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">登录</span>
              <span className="hidden sm:inline">登录查看更多</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
