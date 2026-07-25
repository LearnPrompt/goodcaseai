import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteShell } from "@/components/site-shell";
import { requireOperatorIdentity } from "@/lib/operator/auth";
import { getOperatorInbox } from "@/lib/operator/data";
import {
  publishCandidate,
  reviewCandidate,
  signOutOperator,
  updateFeedbackStatus,
} from "./actions";

export const metadata: Metadata = {
  title: "运营收件箱 · GoodCase.ai",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export default async function OperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; type?: string }>;
}) {
  const operator = await requireOperatorIdentity();
  const inbox = await getOperatorInbox();
  const params = await searchParams;
  const openFeedback = inbox.feedback.filter((item) => item.status === "open");
  const recentFeedback = inbox.feedback.filter((item) => item.status !== "open").slice(0, 20);

  return (
    <SiteShell footerNote="内部页面 · 所有操作写入审计记录">
      <PageHero
        eyebrow="Operator · 运营收件箱"
        title="收到、审核、发布，都在这里。"
        description="反馈与投稿分开处理；只有通过证据门槛的候选才能公开发布。"
      >
        <div>
          <div className="gc-stat-label">反馈待处理</div>
          <div className="gc-stat-value">{inbox.counts.openFeedback}</div>
        </div>
        <div>
          <div className="gc-stat-label">候选待审核</div>
          <div className="gc-stat-value">{inbox.counts.pendingCandidates}</div>
        </div>
        <div>
          <div className="gc-stat-label">候选待发布</div>
          <div className="gc-stat-value">{inbox.counts.approvedCandidates}</div>
        </div>
        <div>
          <div className="gc-stat-label">当前运营者</div>
          <div className="mt-2 truncate text-sm font-semibold">{operator.email ?? "已授权用户"}</div>
        </div>
      </PageHero>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="gc-btn">查看公开站</Link>
        <form action={signOutOperator}>
          <button type="submit" className="gc-btn">退出登录</button>
        </form>
      </div>

      {params.notice ? (
        <p
          role={params.type === "error" ? "alert" : "status"}
          className={`mt-6 border p-4 text-sm ${
            params.type === "error"
              ? "border-[var(--orange)] bg-[rgba(194,65,12,0.06)]"
              : "border-[var(--hair)] bg-[var(--paper-2)]"
          }`}
        >
          {params.notice}
        </p>
      ) : null}

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ Feedback · 待处理反馈</div>
          <div>
            <h2 className="gc-section-title">先让用户的问题有去处。</h2>
            <p className="gc-section-sub">联系方式只在这个受保护页面展示。</p>
          </div>
        </div>
        <div className="grid gap-4">
          {openFeedback.length ? openFeedback.map((item) => (
            <article key={item.id} className="gc-panel grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="gc-chip gc-chip-accent">{item.kind}</span>
                  <span className="gc-chip">{formatTime(item.created_at)}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{item.message}</p>
                <dl className="mt-4 grid gap-1 text-xs leading-6 text-[var(--muted)]">
                  <div>联系方式：{item.contact || "未填写"}</div>
                  <div>页面：{item.page || "未记录"}</div>
                  <div className="font-mono">编号：{item.id}</div>
                </dl>
              </div>
              <form action={updateFeedbackStatus} className="self-start">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="resolved" />
                <button type="submit" className="gc-btn gc-btn-primary">标记已处理</button>
              </form>
            </article>
          )) : <div className="gc-empty-state">没有待处理反馈。</div>}
        </div>
      </section>

      <section className="gc-section">
        <div className="gc-section-head">
          <div className="gc-section-id">§ Candidates · 候选审核</div>
          <div>
            <h2 className="gc-section-title">证据不足，就不公开。</h2>
            <p className="gc-section-sub">
              L1 需要原始来源、作者、结果说明和公开 Prompt 或复现方法；L2 还需要独立复测记录。
            </p>
          </div>
        </div>
        <div className="grid gap-5">
          {inbox.candidates.length ? inbox.candidates.map((item) => (
            <article key={item.id} className="gc-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`gc-chip ${item.status === "approved" ? "gc-chip-accent" : ""}`}>
                      {item.status}
                    </span>
                    <span className="gc-chip">{item.category}</span>
                    <span className="gc-chip">{item.submitted_via || item.import_batch_id || "import"}</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {item.creator_name || "作者待确认"} · {formatTime(item.created_at)}
                  </p>
                </div>
                {item.source_url ? (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="gc-btn">
                    查看原始来源 ↗
                  </a>
                ) : <span className="gc-chip">缺少来源</span>}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="border border-[var(--concrete-2)] bg-[var(--paper-2)] p-4">
                  <p className="gc-stat-label">摘要</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{item.summary}</p>
                </div>
                <div className="border border-[var(--concrete-2)] bg-[var(--paper-2)] p-4">
                  <p className="gc-stat-label">Prompt / 方法</p>
                  <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6">
                    {item.prompt_full || item.prompt_preview || "未提供"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                投稿联系方式：{item.contact || "未填写"} · 媒体：{item.media_url || "未提供"}
              </p>

              {item.status === "pending" ? (
                <form action={reviewCandidate} className="mt-5 grid gap-4 border-t border-[var(--hair)] pt-5">
                  <input type="hidden" name="id" value={item.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="gc-stat-label">证据等级</span>
                      <select name="evidenceLevel" defaultValue="L1" className="min-h-11 border border-[var(--hair)] bg-white px-3">
                        <option value="L1">L1 · 原始来源可追溯</option>
                        <option value="L2">L2 · 已独立复测</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="gc-stat-label">标签，逗号分隔</span>
                      <input name="tags" defaultValue={item.tags.join(", ")} className="min-h-11 border border-[var(--hair)] bg-white px-3" />
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="gc-stat-label">审核备注</span>
                    <textarea name="note" required minLength={3} rows={3} className="border border-[var(--hair)] bg-white p-3" />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" name="decision" value="approve" className="gc-btn gc-btn-primary">
                      批准候选
                    </button>
                    <button type="submit" name="decision" value="reject" className="gc-btn">
                      拒绝候选
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hair)] pt-5">
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    审核备注：{item.review_note || "已审核"}
                  </p>
                  <form action={publishCandidate}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="gc-btn gc-btn-primary">发布到案例库</button>
                  </form>
                </div>
              )}
            </article>
          )) : <div className="gc-empty-state">没有待审核或待发布候选。</div>}
        </div>
      </section>

      {recentFeedback.length ? (
        <section className="gc-section">
          <div className="gc-section-head">
            <div className="gc-section-id">§ Feedback · 最近已处理</div>
            <h2 className="gc-section-title">保留处理记录。</h2>
          </div>
          <div className="grid gap-3">
            {recentFeedback.map((item) => (
              <article key={item.id} className="gc-panel flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm">{item.message}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-[var(--muted)]">
                    {item.status} · {formatTime(item.created_at)}
                  </p>
                </div>
                <form action={updateFeedbackStatus}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="open" />
                  <button type="submit" className="gc-btn">重新打开</button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
