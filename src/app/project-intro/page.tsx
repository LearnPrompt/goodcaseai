import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GoodCase.ai 项目介绍",
  description:
    "基于当前仓库真实信息整理的 GoodCase.ai 中文项目介绍页，涵盖项目定位、核心功能、技术栈、结构亮点与使用方式。",
};

const overviewChips = [
  "正式品牌：GoodCase.ai",
  "正式域名：goodcase.ai",
  "定位：creator-first",
  "当前阶段：MVP 已可操作",
];

const statusItems = [
  {
    title: "当前状态",
    description:
      "首页、案例库、详情页、登录页已可用；AI 喜爱榜与 AI 稳定榜第一版已完成。",
  },
  {
    title: "认证状态",
    description:
      "Supabase 客户端注册、登录、退出、会话监听已接通；auth/callback 的 code exchange 与基础 SSR Auth 已接通。",
  },
  {
    title: "数据状态",
    description:
      "点赞已接入 public.case_likes；候选池、审核状态与发布入库脚本已经具备雏形。",
  },
  {
    title: "当前缺口",
    description:
      "供给与审核后台待补齐，全站服务端用户态还没有系统性覆盖到所有页面与接口。",
  },
];

const coreFeatures = [
  {
    title: "真实案例浏览与分类筛选",
    description:
      "首页与 /cases 已可浏览案例，当前列表支持 全部 / AI 视频 / AI 编程(UI) / AI 图像 三类筛选。",
  },
  {
    title: "AI 喜爱榜 + AI 稳定榜",
    description:
      "首页会输出两类 Top 10 榜单，分别帮助用户看喜欢度与稳定性，降低模型选择成本。",
  },
  {
    title: "登录后点赞，解锁完整 Prompt",
    description:
      "未登录用户点赞会跳转登录；已登录用户点赞后，案例详情页的 Prompt 面板会从预览态切到完整态。",
  },
  {
    title: "案例详情承载媒体、Prompt 与模型建议",
    description:
      "详情页同时展示媒体内容、点赞数、复刻数、稳定分、推荐模型与成本档位，方便复盘与复用。",
  },
  {
    title: "服务端首屏用户态 + 客户端实时同步",
    description:
      "首页、案例列表、案例详情已读取服务端用户态初值，点赞后的解锁与计数会在客户端实时同步。",
  },
  {
    title: "候选导入与发布链路已有雏形",
    description:
      "仓库提供 import:candidates 与 publish:cases 脚本，对应候选案例导入、审核后发布入库的内容流转。",
  },
];

const audiences = [
  {
    title: "内容创作者与 AI 实践者",
    description:
      "适合先看真实输出结果，再回到 Prompt 与模型组合做复刻或二次创作。",
  },
  {
    title: "需要做模型选型的人",
    description:
      "适合通过喜爱榜、稳定榜和详情页推荐模型，快速判断先用哪个模型开跑。",
  },
  {
    title: "需要沉淀案例库的小团队",
    description:
      "当前仓库已具备案例表、点赞表、候选池与发布脚本，适合继续往内容中台方向演进。",
  },
];

const activeStack = [
  {
    title: "前端框架",
    description:
      "Next.js 16.2.2 + React 19.2.4 + TypeScript，采用 App Router 目录结构。",
  },
  {
    title: "样式体系",
    description:
      "Tailwind CSS 4 + 全局 CSS 变量，当前视觉基调延续仓库已有的暖色纸感与大标题排版。",
  },
  {
    title: "认证与数据",
    description:
      "@supabase/ssr + @supabase/supabase-js，承接 Auth、Postgres 读取、点赞写入与服务端用户态读取。",
  },
  {
    title: "数据库约束",
    description:
      "supabase/schema.sql 中定义了 profiles、cases、case_candidates、case_likes 以及对应 RLS 策略。",
  },
  {
    title: "工程校验",
    description: "项目使用 ESLint 9 与 eslint-config-next 做基础代码校验。",
  },
];

const recommendedStack = [
  "README 标注推荐部署为 Vercel",
  "媒体存储建议使用 Cloudflare R2",
  "长视频阶段建议接入 Cloudflare Stream",
];

const structureHighlights = [
  {
    title: "src/app 负责页面入口",
    description:
      "已包含首页、案例列表、案例详情、登录页与 auth/callback 路由，产品主链路集中在这里。",
  },
  {
    title: "src/components 负责交互组件",
    description:
      "站点外壳、登录表单、点赞按钮、Prompt 面板、媒体展示与 Auth Provider 都拆成了独立组件。",
  },
  {
    title: "src/lib/cases.ts 是数据装配层",
    description:
      "统一处理案例读取、分类过滤、榜单数据与媒体路径兜底，并保留数据库优先 / mock 数据兜底逻辑。",
  },
  {
    title: "src/lib/supabase/* 分离浏览器端与服务端能力",
    description:
      "浏览器 client、服务端 client 与服务端用户态读取拆开维护，认证边界更清楚。",
  },
  {
    title: "src/proxy.ts + auth/callback 形成 SSR Auth 基础设施",
    description:
      "一个负责会话刷新与 cookie 回写，一个负责邮箱确认后的 code exchange for session。",
  },
  {
    title: "scripts/ 与 supabase/ 为内容流转预留后手",
    description:
      "导入候选、发布 approved 案例、表结构与 RLS 规则都已在仓库内，后续扩展审核后台不必从零开始。",
  },
];

