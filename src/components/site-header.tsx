"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/cases", label: "案例库" },
  { href: "/login", label: "登录" },
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
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(255,250,241,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            MVP
          </span>
          <span className="text-xs tracking-[0.2em] text-[var(--ink)]">
            AI CASE HUB
          </span>
        </Link>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="rounded-full border border-[var(--line)] bg-white/60 px-3 py-2 text-sm">
                {user.name}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "退出中..." : "退出"}
              </button>
            </>
          ) : (
            <Link
              href={loginHref}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg-strong)] transition hover:-translate-y-0.5"
            >
              登录后点赞
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
