import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
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
      <PageHero
        eyebrow="Submit · 人工投稿"
        title="提交一个真正做出来的 Case。"
        description="优先提交公众号、小红书、抖音或 X 上已经出现结果的作品。必须能找到作者、可见结果、过程或 Prompt，以及原始来源；资讯摘要不会直接发布。"
      >
        <div>
          <div className="gc-stat-label">Workflow</div>
          <div className="gc-stat-value">Pending</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">人工审核</div>
        </div>
        <div>
          <div className="gc-stat-label">Required</div>
          <div className="gc-stat-value">4 fields</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">Evidence</div>
        </div>
      </PageHero>
      <section className="mx-auto max-w-4xl py-8 md:py-12">
        <div className="gc-panel p-5 sm:p-7">
          <SubmitForm />
        </div>
      </section>
    </SiteShell>
  );
}
