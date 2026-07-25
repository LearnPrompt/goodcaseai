"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function ShareButton({
  caseSlug,
  title,
}: {
  caseSlug: string;
  title: string;
}) {
  const [status, setStatus] = useState<"idle" | "busy" | "hint">("idle");
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
      }
    };
  }, []);

  const showHint = () => {
    setStatus("hint");
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
    }
    hintTimer.current = setTimeout(() => setStatus("idle"), 4000);
  };

  const share = async () => {
    if (status === "busy") {
      return;
    }
    setStatus("busy");
    trackEvent("case_share", { caseSlug });

    const posterPath = `/api/poster/${caseSlug}`;
    const caseUrl = `${window.location.origin}/cases/${caseSlug}`;

    // 优先系统分享面板（移动端微信/小红书场景），带海报图片文件。
    try {
      if (typeof navigator.share === "function") {
        const response = await fetch(posterPath);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], `goodcase-${caseSlug}.png`, {
            type: blob.type || "image/png",
          });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              files: [file],
              title,
              text: `${title} · GoodCase.ai`,
              url: caseUrl,
            });
            setStatus("idle");
            return;
          }
        }
      }
    } catch (error) {
      // 用户主动取消分享面板则不再降级弹窗。
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
    }

    // 降级：新窗口打开海报图 + 复制案例链接。
    window.open(posterPath, "_blank", "noopener");
    try {
      await navigator.clipboard.writeText(caseUrl);
    } catch {
      // 剪贴板不可用（http / 权限拒绝）时忽略，仅提示保存海报。
    }
    showHint();
  };

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={share}
        disabled={status === "busy"}
        className="gc-action whitespace-nowrap disabled:opacity-60"
      >
        <span aria-hidden="true">↗</span>
        <span>{status === "busy" ? "生成中…" : "分享海报"}</span>
      </button>
      {status === "hint" ? (
        <p className="text-xs leading-5 text-[var(--muted)]">
          海报已打开，长按/右键保存；链接已复制
        </p>
      ) : null}
    </div>
  );
}
