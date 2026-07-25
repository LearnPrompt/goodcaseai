import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { getOperatorIdentity } from "@/lib/operator/auth";
import { requestOperatorMagicLink } from "./actions";

export const metadata: Metadata = {
  title: "运营登录 · GoodCase.ai",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OperatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (await getOperatorIdentity()) {
    redirect("/operator");
  }

  const params = await searchParams;

  return (
    <SiteShell footerNote="仅限 GoodCase 内部运营人员。">
      <PageHero
        eyebrow="Operator · 内部运营"
        title="登录运营收件箱。"
        description="使用已授权邮箱接收一次性登录链接。没有公众注册，也不会创建新账号。"
      />
      <section className="mx-auto max-w-xl py-10">
        <form action={requestOperatorMagicLink} className="gc-panel grid gap-5 p-6 sm:p-8">
          <label className="grid gap-2">
            <span className="gc-stat-label">授权邮箱</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="min-h-12 border border-[var(--hair)] bg-white px-3 text-sm"
            />
          </label>
          {params.sent === "1" ? (
            <p role="status" className="border border-[var(--hair)] bg-[var(--paper-2)] p-4 text-sm leading-6">
              如果该邮箱已获授权，登录链接已经发出。
            </p>
          ) : null}
          {params.error ? (
            <p role="alert" className="border border-[var(--orange)] bg-[rgba(194,65,12,0.06)] p-4 text-sm leading-6">
              登录服务暂时不可用，请稍后重试。
            </p>
          ) : null}
          <button type="submit" className="gc-btn gc-btn-primary justify-center">
            发送登录链接
          </button>
        </form>
      </section>
    </SiteShell>
  );
}
