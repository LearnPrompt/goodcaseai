import type { AnalyticsEventName } from "@/lib/analytics-payload";

export type { AnalyticsEventName } from "@/lib/analytics-payload";

type EventProperties = Record<string, string | number | boolean | null>;

const SESSION_KEY = "goodcase:analytics-session";

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }

    const created =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "ephemeral";
  }
}

export function trackEvent(
  eventName: AnalyticsEventName,
  properties: EventProperties = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      path: window.location.pathname,
      referrer: document.referrer,
      sessionId: getSessionId(),
      properties: {
        ...properties,
        locale: window.location.pathname === "/en" ||
          window.location.pathname.startsWith("/en/")
          ? "en"
          : "zh-CN",
      },
    }),
    keepalive: true,
  }).catch(() => {
    // 统计失败不能阻塞浏览、分享或投稿。
  });
}
