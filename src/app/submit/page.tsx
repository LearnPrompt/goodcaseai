import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "提交案例 · 好案例",
  description: "把你见过或复刻成功的 AI 好案例投稿给 GoodCase.ai，审核通过后进入案例库。",
  alternates: {
    canonical: "/submit",
  },
};

export default function SubmitPage() {
  return (
    <SiteShell footerNote="投稿进入 pending 队列，人工审核通过后发布到案例库。">
      <section className="mx-auto max-w-3xl py-10 md:py-14">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--mute)]">Submit · 投稿</p>
        <h1 className="mt-5 text-4xl font-medium leading-[0.98] tracking-[-0.03em] text-[var(--ink)] sm:text-5xl">
          提交一个好案例
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--mute)] sm:text-base sm:leading-8">
          收录标准：真实可复现、有 Prompt 或过程、注明来源作者。符合这三条的案例，审核通过后会出现在案例库。
        </p>
        <div className="mt-8">
          <SubmitForm />
        </div>
      </section>
    </SiteShell>
  );
}
