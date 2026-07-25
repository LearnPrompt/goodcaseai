"use client";

import { useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";

const CATEGORY_OPTIONS = [
  { value: "web", label: "AI 编程(UI)" },
  { value: "image", label: "AI 图像" },
  { value: "video", label: "AI 视频" },
  { value: "copy", label: "AI 文案" },
  { value: "hardware", label: "AI 硬件 Case" },
] as const;

type SubmitState = "idle" | "submitting" | "success" | "rate-limited" | "unavailable" | "error";

const inputClass =
  "min-h-11 w-full border border-[var(--hair)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus:border-[var(--ink)] focus:outline-none";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--mute)]">
        {label}
        {required ? <span className="ml-1 text-[var(--orange)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export function SubmitForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [receiptId, setReceiptId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: formData.get("url"),
          title: formData.get("title"),
          category: formData.get("category"),
          summary: formData.get("summary"),
          prompt: formData.get("prompt"),
          creatorName: formData.get("creatorName"),
          contact: formData.get("contact"),
          website: formData.get("website"),
        }),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { receiptId?: string }
          | null;
        setReceiptId(data?.receiptId || "");
        trackEvent("case_submit", { category: String(formData.get("category") || "") });
        setState("success");
        form.reset();
        return;
      }

      if (response.status === 429) {
        setState("rate-limited");
        return;
      }

      if (response.status === 503) {
        setState("unavailable");
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(data?.error || "提交失败，请检查填写内容后重试。");
      setState("error");
    } catch {
      setErrorMessage("网络异常，请稍后再试。");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div role="status" aria-live="polite" className="border border-[var(--hair)] bg-white p-8">
        <p className="text-lg font-semibold text-[var(--ink)]">收到！审核通过会出现在案例库。</p>
        <p className="mt-2 text-sm leading-7 text-[var(--mute)]">
          已写入 GoodCase 运营收件箱。我们会逐条人工审核，确认真实可复现后上架。
        </p>
        {receiptId ? (
          <p className="mt-3 font-mono text-xs text-[var(--mute)]">
            收件编号 {receiptId.slice(0, 8)}
          </p>
        ) : null}
        <button
          type="button"
          className="gc-btn mt-6"
          onClick={() => {
            setReceiptId("");
            setState("idle");
          }}
        >
          再提交一个
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 border border-[var(--hair)] bg-white p-6 md:p-8">
      <Field label="案例链接" required>
        <input
          type="url"
          name="url"
          required
          maxLength={2000}
          placeholder="https://…（原帖、作品页或复现记录）"
          className={inputClass}
        />
      </Field>

      <Field label="标题" required>
        <input
          type="text"
          name="title"
          required
          maxLength={120}
          placeholder="一句话说清这个案例是什么"
          className={inputClass}
        />
      </Field>

      <Field label="分类">
        <select name="category" defaultValue="web" className={inputClass}>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="案例亮点 / 说明">
        <textarea
          name="summary"
          rows={4}
          maxLength={2000}
          placeholder="为什么值得收录？效果、过程或复现要点。"
          className={inputClass}
        />
      </Field>

      <Field label="Prompt（可选）">
        <textarea
          name="prompt"
          rows={6}
          maxLength={2000}
          placeholder="有完整 Prompt 或关键参数就贴在这里，收录概率大很多。"
          className={`${inputClass} font-mono text-xs leading-6`}
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="你的名字">
          <input type="text" name="creatorName" maxLength={120} placeholder="署名或 ID" className={inputClass} />
        </Field>
        <Field label="联系方式（可选）">
          <input
            type="text"
            name="contact"
            maxLength={120}
            placeholder="邮箱 / 微信 / X，方便审核沟通"
            className={inputClass}
          />
        </Field>
      </div>

      {/* honeypot：真人看不到也不会填，机器人填了就假成功。 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {state === "rate-limited" ? (
        <p className="border border-[var(--orange)] bg-[rgba(194,65,12,0.06)] p-3 text-sm text-[var(--ink)]">
          提交太频繁，稍后再试。
        </p>
      ) : null}
      {state === "unavailable" ? (
        <p className="border border-[var(--hair)] bg-[var(--paper-2)] p-3 text-sm text-[var(--ink)]">
          投稿通道准备中，先去「接入」页加群反馈也行。
        </p>
      ) : null}
      {state === "error" && errorMessage ? (
        <p className="border border-[var(--orange)] bg-[rgba(194,65,12,0.06)] p-3 text-sm text-[var(--ink)]">
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={state === "submitting"} className="gc-btn gc-btn-primary disabled:opacity-60">
          {state === "submitting" ? "提交中…" : "提交案例"}
        </button>
      </div>
    </form>
  );
}