const usageSteps = [
  {
    title: "本地启动项目",
    description: "先安装依赖，再启动开发环境。",
    code: "npm install\nnpm run dev",
  },
  {
    title: "配置环境变量",
    description:
      "参考仓库中的 .env.example；如果要跑通真实登录与数据写入，至少需要配置 Supabase 公共 URL 与匿名 Key。",
  },
  {
    title: "按页面主链路体验",
    description:
      "访问 / 看首页与双榜单，访问 /cases 看案例库，进入详情页后登录并点赞，可验证 Prompt 解锁逻辑。",
  },
  {
    title: "查看数据结构与策略",
    description: "如果要继续开发内容流转或权限规则，优先阅读 supabase/schema.sql。",
  },
  {
    title: "执行内容导入与发布脚本",
    description:
      "仓库已有两条脚本：一条导入候选案例，一条发布审核通过的案例；两条脚本都需要 Supabase 服务端密钥环境变量。",
    code: "npm run import:candidates -- --file=tmp/case-candidates.json\nnpm run publish:cases -- --batch=<batch-id>",
  },
];

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="grid gap-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.045em] sm:text-5xl">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
        {description}
      </p>
    </header>
  );
}

export default function ProjectIntroPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_36%),radial-gradient(circle_at_top_right,rgba(203,92,47,0.12),transparent_28%),radial-gradient(circle_at_40%_100%,rgba(35,100,170,0.09),transparent_32%)]" />

      <div className="mx-auto my-3 w-[min(100%-12px,1240px)] border border-[var(--line)] bg-[rgba(255,250,241,0.76)] shadow-[0_24px_80px_rgba(47,31,20,0.12)] backdrop-blur-xl md:my-4 md:w-[min(100%-24px,1240px)]">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(255,250,241,0.9)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                GoodCase
              </span>
              <span className="text-xs tracking-[0.2em] text-[var(--ink)]">GOODCASE.AI</span>
            </div>

            <nav className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              <a className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--ink)]" href="#overview">
                项目概览
              </a>
              <a className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--ink)]" href="#features">
                核心功能
              </a>
              <a className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--ink)]" href="#stack">
                技术栈
              </a>
              <a className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--ink)]" href="#structure">
                项目结构
              </a>
              <a className="rounded-full px-3 py-2 transition hover:bg-black/5 hover:text-[var(--ink)]" href="#usage">
                使用方式
              </a>
            </nav>
          </div>
        </header>

        <main className="px-4 py-7 md:px-6 md:py-8">
          <section id="overview" className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-[28px] border border-[var(--line)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                Creator-first AI case learning platform
              </p>
              <h1 className="mt-4 max-w-[10ch] font-[family-name:var(--font-display)] text-5xl leading-[0.92] tracking-[-0.05em] sm:text-6xl lg:text-[5.5rem]">
                GoodCase.ai
                <span className="block text-[var(--accent)]">项目介绍</span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg sm:leading-9">
                一个 creator-first 的 AI 案例学习平台：先看真实 Case，再决定用哪个模型；登录后点赞可解锁完整 Prompt。
              </p>
              <div className="mt-6 rounded-[20px] border border-[var(--line)] bg-white/60 p-4 text-sm leading-7 text-[var(--muted)] sm:p-5 sm:text-base">
                <strong className="mr-2 text-[var(--ink)]">一句话介绍</strong>
                仓库当前围绕“真实案例浏览 + 双榜单判断 + 登录点赞解锁 Prompt”这条主链路，已经做出可操作的 MVP。
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-5 text-sm font-semibold !text-[var(--bg-strong)] transition hover:-translate-y-0.5"
                >
                  返回产品首页
                </Link>
                <Link
                  href="/cases"
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-5 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  查看案例库
                </Link>
              </div>
            </article>

            <aside className="grid gap-4 rounded-[28px] border border-[var(--line)] bg-[radial-gradient(circle_at_top_right,rgba(203,92,47,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(35,100,170,0.12),transparent_28%),rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8">
              <div className="flex flex-wrap gap-2.5">
                {overviewChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex min-h-10 items-center rounded-full border border-[var(--line)] bg-white/70 px-3.5 text-sm"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="grid gap-3">
                {statusItems.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[20px] border border-[var(--line)] bg-white/65 p-4"
                  >
                    <h2 className="text-base font-semibold text-[var(--ink)]">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </aside>
          </section>

          <section id="features" className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[26px] border border-[var(--line)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8">
              <SectionHeader
                eyebrow="Core Features"
                title="核心功能"
                description="以下功能均能在当前仓库中找到直接对应的页面、组件、数据层或 Supabase 结构，不包含推测性描述。"
              />
              <div className="mt-6 grid gap-3">
                {coreFeatures.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[20px] border border-[var(--line)] bg-white/65 p-4"
                  >
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="rounded-[26px] border border-[var(--line)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8">
              <SectionHeader
                eyebrow="Audience"
                title="适用人群"
                description="仓库当前产品定位是 creator-first，因此更适合围绕案例学习、模型选择与 Prompt 复用这几类场景使用。"
              />
              <div className="mt-6 grid gap-3">
                {audiences.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[20px] border border-[var(--line)] bg-white/65 p-4"
                  >
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section id="stack" className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[26px] border border-[rgba(35,100,170,0.18)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8">
              <SectionHeader
                eyebrow="Tech Stack"
                title="技术栈"
                description="这里把当前代码已落地的技术栈与 README 里标注的正式组合方向分开展示，避免把规划写成已接入。"
              />
              <div className="mt-6 grid gap-3">
                {activeStack.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[20px] border border-[rgba(35,100,170,0.16)] bg-white/65 p-4"
                  >
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
              <div className="mt-5 rounded-[22px] border border-[rgba(35,100,170,0.18)] bg-[rgba(36,94,148,0.06)] p-4">
                <p className="text-sm font-semibold text-[var(--ink)]">README 中标注的推荐正式组合</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendedStack.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[rgba(35,100,170,0.18)] bg-white/70 px-3 py-2 text-sm text-[var(--muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <article
              id="structure"
              className="rounded-[26px] border border-[rgba(203,92,47,0.2)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8"
            >
              <SectionHeader
                eyebrow="Structure Highlights"
                title="项目结构亮点"
                description="当前仓库规模不大，但模块边界已经比较清晰，后续继续扩展供给后台和服务端接口时不会从零开始。"
              />
              <div className="mt-6 grid gap-3">
                {structureHighlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[20px] border border-[rgba(203,92,47,0.18)] bg-white/65 p-4"
                  >
                    <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section
            id="usage"
            className="mt-8 rounded-[26px] border border-[var(--line)] bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_24px_80px_rgba(47,31,20,0.12)] sm:p-8"
          >
            <SectionHeader
              eyebrow="How To Use"
              title="使用方式"
              description="下面的方式完全对应当前仓库已有脚本与文件，不要求额外依赖未知工具。"
            />

            <div className="mt-6 grid gap-3">
              {usageSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-[20px] border border-[var(--line)] bg-white/65 p-4"
                >
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step.description}</p>
                  {step.code ? (
                    <pre className="mt-3 overflow-x-auto rounded-[18px] border border-[var(--line)] bg-white/75 p-4 text-sm leading-7 text-[var(--ink)]">
                      <code>{step.code}</code>
                    </pre>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 rounded-[22px] border border-[rgba(21,18,14,0.22)] bg-white/68 p-4">
              <p className="text-sm leading-7 text-[var(--muted)]">
                <strong className="text-[var(--ink)]">当前口径提醒：</strong>
                这个项目已经不是纯 Demo，但也还不是正式规模化上线版本。当前最准的阶段表述仍然是
                <code className="mx-1 rounded-full border border-[var(--line)] bg-white/80 px-2 py-1 text-[0.92em] text-[var(--ink)]">
                  MVP 已可操作，供给与审核后台待补齐
                </code>
                。
              </p>
              <p className="text-sm leading-7 text-[var(--muted)]">
                <strong className="text-[var(--ink)]">共享真相源：</strong>
                仓库协作以
                <code className="mx-1 rounded-full border border-[var(--line)] bg-white/80 px-2 py-1 text-[0.92em] text-[var(--ink)]">
                  ../docs/PROJECT_STATE.md
                </code>
                和
                <code className="mx-1 rounded-full border border-[var(--line)] bg-white/80 px-2 py-1 text-[0.92em] text-[var(--ink)]">
                  ../docs/WORKLOG.md
                </code>
                为准；如果 README 或历史日志与它们冲突，应以后两者为准。
              </p>
            </div>
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-[var(--line)] px-4 py-5 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between md:px-6">
          <span>GoodCase.ai · 中文单文件项目介绍页</span>
          <span>内容依据当前代码、文档、脚本与 Supabase schema 整理</span>
        </footer>
      </div>
    </div>
  );
}
