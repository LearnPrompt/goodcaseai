"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { trackEvent } from "@/lib/analytics";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    trackEvent("app_error", { digest: error.digest || "unknown" });
  }, [error]);

  return (
    <SiteShell footerNote="页面出错时也保持同一视觉语言，重试或返回首页都可以继续。">
      <section className="gc-empty-state my-8">
        <p className="gc-eyebrow">
          Something went wrong
        </p>
        <h1 className="text-5xl font-medium leading-[0.95] tracking-[-0.04em] md:text-7xl">
          页面出了点问题，先重试一次。
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          刚才的请求没有成功。你可以点击下方按钮重试，如果反复失败，请稍后再回来。
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="gc-action gc-action-primary"
          >
            重试
          </button>
          <Link
            href="/"
            className="gc-action"
          >
            返回首页
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
