"use client";

import { useState, type FormEvent } from "react";

type FeedbackState = "idle" | "submitting" | "success" | "error";

export function FeedbackForm() {
  const [state, setState] = useState<FeedbackState>("idle");
  const [receiptId, setReceiptId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setState("submitting");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: formData.get("kind"),
          message: formData.get("message"),
          contact: formData.get("contact"),
          website: formData.get("website"),
          page: window.location.pathname,
        }),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { receiptId?: string }
        | null;
      setReceiptId(data?.receiptId || "");
      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div role="status" aria-live="polite" className="gc-empty-state text-left">
        <p className="text-lg font-semibold text-[var(--ink)]">反馈已收到。</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          这条反馈已经写入 GoodCase 运营收件箱，不会混进 Case 候选库。
        </p>
        {receiptId ? (
          <p className="font-mono text-xs text-[var(--muted)]">
            收件编号 {receiptId.slice(0, 8)}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            className="gc-action"
            onClick={() => {
              setReceiptId("");
              setState("idle");
            }}
          >
            再写一条
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2">
        <span className="gc-stat-label">反馈类型</span>
        <select
          name="kind"
          className="min-h-11 border border-[var(--hair)] bg-white px-3 text-sm focus:border-[var(--orange)] focus:outline-none"
        >
          <option value="content">内容纠错</option>
          <option value="bug">页面问题</option>
          <option value="suggestion">产品建议</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label className="grid gap-2">
        <span className="gc-stat-label">具体内容</span>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={2000}
          placeholder="请告诉我们哪里不对，或你希望 GoodCase 改进什么。"
          className="border border-[var(--hair)] bg-white p-3 text-sm leading-7 focus:border-[var(--orange)] focus:outline-none"
        />
      </label>
      <label className="grid gap-2">
        <span className="gc-stat-label">联系方式，可选</span>
        <input
          name="contact"
          maxLength={160}
          placeholder="邮箱、微信或 X"
          className="min-h-11 border border-[var(--hair)] bg-white px-3 text-sm focus:border-[var(--orange)] focus:outline-none"
        />
      </label>
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      {state === "error" ? (
        <p role="alert" className="border border-[var(--orange)] bg-[rgba(194,65,12,0.06)] p-3 text-sm">
          反馈暂时没有提交成功，请稍后重试。
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="gc-action gc-action-primary disabled:opacity-60"
        >
          {state === "submitting" ? "提交中…" : "提交反馈"}
        </button>
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">
        仅在你主动填写时保存联系方式；首方访问统计不会读取这里的内容。
      </p>
    </form>
  );
}
