import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { FeedbackForm } from "@/components/feedback-form";
import { SiteShell } from "@/components/site-shell";
import { TrackedExternalLink } from "@/components/tracked-external-link";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "接入",
  description:
    "把 GoodCase.ai 接进你的工作流：Agent Skill 一行安装、RSS 订阅与公开 REST API，匿名免 Key。",
  alternates: {
    canonical: "/connect",
  },
};

const API_PARAMS = [
  { name: "category", desc: "分类过滤：image / video / web / copy / hardware，传其他值返回 400" },
  { name: "q", desc: "关键词，匹配标题 / 摘要 / 创作者，大小写不敏感，中英文都行" },
  { name: "take", desc: "返回条数 1-50，默认 20，越界自动钳制" },
];

const LIST_FIELDS = [
  { name: "slug", desc: "案例唯一标识，用于拼详情 URL" },
  { name: "title / summary", desc: "标题与摘要" },
  { name: "category", desc: "image / video / web / copy / hardware" },
  { name: "creator / source / sourceUrl", desc: "创作者署名、来源平台与原始链接" },
  { name: "sourceLikeCount / sourceCommentCount / sourceShareCount / sourceSaveCount", desc: "来源帖公开互动快照；平台不提供的字段为 null" },
  { name: "sourcePublishedAt / sourceMetricsCapturedAt", desc: "来源发布时间与互动快照采集时间" },
  { name: "sourceHeatScore / sourceInteractionCount", desc: "跨平台归一后的来源热度与原始互动总数；无快照时为 null" },
  { name: "promptPreview", desc: "Prompt 预览（完整 Prompt 在详情接口）" },
  { name: "mediaUrl / posterUrl", desc: "媒体与封面的绝对 URL" },
  { name: "stabilityScore", desc: "当前稳定性参考分" },
  { name: "favoriteScore", desc: "旧版兼容字段，不用于来源互动榜" },
  { name: "recommendedModels / costBand", desc: "推荐模型与成本档（low / medium / high）" },
  { name: "evidenceLevel / tags", desc: "L0 / L1 / L2 证据等级与标签" },
  { name: "url", desc: "案例详情页地址" },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="w-full min-w-0 max-w-full overflow-x-auto border border-[var(--hair)] bg-[var(--ink)] p-4 text-xs leading-6 text-[var(--paper)] sm:text-sm">
      <code>{children}</code>
    </pre>
  );
}

