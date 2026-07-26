import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { getOperatorIdentity } from "@/lib/operator/auth";
import { normalizeOperatorNextPath } from "@/lib/operator/shared-session";
import { loginOperatorWithPassword } from "./actions";

export const metadata: Metadata = {
  title: "运营登录 · GoodCase.ai",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OperatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = normalizeOperatorNextPath(params.next);

  if (await getOperatorIdentity()) {
    redirect(next);
  }

  return (
    <SiteShell footerNote="仅限 GoodCase 内部运营人员。">
      <PageHero
        eyebrow="Operator · 内部运营"
        title="登录运营收件箱。"
        description="输入团队运营密码。没有公众注册，登录后可处理投稿与反馈。"
      />
      <section className="mx-auto max-w-xl py-10">
        <form action={loginOperatorWithPassword} className="gc-panel grid gap-5 p-6 sm:p-8">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2">
            <span className="gc-stat-label">团队密码</span>
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={256}
              autoComplete="current-password"
              className="min-h-12 border border-[var(--hair)] bg-white px-3 text-sm"
            />
          </label>
          {params.error ? (
            <p role="alert" className="border border-[var(--orange)] bg-[rgba(194,65,12,0.06)] p-4 text-sm leading-6">
              {params.error === "invalid"
                ? "密码不正确。"
                : params.error === "locked"
                  ? "尝试次数过多，请 15 分钟后再试。"
                  : "登录服务尚未配置完成。"}
            </p>
          ) : null}
          <button type="submit" className="gc-btn gc-btn-primary justify-center">
            登录运营工作台
          </button>
        </form>
      </section>
    </SiteShell>
  );
}
