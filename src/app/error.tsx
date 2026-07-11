"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SiteShell footerNote="页面出错时也保持同一视觉语言，重试或返回首页都可以继续。">
      <section className="grid gap-4 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Something went wrong
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-[-0.04em] md:text-7xl">
          页面出了点问题，先重试一次。
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          刚才的请求没有成功。你可以点击下方按钮重试，如果反复失败，请稍后再回来。
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--bg-strong)] transition hover:-translate-y-0.5"
          >
            重试
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-5 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            返回首页
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
