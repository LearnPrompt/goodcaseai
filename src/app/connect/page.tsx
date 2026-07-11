import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "接入",
  description:
    "把 GoodCase.ai 接进你的工作流：Agent Skill 一行安装、RSS 订阅与公开 REST API，匿名免 Key。",
  alternates: {
    canonical: "/connect",
  },
};

const API_PARAMS = [
  { name: "category", desc: "分类过滤：image / video / web / copy，传其他值返回 400" },
  { name: "q", desc: "关键词，匹配标题 / 摘要 / 创作者，大小写不敏感，中英文都行" },
  { name: "take", desc: "返回条数 1-50，默认 20，越界自动钳制" },
];

const LIST_FIELDS = [
  { name: "slug", desc: "案例唯一标识，用于拼详情 URL" },
  { name: "title / summary", desc: "标题与摘要" },
  { name: "category", desc: "image / video / web / copy" },
  { name: "creator / source", desc: "创作者署名与来源平台" },
  { name: "promptPreview", desc: "Prompt 预览（完整 Prompt 在详情接口）" },
  { name: "mediaUrl / posterUrl", desc: "媒体与封面的绝对 URL" },
  { name: "stabilityScore / favoriteScore", desc: "稳定分与喜爱分" },
  { name: "recommendedModels / costBand", desc: "推荐模型与成本档（low / medium / high）" },
  { name: "url", desc: "案例详情页地址" },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[14px] border border-[var(--line)] bg-[var(--ink)] p-4 text-xs leading-6 text-[var(--bg-strong)] sm:text-sm">
      <code>{children}</code>
    </pre>
  );
}

export default function ConnectPage() {
  return (
    <SiteShell footerNote="接入页把案例库开放给 Agent、RSS 阅读器和任何 HTTP 客户端，匿名免 Key。">
      <section className="mb-10 grid gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Connect
        </p>
        <h1 className="max-w-[13ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-7xl">
          把好案例接进你的工作流。
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
          三条轨道任选：让你的 AI Agent 装上 Skill 直接查案例，用 RSS 订阅最新内容，或者直接调公开
          REST API。全部匿名可用，不需要任何 Key。
        </p>
      </section>

      <div className="grid gap-6">
        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            01 · Agent Skill
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            给你的 AI 装上 goodcase Skill
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            一行命令把 Skill 复制进 Claude Code 的用户级 skills 目录（Codex CLI / Cursor / Gemini CLI
            等兼容平台同理，把目录复制到对应位置即可）：
          </p>
          <div className="mt-4">
            <CodeBlock>{`cp -r skills/goodcase ~/.claude/skills/goodcase`}</CodeBlock>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            装好之后，直接问你的 AI：「最近有什么好案例」，它就会自己来查。
          </p>
        </section>

        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            02 · RSS
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            用 RSS 订阅最新案例
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            把下面的地址加进任何 RSS 阅读器。每条包含案例摘要与 Prompt 预览，按发布时间倒序，最多 50
            条。
          </p>
          <div className="mt-4">
            <CodeBlock>{`https://goodcase.ai/feed.xml`}</CodeBlock>
          </div>
        </section>

        <section className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            03 · REST API
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.96] tracking-[-0.04em] sm:text-4xl">
            直接调公开 REST API
          </h2>

          <div className="mt-6 grid gap-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)]">
                GET /api/public/cases — 案例列表
              </h3>
              <div className="mt-3">
                <CodeBlock>{`curl -s "https://goodcase.ai/api/public/cases?category=video&q=umesh&take=5"`}</CodeBlock>
              </div>
              <dl className="mt-4 grid gap-2 text-sm leading-7">
                {API_PARAMS.map((param) => (
                  <div key={param.name} className="flex flex-wrap gap-x-3">
                    <dt className="font-mono font-semibold text-[var(--ink)]">{param.name}</dt>
                    <dd className="text-[var(--muted)]">{param.desc}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm font-semibold text-[var(--ink)]">响应字段（items 内每条）：</p>
              <dl className="mt-2 grid gap-2 text-sm leading-7">
                {LIST_FIELDS.map((field) => (
                  <div key={field.name} className="flex flex-wrap gap-x-3">
                    <dt className="font-mono font-semibold text-[var(--ink)]">{field.name}</dt>
                    <dd className="text-[var(--muted)]">{field.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)]">
                GET /api/public/cases/{"{slug}"} — 单条全量
              </h3>
              <div className="mt-3">
                <CodeBlock>{`curl -s "https://goodcase.ai/api/public/cases/real-case-01-umesh-ai"`}</CodeBlock>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                在列表字段之外额外返回：<span className="font-mono text-[var(--ink)]">promptFull</span>
                （完整 Prompt）、<span className="font-mono text-[var(--ink)]">editorNote</span>
                （编辑点评）、<span className="font-mono text-[var(--ink)]">labNote</span>
                （实验笔记）、<span className="font-mono text-[var(--ink)]">spreadScore</span>
                （传播势能分）等深度拆解字段。
              </p>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-8 text-sm leading-7 text-[var(--muted)]">
        以上全部接口匿名可用、不需要 API Key；服务端缓存 5 分钟；CORS 全开，浏览器里可以直接
        fetch。
      </p>
    </SiteShell>
  );
}