export default function ConnectPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Connect · 开放接口"
        title="让 Case 进入你的工作流。"
        description="Agent Skill、RSS 和 REST API 都只是 GoodCase 的读取方式。它们共享同一份 Case、作者和证据数据，不复制内容、不制造新库。"
      >
        <div>
          <div className="gc-stat-label">Access</div>
          <div className="gc-stat-value">Open</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">No API key</div>
        </div>
        <div>
          <div className="gc-stat-label">Cache</div>
          <div className="gc-stat-value">5 min</div>
          <div className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">Public</div>
        </div>
      </PageHero>

      <div className="grid min-w-0 gap-0 border-l border-t border-[var(--hair)] py-8 lg:grid-cols-2">
        <section className="gc-panel min-w-0 border-l-0 border-t-0 p-5 sm:p-8">
          <p className="gc-eyebrow">
            01 · Agent Skill
          </p>
          <h2 className="mt-3 text-3xl font-medium leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            给你的 AI 装上 goodcase Skill
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Skill 与站点共用公开 API。先从 GitHub 获取仓库，再把目录复制到你所用 Agent 的 skills
            目录：
          </p>
          <div className="mt-4">
            <CodeBlock>{`git clone --depth=1 https://github.com/LearnPrompt/goodcaseai.git
cp -R goodcaseai/skills/goodcase ~/.claude/skills/goodcase`}</CodeBlock>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            装好之后，直接问你的 AI：「最近有什么好案例」，它就会自己来查。
          </p>
        </section>

        <section className="gc-panel min-w-0 border-l-0 border-t-0 p-5 sm:p-8">
          <p className="gc-eyebrow">
            02 · RSS
          </p>
          <h2 className="mt-3 text-3xl font-medium leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            用 RSS 订阅最新案例
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            把下面的地址加进任何 RSS 阅读器。每条包含案例摘要与 Prompt 预览，按发布时间倒序，最多 50
            条。
          </p>
          <div className="mt-4">
            <CodeBlock>{`${SITE_ORIGIN}/feed.xml`}</CodeBlock>
          </div>
        </section>

        <section className="gc-panel min-w-0 border-l-0 border-t-0 p-5 sm:p-8 lg:col-span-2">
          <p className="gc-eyebrow">
            03 · REST API
          </p>
          <h2 className="mt-3 text-3xl font-medium leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            直接调公开 REST API
          </h2>

          <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold text-[var(--ink)]">
                GET /api/public/cases：案例列表
              </h3>
              <div className="mt-3">
                <CodeBlock>{`curl -s "${SITE_ORIGIN}/api/public/cases?category=video&q=umesh&take=5"`}</CodeBlock>
              </div>
              <dl className="mt-4 grid gap-2 text-sm leading-7">
                {API_PARAMS.map((param) => (
                  <div key={param.name} className="grid min-w-0 gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
                    <dt className="font-mono font-semibold text-[var(--ink)]">{param.name}</dt>
                    <dd className="min-w-0 text-[var(--muted)]">{param.desc}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm font-semibold text-[var(--ink)]">响应字段（items 内每条）：</p>
              <dl className="mt-2 grid gap-2 text-sm leading-7">
                {LIST_FIELDS.map((field) => (
                  <div key={field.name} className="grid min-w-0 gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
                    <dt className="break-all font-mono font-semibold text-[var(--ink)]">{field.name}</dt>
                    <dd className="min-w-0 text-[var(--muted)]">{field.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold text-[var(--ink)]">
                GET /api/public/cases/{"{slug}"}：单条全量
              </h3>
              <div className="mt-3">
                <CodeBlock>{`curl -s "${SITE_ORIGIN}/api/public/cases/real-case-01-umesh-ai"`}</CodeBlock>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                在列表字段之外额外返回：<span className="font-mono text-[var(--ink)]">promptFull</span>
                （完整 Prompt）、<span className="font-mono text-[var(--ink)]">editorNote</span>
                （编辑点评）、<span className="font-mono text-[var(--ink)]">labNote</span>
                （实验笔记）、<span className="font-mono text-[var(--ink)]">spreadScore</span>
                （传播势能分）、<span className="font-mono text-[var(--ink)]">sourceHeatNote</span>
                （来源热度计算说明）等深度拆解字段。
              </p>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-8 text-sm leading-7 text-[var(--muted)]">
        以上全部接口匿名可用、不需要 API Key；服务端缓存 5 分钟；CORS 全开，浏览器里可以直接
        fetch。
      </p>

      <section id="about" className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ About · 产品边界</div>
          <div>
            <h2 className="gc-section-title">一个产品，一份 Case 真相源。</h2>
            <p className="gc-section-sub">
              GoodCase 是公开证据库；Creator、Lab 和 Skill 都是 Case 的派生阅读层。LearnPrompt
              保留为继续学习基础方法的外部链接，不复制教程，也不另建站内内容库。
            </p>
          </div>
        </div>
        <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Case", "公开主体：作品、作者、方法与原始来源。"],
            ["Creator", "由已收录 Case 聚合出来的作者视图。"],
            ["Lab", "围绕 Case 的复测记录与稳定性证据。"],
            ["Skill", "多个 Case 反复成立后沉淀的方法包。"],
          ].map(([title, description]) => (
            <article key={title} className="border-b border-r border-[var(--hair)] bg-white p-5">
              <p className="gc-eyebrow">{title}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
        <TrackedExternalLink
          href="https://www.learnprompt.pro"
          eventName="outbound_learnprompt"
          className="mt-6 flex min-h-24 items-center justify-between gap-5 border border-[var(--orange)] bg-[var(--orange)] px-5 py-4 text-white transition hover:border-[var(--ink)] hover:bg-[var(--ink)] sm:px-7"
        >
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-white/75">
              LearnPrompt
            </span>
            <span className="mt-1 block text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              系统学习 Prompt 基础方法
            </span>
          </span>
          <span className="shrink-0 text-xl">打开 ↗</span>
        </TrackedExternalLink>
      </section>

      <section id="feedback" className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ Feedback · 反馈</div>
          <div>
            <h2 className="gc-section-title">发现错漏，就直接留在这里。</h2>
            <p className="gc-section-sub">
              内容纠错、页面问题和产品建议进入独立人工队列，不会冒充 Case 投稿。
            </p>
          </div>
        </div>
        <div className="gc-panel max-w-3xl p-5 sm:p-7">
          <FeedbackForm />
        </div>
      </section>
    </SiteShell>
  );
}
