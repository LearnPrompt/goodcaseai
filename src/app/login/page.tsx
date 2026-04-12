import { LoginForm } from "@/components/login-form";
import { SiteShell } from "@/components/site-shell";
import { getSafeNextPath } from "@/lib/auth/next-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; authError?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = getSafeNextPath(params.next);
  const authError = params.authError === "callback";

  return (
    <SiteShell footerNote="登录后可点赞并解锁完整 Prompt。">
      <section className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Login
          </p>
          <h1 className="mt-4 max-w-[10ch] font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-[-0.04em] md:text-7xl">
            先登录，再给 Case 点爱心。
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--muted)]">
            现在已切到 Supabase 真实登录。首次使用可以先注册账号，注册后按邮箱提示完成确认。
          </p>
        </article>

        <article className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(43,28,18,0.12)]">
          <LoginForm nextUrl={nextUrl} authError={authError} />
        </article>
      </section>
    </SiteShell>
  );
}
