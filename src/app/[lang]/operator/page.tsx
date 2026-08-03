import type { Metadata } from "next";
import Image from "next/image";
import { LocalizedLink as Link } from "@/components/localized-link";
import { SiteShell } from "@/components/site-shell";
import {
  localizeHref,
  type Locale,
} from "@/i18n/config";
import { getLocaleFromParams } from "@/i18n/server";
import { requireOperatorIdentity } from "@/lib/operator/auth";
import {
  getOperatorInbox,
  type OperatorCandidate,
  type OperatorFeedback,
} from "@/lib/operator/data";
import { isDiagnosticFeedback } from "@/lib/operator/metrics";
import {
  buildOperatorHref,
  CANDIDATE_CATEGORIES,
  parseOperatorQuery,
  type CandidateStatus,
  type FeedbackStatus,
  type OperatorQuery,
} from "@/lib/operator/query";
import {
  publishCandidate,
  reviewCandidate,
  signOutOperator,
  updateCandidateTranslation,
  updateFeedbackStatus,
} from "./actions";

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
        ? "Operator Workspace · GoodCase.ai"
        : "运营工作台 · GoodCase.ai",
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

const candidateStatusLabels: Record<Locale, Record<CandidateStatus, string>> = {
  "zh-CN": {
    pending: "待审核",
    approved: "待发布",
    rejected: "已拒绝",
    published: "已发布",
  },
  en: {
    pending: "Pending review",
    approved: "Ready to publish",
    rejected: "Rejected",
    published: "Published",
  },
};

const feedbackStatusLabels: Record<Locale, Record<FeedbackStatus, string>> = {
  "zh-CN": {
    open: "待处理",
    resolved: "已处理",
    archived: "已归档",
  },
  en: {
    open: "Open",
    resolved: "Resolved",
    archived: "Archived",
  },
};

const categoryLabels: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    all: "全部分类",
    image: "AI 图像",
    video: "AI 视频",
    web: "AI 编程",
    copy: "AI 文案",
    hardware: "AI 硬件",
  },
  en: {
    all: "All categories",
    image: "AI Image",
    video: "AI Video",
    web: "AI Coding",
    copy: "AI Copy",
    hardware: "AI Hardware",
  },
};

function formatTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function hasUsefulText(value: string | null, minimumLength = 12) {
  return Boolean(value && value.trim().length >= minimumLength);
}

function candidateCompleteness(item: OperatorCandidate, locale: Locale) {
  const isEnglish = locale === "en";
  const checks = [
    { label: isEnglish ? "source" : "来源", ok: Boolean(item.source_url) },
    { label: isEnglish ? "creator" : "作者", ok: hasUsefulText(item.creator_name, 2) },
    {
      label: isEnglish ? "summary" : "摘要",
      ok: hasUsefulText(item.summary) && item.summary !== "暂无摘要",
    },
    {
      label: isEnglish ? "method" : "方法",
      ok:
        hasUsefulText(item.prompt_full) ||
        hasUsefulText(item.prompt_preview),
    },
    {
      label: isEnglish ? "media" : "媒体",
      ok:
        Boolean(item.media_url) &&
        item.media_url !== "/media/placeholder.png",
    },
  ];

  return {
    complete: checks.filter((item) => item.ok).length,
    total: checks.length,
    missing: checks.filter((item) => !item.ok).map((item) => item.label),
  };
}

function candidateOrigin(item: OperatorCandidate, locale: Locale) {
  if (item.submitted_via === "web") {
    return locale === "en" ? "Web submission" : "网页投稿";
  }
  if (item.import_batch_id) return item.import_batch_id;
  return item.submitted_via || (locale === "en" ? "Batch import" : "批量导入");
}

function isVideoCandidate(item: OperatorCandidate) {
  return (
    item.media_kind === "video" ||
    item.category === "video" ||
    /\.(mp4|webm|mov)(?:\?|$)/i.test(item.media_url)
  );
}

