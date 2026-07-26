import assert from "node:assert/strict";
import test from "node:test";
import {
  isDiagnosticFeedback,
  summarizeCaseHealth,
  summarizeOperatorAnalytics,
} from "../../../src/lib/operator/metrics.ts";

test("operator analytics excludes audit events and never exposes session ids", () => {
  const summary = summarizeOperatorAnalytics([
    {
      event_name: "page_view",
      path: "/",
      referrer: "https://wechat.com",
      anonymous_session_id: "session-a",
      created_at: "2026-07-26T10:00:00.000Z",
    },
    {
      event_name: "case_open",
      path: "/cases/demo",
      referrer: "https://wechat.com",
      anonymous_session_id: "session-a",
      created_at: "2026-07-26T10:01:00.000Z",
    },
    {
      event_name: "operator_action",
      path: "/operator",
      referrer: null,
      anonymous_session_id: "operator-id",
      created_at: "2026-07-26T10:02:00.000Z",
    },
  ]);

  assert.equal(summary.eventCounts.page_view, 1);
  assert.equal(summary.eventCounts.case_open, 1);
  assert.equal(summary.uniqueSessions, 1);
  assert.deepEqual(summary.topReferrers, [
    { label: "https://wechat.com", count: 2 },
  ]);
  assert.equal(JSON.stringify(summary).includes("session-a"), false);
  assert.equal(JSON.stringify(summary).includes("operator-id"), false);
});

test("case health separates public evidence from hidden legacy rows", () => {
  assert.deepEqual(
    summarizeCaseHealth([
      { is_published: true, evidence_level: "L1", stability_score: 91 },
      { is_published: true, evidence_level: "L2", stability_score: 0 },
      { is_published: false, evidence_level: "L1", stability_score: 88 },
    ]),
    {
      total: 3,
      public: 2,
      hidden: 1,
      publicL1: 1,
      publicL2: 1,
      publicPendingRetest: 1,
    }
  );
});

test("diagnostic feedback is visibly separated from real suggestions", () => {
  assert.equal(isDiagnosticFeedback("[DIAG] owner notification smoke"), true);
  assert.equal(isDiagnosticFeedback("GoodCase 上线通知测试：已生效"), true);
  assert.equal(isDiagnosticFeedback("我需要一个英文版"), false);
});
