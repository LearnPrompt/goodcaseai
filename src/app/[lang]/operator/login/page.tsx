import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { getOperatorIdentity } from "@/lib/operator/auth";
import { normalizeOperatorNextPath } from "@/lib/operator/shared-session";
import { loginOperatorWithPassword } from "./actions";
import { localizeHref } from "@/i18n/config";
import { getLocaleFromParams } from "@/i18n/server";

type PageParams = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const locale = await getLocaleFromParams(params);
  return {
    title:
      locale === "en"
        ? "Operator Login · GoodCase.ai"
        : "运营登录 · GoodCase.ai",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function OperatorLoginPage({
  params: routeParams,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const locale = await getLocaleFromParams(routeParams);
  const isEnglish = locale === "en";
  const params = await searchParams;
  const next = normalizeOperatorNextPath(
    params.next || localizeHref(locale, "/operator")
  );

  if (await getOperatorIdentity()) {
    redirect(next);
  }

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "For GoodCase operators only."
          : "仅限 GoodCase 内部运营人员。"
      }
    >
      <PageHero
        eyebrow={isEnglish ? "Operator · Internal" : "运营 · 内部工作台"}
        title={
          isEnglish ? "Sign in to the operator inbox." : "登录运营收件箱。"
        }
        description={
          isEnglish
            ? "Enter the shared team password. There is no public registration."
            : "输入团队运营密码。没有公众注册，登录后可处理投稿与反馈。"
        }
      />
      <section className="mx-auto max-w-xl py-10">
        <form action={loginOperatorWithPassword} className="gc-panel grid gap-5 p-6 sm:p-8">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2">
            <span className="gc-stat-label">
              {isEnglish ? "Team password" : "团队密码"}
            </span>
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
                ? isEnglish
                  ? "Incorrect password."
                  : "密码不正确。"
                : params.error === "locked"
                  ? isEnglish
                    ? "Too many attempts. Try again in 15 minutes."
                    : "尝试次数过多，请 15 分钟后再试。"
                  : isEnglish
                    ? "The login service is not fully configured."
                    : "登录服务尚未配置完成。"}
            </p>
          ) : null}
          <button type="submit" className="gc-btn gc-btn-primary justify-center">
            {isEnglish ? "Sign in to operator workspace" : "登录运营工作台"}
          </button>
        </form>
      </section>
    </SiteShell>
  );
}