function Pagination({
  query,
  current,
  pages,
  total,
  locale,
}: {
  query: OperatorQuery;
  current: number;
  pages: number;
  total: number;
  locale: Locale;
}) {
  if (total === 0) return null;

  return (
    <nav
      aria-label={locale === "en" ? "Pagination" : "分页"}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hair)] px-4 py-3 text-sm"
    >
      <span className="font-mono text-xs text-[var(--muted)]">
        {locale === "en"
          ? `Page ${Math.min(current, pages)} of ${pages} · ${total} items`
          : `第 ${Math.min(current, pages)} / ${pages} 页，共 ${total} 条`}
      </span>
      <div className="flex gap-2">
        {current > 1 ? (
          <Link
            href={buildOperatorHref(query, {
              page: current - 1,
              candidateId: null,
            })}
            className="gc-action"
          >
            {locale === "en" ? "Previous" : "上一页"}
          </Link>
        ) : null}
        {current < pages ? (
          <Link
            href={buildOperatorHref(query, {
              page: current + 1,
              candidateId: null,
            })}
            className="gc-action"
          >
            {locale === "en" ? "Next" : "下一页"}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function CandidateDetail({
  item,
  query,
  locale,
}: {
  item: OperatorCandidate;
  query: OperatorQuery;
  locale: Locale;
}) {
  const isEnglish = locale === "en";
  const completeness = candidateCompleteness(item, locale);
  const listHref = localizeHref(
    locale,
    buildOperatorHref(query, { candidateId: null })
  );
  const prompt = item.prompt_full || item.prompt_preview;
  const targetLocale = item.content_locale === "en" ? "zh-CN" : "en";
  const translated = item.translations?.[targetLocale] || {};
  const translationStatus =
    item.translation_status || "untranslated";
  const previewableImage =
    !isVideoCandidate(item) &&
    item.media_url !== "/media/placeholder.png" &&
    (item.media_url.startsWith("/") || item.media_url.startsWith("https://"));

  return (
    <aside
      id="candidate-detail"
      aria-label={isEnglish ? "Candidate details" : "候选详情"}
      className="border border-[var(--hair)] bg-white xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--hair)] p-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`gc-chip ${
                item.status === "approved" ? "gc-chip-accent" : ""
              }`}
            >
              {candidateStatusLabels[locale][item.status as CandidateStatus] ||
                item.status}
            </span>
            <span className="gc-chip">
              {categoryLabels[locale][item.category] || item.category}
            </span>
            <span className="gc-chip">{item.evidence_level || "L0"}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em]">
            {item.title}
          </h2>
          <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
            {item.id}
          </p>
        </div>
        <Link
          href={listHref}
          className="gc-action shrink-0"
          aria-label={isEnglish ? "Close candidate details" : "关闭候选详情"}
        >
          {isEnglish ? "Close" : "关闭"}
        </Link>
      </header>

      {item.media_url !== "/media/placeholder.png" ? (
        <div className="relative aspect-video overflow-hidden border-b border-[var(--hair)] bg-[var(--ink)]">
          {isVideoCandidate(item) ? (
            <video
              controls
              playsInline
              preload="metadata"
              poster={item.poster_url || undefined}
              className="h-full w-full object-contain"
            >
              <source src={item.media_url} />
            </video>
          ) : previewableImage ? (
            <Image
              src={item.media_url}
              alt={item.title}
              fill
              sizes="(min-width: 1280px) 30rem, 100vw"
              className="object-contain"
              unoptimized
            />
          ) : (
            <a
              href={item.media_url}
              target="_blank"
              rel="noreferrer"
              className="flex h-full items-center justify-center p-6 text-sm text-white underline"
            >
              {isEnglish ? "Open media file" : "打开媒体文件"}
            </a>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 p-4">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="gc-stat-label">
              {isEnglish ? "Data completeness" : "资料完整度"}
            </h3>
            <strong className="font-mono text-sm">
              {completeness.complete}/{completeness.total}
            </strong>
          </div>
          {completeness.missing.length ? (
            <p className="mt-2 text-xs text-[var(--orange)]">
              {isEnglish ? "Missing: " : "缺少："}
              {completeness.missing.join(isEnglish ? ", " : "、")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {isEnglish
                ? "Source, creator, summary, method, and media are complete."
                : "来源、作者、摘要、方法和媒体齐全。"}
            </p>
          )}
        </section>

        <dl className="grid gap-3 border-y border-[var(--concrete-2)] py-4 text-sm">
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="text-[var(--muted)]">
              {isEnglish ? "Creator" : "作者"}
            </dt>
            <dd>{item.creator_name || (isEnglish ? "Unconfirmed" : "待确认")}</dd>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="text-[var(--muted)]">
              {isEnglish ? "Received" : "收件时间"}
            </dt>
            <dd>{formatTime(item.created_at, locale)}</dd>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="text-[var(--muted)]">
              {isEnglish ? "Origin" : "入池方式"}
            </dt>
            <dd className="break-all">{candidateOrigin(item, locale)}</dd>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="text-[var(--muted)]">
              {isEnglish ? "Contact" : "联系方式"}
            </dt>
            <dd className="break-all">
              {item.contact || (isEnglish ? "Not provided" : "未填写")}
            </dd>
          </div>
        </dl>

        <section>
          <h3 className="gc-stat-label">{isEnglish ? "Summary" : "摘要"}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
            {item.summary}
          </p>
        </section>

        <section>
          <h3 className="gc-stat-label">
            Prompt / {isEnglish ? "Reproduction method" : "复现方法"}
          </h3>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap border border-[var(--concrete-2)] bg-[var(--paper-2)] p-3 font-mono text-xs leading-6">
            {prompt || (isEnglish ? "Not provided" : "未提供")}
          </pre>
        </section>

        <details className="border-y border-[var(--hair)] py-4" open={translationStatus !== "confirmed"}>
          <summary className="flex cursor-pointer items-center justify-between gap-3">
            <span className="gc-stat-label">
              {isEnglish ? "Bilingual publication copy" : "双语发布内容"}
            </span>
            <span
              className={`gc-chip ${
                translationStatus === "confirmed" ? "gc-chip-accent" : ""
              }`}
            >
              {{
                untranslated: isEnglish ? "Untranslated" : "未翻译",
                machine_draft: isEnglish ? "Machine draft" : "机器草稿",
                confirmed: isEnglish ? "Confirmed" : "已人工确认",
              }[translationStatus]}
            </span>
          </summary>
          <form action={updateCandidateTranslation} className="mt-4 grid gap-4">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="returnTo" value={listHref} />
            <input type="hidden" name="targetLocale" value={targetLocale} />
            <p className="text-xs leading-6 text-[var(--muted)]">
              {isEnglish
                ? `Source language: ${item.content_locale}; target: ${targetLocale}. Original content stays unchanged.`
                : `原文语言：${item.content_locale}；目标语言：${targetLocale}。原始内容不会被覆盖。`}
            </p>
            <label className="grid gap-2">
              <span className="gc-stat-label">
                {isEnglish ? "Translated title" : "翻译标题"}
              </span>
              <input
                name="translatedTitle"
                maxLength={160}
                defaultValue={translated.title || ""}
                className="min-h-11 border border-[var(--hair)] bg-white px-3"
              />
            </label>
            <label className="grid gap-2">
              <span className="gc-stat-label">
                {isEnglish ? "Translated summary" : "翻译摘要"}
              </span>
              <textarea
                name="translatedSummary"
                rows={4}
                maxLength={4000}
                defaultValue={translated.summary || ""}
                className="border border-[var(--hair)] bg-white p-3"
              />
            </label>
            <label className="grid gap-2">
              <span className="gc-stat-label">
                {isEnglish
                  ? "Translated prompt / method"
                  : "翻译 Prompt / 方法"}
              </span>
              <textarea
                name="translatedPrompt"
                rows={8}
                maxLength={20_000}
                defaultValue={translated.promptFull || ""}
                className="border border-[var(--hair)] bg-white p-3 font-mono text-xs leading-6"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                name="translationStatus"
                defaultValue={translationStatus}
                className="min-h-11 border border-[var(--hair)] bg-white px-3"
              >
                <option value="untranslated">
                  {isEnglish ? "Untranslated" : "未翻译"}
                </option>
                <option value="machine_draft">
                  {isEnglish ? "Machine draft" : "机器草稿"}
                </option>
                <option value="confirmed">
                  {isEnglish ? "Human confirmed" : "已人工确认"}
                </option>
              </select>
              <button type="submit" className="gc-btn">
                {isEnglish ? "Save translation" : "保存译文"}
              </button>
            </div>
          </form>
        </details>

        <div className="flex flex-wrap gap-2">
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="gc-action"
            >
              {isEnglish ? "View original source" : "查看原始来源"}{" "}
              <span aria-hidden>↗</span>
            </a>
          ) : null}
          {item.status === "published" ? (
            <Link href={`/cases/${item.slug}`} className="gc-action">
              {isEnglish ? "View published case" : "查看已发布 Case"}
            </Link>
          ) : null}
        </div>

        {item.status === "pending" ? (
          <form
            action={reviewCandidate}
            className="grid gap-4 border-t border-[var(--hair)] pt-5"
          >
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="returnTo" value={listHref} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="gc-stat-label">
                  {isEnglish ? "Evidence level" : "证据等级"}
                </span>
                <select
                  name="evidenceLevel"
                  defaultValue={
                    item.evidence_level === "L2" ? "L2" : "L1"
                  }
                  className="min-h-11 border border-[var(--hair)] bg-white px-3"
                >
                  <option value="L1">
                    {isEnglish ? "L1 Traceable source" : "L1 来源可追溯"}
                  </option>
                  <option value="L2">
                    {isEnglish ? "L2 Independently retested" : "L2 已独立复测"}
                  </option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="gc-stat-label">
                  {isEnglish ? "Tags" : "标签"}
                </span>
                <input
                  name="tags"
                  defaultValue={item.tags.join(", ")}
                  className="min-h-11 border border-[var(--hair)] bg-white px-3"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="gc-stat-label">
                {isEnglish ? "Review note" : "审核备注"}
              </span>
              <textarea
                name="note"
                required
                minLength={3}
                rows={3}
                defaultValue={item.review_note || ""}
                className="border border-[var(--hair)] bg-white p-3"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                name="decision"
                value="approve"
                className="gc-btn gc-btn-primary"
              >
                {isEnglish ? "Approve candidate" : "批准候选"}
              </button>
              <button
                type="submit"
                name="decision"
                value="reject"
                className="gc-btn"
              >
                {isEnglish ? "Reject candidate" : "拒绝候选"}
              </button>
            </div>
          </form>
        ) : null}

        {item.status === "approved" ? (
          <section className="border-t border-[var(--hair)] pt-5">
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
              {isEnglish ? "Review note: " : "审核备注："}
              {item.review_note || (isEnglish ? "Approved" : "已通过审核")}
            </p>
            <form action={publishCandidate}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="returnTo" value={listHref} />
              <button type="submit" className="gc-btn gc-btn-primary">
                {isEnglish ? "Publish to case library" : "发布到案例库"}
              </button>
            </form>
          </section>
        ) : null}

        {item.status === "rejected" ? (
          <section className="border-t border-[var(--hair)] pt-5">
            <h3 className="gc-stat-label">
              {isEnglish ? "Rejection reason" : "拒绝原因"}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {item.review_note || (isEnglish ? "Not recorded" : "未记录")}
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function CandidateTable({
  items,
  selectedId,
  query,
  locale,
}: {
  items: OperatorCandidate[];
  selectedId: string | null;
  query: OperatorQuery;
  locale: Locale;
}) {
  const isEnglish = locale === "en";
  if (!items.length) {
    return (
      <div className="gc-empty-state">
        <strong>
          {isEnglish
            ? "No candidates match the current filters."
            : "当前筛选下没有候选。"}
        </strong>
        <span className="text-sm text-[var(--muted)]">
          {isEnglish
            ? "Clear the filters or switch to another status queue."
            : "清除筛选，或切换到其他状态队列。"}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] border-collapse text-left text-sm">
        <thead className="bg-[var(--paper-2)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Received" : "收到"}</th>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Candidate" : "候选"}</th>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Creator" : "作者"}</th>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Category" : "分类"}</th>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Origin" : "来源"}</th>
            <th className="px-4 py-3 font-normal">{isEnglish ? "Data" : "资料"}</th>
            <th className="px-4 py-3 text-right font-normal">{isEnglish ? "Action" : "操作"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const completeness = candidateCompleteness(item, locale);
            const selected = selectedId === item.id;
            return (
              <tr
                key={item.id}
                className={`border-t border-[var(--concrete-2)] align-top ${
                  selected ? "bg-[rgba(194,65,12,0.07)]" : "bg-white"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-[var(--muted)]">
                  {formatTime(item.created_at, locale)}
                </td>
                <td className="max-w-[22rem] px-4 py-4">
                  <Link
                    href={buildOperatorHref(query, {
                      candidateId: item.id,
                    })}
                    className="font-semibold underline-offset-4 hover:underline"
                    aria-current={selected ? "true" : undefined}
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]">
                    {item.id.slice(0, 8)}
                  </p>
                </td>
                <td className="max-w-[11rem] px-4 py-4">
                  <span className="line-clamp-2">
                    {item.creator_name || (isEnglish ? "Unconfirmed" : "待确认")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {categoryLabels[locale][item.category] || item.category}
                </td>
                <td className="max-w-[13rem] px-4 py-4">
                  <span className="line-clamp-2 break-all text-xs text-[var(--muted)]">
                    {candidateOrigin(item, locale)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <strong className="font-mono">
                    {completeness.complete}/{completeness.total}
                  </strong>
                  {completeness.missing.length ? (
                    <p className="mt-1 text-[10px] text-[var(--orange)]">
                      {isEnglish ? "Missing " : "缺 "}
                      {completeness.missing.join(isEnglish ? ", " : "、")}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={buildOperatorHref(query, {
                      candidateId: item.id,
                    })}
                    className={`gc-action ${
                      selected ? "gc-action-primary" : ""
                    }`}
                  >
                    {isEnglish ? "Review" : "审核"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackList({
  items,
  query,
  locale,
}: {
  items: OperatorFeedback[];
  query: OperatorQuery;
  locale: Locale;
}) {
  const isEnglish = locale === "en";
  if (!items.length) {
    return (
      <div className="gc-empty-state">
        {isEnglish ? "No feedback in this queue." : "当前队列没有反馈。"}
      </div>
    );
  }

  const returnTo = localizeHref(locale, buildOperatorHref(query));

  return (
    <div className="divide-y divide-[var(--concrete-2)] border border-[var(--hair)] bg-white">
      {items.map((item) => {
        const diagnostic =
          item.status === "open" && isDiagnosticFeedback(item.message);
        return (
          <article
            key={item.id}
            className="grid gap-4 p-4 md:grid-cols-[9rem_minmax(0,1fr)_auto]"
          >
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="gc-chip">{item.kind}</span>
                  {diagnostic ? (
                    <span className="gc-chip">
                      {isEnglish ? "Test record" : "测试记录"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                  {formatTime(item.created_at, locale)}
                </p>
              </div>
              <div>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {item.message}
                </p>
                <dl className="mt-3 grid gap-1 text-xs leading-5 text-[var(--muted)]">
                  <div>
                    {isEnglish ? "Contact: " : "联系方式："}
                    {item.contact || (isEnglish ? "Not provided" : "未填写")}
                  </div>
                  <div>
                    {isEnglish ? "Source page: " : "来源页面："}
                    {item.page || (isEnglish ? "Not recorded" : "未记录")}
                  </div>
                  <div className="font-mono">
                    {isEnglish ? "ID: " : "编号："}
                    {item.id}
                  </div>
                </dl>
              </div>
              <form action={updateFeedbackStatus} className="self-start">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input
                  type="hidden"
                  name="status"
                  value={
                    item.status === "open"
                      ? diagnostic
                        ? "archived"
                        : "resolved"
                      : "open"
                  }
                />
                <button
                  type="submit"
                  className={`gc-action ${
                    item.status === "open" ? "gc-action-primary" : ""
                  }`}
                >
                  {item.status === "open"
                    ? diagnostic
                      ? isEnglish
                        ? "Archive test"
                        : "归档测试"
                      : isEnglish
                        ? "Mark resolved"
                        : "标记已处理"
                    : isEnglish
                      ? "Reopen"
                      : "重新打开"}
                </button>
              </form>
          </article>
        );
      })}
    </div>
  );
}

export default async function OperatorPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocaleFromParams(params);
  const isEnglish = locale === "en";
  const rawParams = await searchParams;
  const query = parseOperatorQuery(rawParams);
  const operator = await requireOperatorIdentity(
    localizeHref(locale, buildOperatorHref(query))
  );
  const inbox = await getOperatorInbox(query);
  const notice = Array.isArray(rawParams.notice)
    ? rawParams.notice[0]
    : rawParams.notice;
  const noticeType = Array.isArray(rawParams.type)
    ? rawParams.type[0]
    : rawParams.type;

  const candidateTabs = (
    Object.keys(candidateStatusLabels[locale]) as CandidateStatus[]
  ).map((status) => ({
    status,
    label: candidateStatusLabels[locale][status],
    count: inbox.counts.candidates[status],
  }));
  const feedbackTabs = (
    Object.keys(feedbackStatusLabels[locale]) as FeedbackStatus[]
  ).map((status) => ({
    status,
    label: feedbackStatusLabels[locale][status],
    count: inbox.counts.feedback[status],
  }));

  return (
    <SiteShell
      footerNote={
        isEnglish
          ? "Internal page. Every human action is written to the audit log."
          : "内部页面，所有人工动作写入审计记录"
      }
    >
      <header className="grid gap-5 border-b border-[var(--hair)] pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--orange)]">
            {isEnglish ? "Operator" : "运营"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {isEnglish ? "Operator workspace" : "运营工作台"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {isEnglish
              ? "Codex pre-screens and ranks batches. People make the final decision here; automation never publishes directly."
              : "Codex 负责批次预筛和排序，人工在这里完成最终审核。自动化不直接发布。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-52 truncate px-2 text-xs text-[var(--muted)]">
            {operator.email === "GoodCase 团队" && isEnglish
              ? "GoodCase team"
              : operator.email || (isEnglish ? "Authorized user" : "已授权用户")}
          </span>
          <Link href="/" className="gc-action">
            {isEnglish ? "Public site" : "公开站"}
          </Link>
          <form action={signOutOperator}>
            <input
              type="hidden"
              name="returnTo"
              value={localizeHref(locale, "/operator/login")}
            />
            <button type="submit" className="gc-action">
              {isEnglish ? "Sign out" : "退出"}
            </button>
          </form>
        </div>
      </header>

      <nav
        aria-label={isEnglish ? "Workspace queues" : "工作台队列"}
        className="mt-5 flex border border-[var(--hair)] bg-white"
      >
        <Link
          href={buildOperatorHref(query, {
            view: "candidates",
            page: 1,
            candidateId: null,
          })}
          className={`flex min-h-14 flex-1 items-center justify-between gap-3 px-4 text-sm font-semibold ${
            query.view === "candidates"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "hover:bg-[var(--paper-2)]"
          }`}
          aria-current={query.view === "candidates" ? "page" : undefined}
        >
          <span>{isEnglish ? "Candidate review" : "候选审核"}</span>
          <span className="font-mono">
            {inbox.counts.candidates.pending +
              inbox.counts.candidates.approved}
          </span>
        </Link>
        <Link
          href={buildOperatorHref(query, {
            view: "feedback",
            page: 1,
            candidateId: null,
          })}
          className={`flex min-h-14 flex-1 items-center justify-between gap-3 border-l border-[var(--hair)] px-4 text-sm font-semibold ${
            query.view === "feedback"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "hover:bg-[var(--paper-2)]"
          }`}
          aria-current={query.view === "feedback" ? "page" : undefined}
        >
          <span>{isEnglish ? "User feedback" : "用户反馈"}</span>
          <span className="font-mono">{inbox.counts.feedback.open}</span>
        </Link>
      </nav>

      <details className="mt-4 border border-[var(--hair)] bg-white">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-4 text-sm font-semibold">
          <span>{isEnglish ? "Last 30 days" : "近 30 天概况"}</span>
          <span className="font-mono text-xs text-[var(--muted)]">
            {inbox.analytics.uniqueSessions}{" "}
            {isEnglish ? "visitors" : "位访客"}
          </span>
        </summary>
        <div className="border-t border-[var(--hair)] p-4">
          <div className="grid gap-px border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Page views" : "页面浏览"}
              </div>
              <div className="gc-stat-value">
                {inbox.analytics.eventCounts.page_view}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Case opens" : "打开 Case"}
              </div>
              <div className="gc-stat-value">
                {inbox.analytics.eventCounts.case_open}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Case shares" : "分享 Case"}
              </div>
              <div className="gc-stat-value">
                {inbox.analytics.eventCounts.case_share}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "LearnPrompt outbound" : "LearnPrompt 跳转"}
              </div>
              <div className="gc-stat-value">
                {inbox.analytics.eventCounts.outbound_learnprompt}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Case submissions" : "提交 Case"}
              </div>
              <div className="gc-stat-value">
                {inbox.analytics.eventCounts.case_submit}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Public / all cases" : "公开 / 全部 Case"}
              </div>
              <div className="gc-stat-value">
                {inbox.caseHealth.public} / {inbox.caseHealth.total}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">L1 / L2</div>
              <div className="gc-stat-value">
                {inbox.caseHealth.publicL1} / {inbox.caseHealth.publicL2}
              </div>
            </div>
            <div className="bg-white p-4">
              <div className="gc-stat-label">
                {isEnglish ? "Vote to retest" : "投票催复测"}
              </div>
              <div className="gc-stat-value">
                {inbox.caseHealth.publicPendingRetest}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border border-[var(--concrete-2)] p-4">
              <h2 className="text-sm font-semibold">
                {isEnglish ? "Top pages" : "访问最多的页面"}
              </h2>
              <ol className="mt-3 grid gap-2 text-xs">
                {inbox.analytics.topPaths.length ? (
                  inbox.analytics.topPaths.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="truncate font-mono">{item.label}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))
                ) : (
                  <li className="text-[var(--muted)]">
                    {isEnglish ? "No visit data." : "暂无访问数据。"}
                  </li>
                )}
              </ol>
            </div>
            <div className="border border-[var(--concrete-2)] p-4">
              <h2 className="text-sm font-semibold">
                {isEnglish ? "Referrers" : "访问来源"}
              </h2>
              <ol className="mt-3 grid gap-2 text-xs">
                {inbox.analytics.topReferrers.length ? (
                  inbox.analytics.topReferrers.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="truncate font-mono">{item.label}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))
                ) : (
                  <li className="text-[var(--muted)]">
                    {isEnglish ? "No external referrer data." : "暂无外部来源数据。"}
                  </li>
                )}
              </ol>
            </div>
          </div>
          {inbox.analytics.truncated ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              {isEnglish
                ? "More than 5,000 events exist; this page uses the latest 5,000."
                : "事件超过 5,000 条，本页统计最近 5,000 条。"}
            </p>
          ) : null}
        </div>
      </details>

      {notice ? (
        <p
          role={noticeType === "error" ? "alert" : "status"}
          className={`mt-4 border p-4 text-sm ${
            noticeType === "error"
              ? "border-[var(--orange)] bg-[rgba(194,65,12,0.06)]"
              : "border-[var(--hair)] bg-[var(--paper-2)]"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {query.view === "candidates" ? (
        <section className="py-6">
          <div className="flex flex-wrap border border-[var(--hair)] bg-white">
            {candidateTabs.map((tab, index) => (
              <Link
                key={tab.status}
                href={buildOperatorHref(query, {
                  status: tab.status,
                  page: 1,
                  candidateId: null,
                })}
                className={`flex min-h-12 flex-1 items-center justify-between gap-2 px-3 text-xs font-semibold ${
                  index > 0 ? "border-l border-[var(--hair)]" : ""
                } ${
                  query.status === tab.status
                    ? "bg-[var(--orange)] text-white"
                    : "hover:bg-[var(--paper-2)]"
                }`}
                aria-current={query.status === tab.status ? "page" : undefined}
              >
                <span>{tab.label}</span>
                <span className="font-mono">{tab.count}</span>
              </Link>
            ))}
          </div>

          <form
            action={localizeHref(locale, "/operator")}
            method="get"
            className="mt-4 grid gap-3 border border-[var(--hair)] bg-[var(--paper-2)] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto_auto]"
          >
            {query.status !== "pending" ? (
              <input type="hidden" name="status" value={query.status} />
            ) : null}
            <label className="grid gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {isEnglish
                  ? "Search title, creator, or batch"
                  : "搜索标题、作者或批次"}
              </span>
              <input
                name="q"
                defaultValue={query.query}
                className="min-h-11 border border-[var(--hair)] bg-white px-3 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {isEnglish ? "Category" : "分类"}
              </span>
              <select
                name="category"
                defaultValue={query.category}
                className="min-h-11 border border-[var(--hair)] bg-white px-3 text-sm"
              >
                {CANDIDATE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[locale][category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {isEnglish ? "Origin" : "入池方式"}
              </span>
              <select
                name="origin"
                defaultValue={query.origin}
                className="min-h-11 border border-[var(--hair)] bg-white px-3 text-sm"
              >
                <option value="all">{isEnglish ? "All" : "全部"}</option>
                <option value="web">
                  {isEnglish ? "User submission" : "用户投稿"}
                </option>
                <option value="import">
                  {isEnglish ? "Batch import" : "批量导入"}
                </option>
              </select>
            </label>
            <button type="submit" className="gc-action self-end">
              {isEnglish ? "Filter" : "筛选"}
            </button>
            <Link
              href={buildOperatorHref(query, {
                category: "all",
                origin: "all",
                query: "",
                page: 1,
                candidateId: null,
              })}
              className="gc-action self-end"
            >
              {isEnglish ? "Clear" : "清除"}
            </Link>
          </form>

          <div
            className={`mt-4 grid items-start gap-4 ${
              inbox.selectedCandidate
                ? "xl:grid-cols-[minmax(0,1fr)_30rem]"
                : ""
            }`}
          >
            <div className="border border-[var(--hair)] bg-white">
              <CandidateTable
                items={inbox.candidates}
                selectedId={inbox.selectedCandidate?.id || null}
                query={query}
                locale={locale}
              />
              <Pagination
                query={query}
                current={query.page}
                pages={inbox.pagination.candidatePages}
                total={inbox.pagination.candidateTotal}
                locale={locale}
              />
            </div>
            {query.candidateId && !inbox.selectedCandidate ? (
              <aside className="border border-[var(--orange)] bg-white p-5" role="alert">
                <strong>
                  {isEnglish
                    ? "Candidate not found."
                    : "没有找到这个候选。"}
                </strong>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {isEnglish
                    ? "The record may have been deleted or the receipt ID is invalid."
                    : "记录可能已被删除，或收件编号不正确。"}
                </p>
              </aside>
            ) : null}
            {inbox.selectedCandidate ? (
              <CandidateDetail
                item={inbox.selectedCandidate}
                query={query}
                locale={locale}
              />
            ) : null}
          </div>
        </section>
      ) : (
        <section className="py-6">
          <div className="flex flex-wrap border border-[var(--hair)] bg-white">
            {feedbackTabs.map((tab, index) => (
              <Link
                key={tab.status}
                href={buildOperatorHref(query, {
                  feedbackStatus: tab.status,
                  page: 1,
                })}
                className={`flex min-h-12 flex-1 items-center justify-between gap-2 px-4 text-xs font-semibold ${
                  index > 0 ? "border-l border-[var(--hair)]" : ""
                } ${
                  query.feedbackStatus === tab.status
                    ? "bg-[var(--orange)] text-white"
                    : "hover:bg-[var(--paper-2)]"
                }`}
                aria-current={
                  query.feedbackStatus === tab.status ? "page" : undefined
                }
              >
                <span>{tab.label}</span>
                <span className="font-mono">{tab.count}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <FeedbackList
              items={inbox.feedback}
              query={query}
              locale={locale}
            />
            <Pagination
              query={query}
              current={query.page}
              pages={inbox.pagination.feedbackPages}
              total={inbox.pagination.feedbackTotal}
              locale={locale}
            />
          </div>
        </section>
      )}
    </SiteShell>
  );
}
