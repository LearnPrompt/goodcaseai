export const PUBLIC_TRAFFIC_EVENTS = [
  "page_view",
  "case_open",
  "case_search",
  "case_share",
  "outbound_learnprompt",
  "case_submit",
] as const;

export type PublicTrafficEvent = (typeof PUBLIC_TRAFFIC_EVENTS)[number];

export type OperatorAnalyticsRow = {
  event_name: string;
  path: string;
  referrer: string | null;
  anonymous_session_id: string;
  created_at: string;
};

export type OperatorCaseHealthRow = {
  is_published: boolean;
  evidence_level: string | null;
  stability_score: number | null;
};

type RankedValue = {
  label: string;
  count: number;
};

function rankValues(values: string[], limit = 5): RankedValue[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function summarizeOperatorAnalytics(
  rows: OperatorAnalyticsRow[],
  limit = 5000
) {
  const publicRows = rows.filter((row) =>
    PUBLIC_TRAFFIC_EVENTS.includes(row.event_name as PublicTrafficEvent)
  );
  const eventCounts = Object.fromEntries(
    PUBLIC_TRAFFIC_EVENTS.map((eventName) => [
      eventName,
      publicRows.filter((row) => row.event_name === eventName).length,
    ])
  ) as Record<PublicTrafficEvent, number>;

  return {
    eventCounts,
    uniqueSessions: new Set(
      publicRows.map((row) => row.anonymous_session_id).filter(Boolean)
    ).size,
    topPaths: rankValues(publicRows.map((row) => row.path)),
    topReferrers: rankValues(
      publicRows.map((row) => row.referrer ?? "").filter(Boolean)
    ),
    truncated: rows.length >= limit,
  };
}

export function summarizeCaseHealth(rows: OperatorCaseHealthRow[]) {
  const publicRows = rows.filter((row) => row.is_published);

  return {
    total: rows.length,
    public: publicRows.length,
    hidden: rows.length - publicRows.length,
    publicL1: publicRows.filter((row) => row.evidence_level === "L1").length,
    publicL2: publicRows.filter((row) => row.evidence_level === "L2").length,
    publicPendingRetest: publicRows.filter(
      (row) => !row.stability_score || row.stability_score <= 0
    ).length,
  };
}

export function isDiagnosticFeedback(message: string) {
  return (
    /^\[(?:TEST|DIAG)\]/i.test(message.trim()) ||
    /(?:上线通知测试|生产链路验收|最终验收)/.test(message)
  );
}
