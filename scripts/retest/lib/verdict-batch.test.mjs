import test from "node:test";
import assert from "node:assert/strict";
import { applyVerdictBatch, formatBatchReport, parseVerdictBatch } from "./verdict-batch.mjs";
import { shouldTriggerRetestDeploy } from "./stability-verdict.mjs";

const SITE_DB = { supabaseUrl: "https://live-project.supabase.co" };

function entriesOf(...labels) {
  return labels.map((label) => ({
    label,
    id: null,
    slug: label,
    verdict: "reproduced",
    notes: "对照一致",
    operator: "YC",
  }));
}

test("批量文件吃 retest-manifest.json 原样，人填的字段名都认", () => {
  const { entries, skipped } = parseVerdictBatch({
    records: [
      { slug: "case-a", verdict: "reproduced", reviewerNotes: "一致", reviewer: "YC" },
      { slug: "case-b", verdict: null, reviewerNotes: null, reviewer: null },
      { id: 42, verdict: "degraded", notes: "退化", operator: "LZ" },
    ],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.label, entry.id, entry.slug, entry.verdict, entry.notes, entry.operator]),
    [
      ["case-a", null, "case-a", "reproduced", "一致", "YC"],
      ["id=42", "42", null, "degraded", "退化", "LZ"],
    ]
  );
  // 刚跑完还没审的行是「跳过」不是「失败」，否则一份新 manifest 会报成整批失败。
  assert.deepEqual(skipped, [{ label: "case-b", reason: "verdict 留空，还没人审" }]);
});

test("批量文件缺 id 和 slug 的行只废这一行，不废整批", () => {
  const { entries } = parseVerdictBatch([
    { verdict: "reproduced", notes: "n", operator: "YC" },
    { slug: "case-ok", verdict: "reproduced", notes: "n", operator: "YC" },
  ]);
  assert.match(entries[0].error, /缺少 id 或 slug/);
  assert.equal(entries[1].error, undefined);
  assert.throws(() => parseVerdictBatch("不是数组"), /必须是 JSON 数组/);
});

test("--operator 可以给整批兜底，逐条填的优先", () => {
  const { entries } = parseVerdictBatch(
    [
      { slug: "case-a", verdict: "reproduced", notes: "n" },
      { slug: "case-b", verdict: "reproduced", notes: "n", reviewer: "LZ" },
    ],
    { defaultOperator: "YC" }
  );
  assert.equal(entries[0].operator, "YC");
  assert.equal(entries[1].operator, "LZ");
});

test("全部成功：逐条报成功，收尾只触发一次部署", async () => {
  const applied = [];
  const summary = await applyVerdictBatch({
    entries: entriesOf("case-a", "case-b", "case-c"),
    applyEntry: async (entry) => {
      applied.push(entry.slug);
      return { slug: entry.slug, caseUpdated: true, message: "stability_score=100" };
    },
  });

  assert.deepEqual(applied, ["case-a", "case-b", "case-c"]);
  assert.equal(summary.successCount, 3);
  assert.equal(summary.failureCount, 0);
  // updatedCaseCount 现在是整批计数，触发部署的判定吃的就是它——三条改动一次构建。
  assert.equal(summary.updatedCaseCount, 3);
  assert.equal(shouldTriggerRetestDeploy({ updatedCaseCount: summary.updatedCaseCount, ...SITE_DB }), true);
});

test("部分失败：失败的行不打断后面的行，成功的部分照样触发一次部署", async () => {
  const summary = await applyVerdictBatch({
    entries: entriesOf("case-a", "case-boom", "case-c"),
    applyEntry: async (entry) => {
      if (entry.slug === "case-boom") throw new Error("找不到 case-boom 的复测记录。");
      return { slug: entry.slug, caseUpdated: true, message: "stability_score=100" };
    },
  });

  assert.equal(summary.successCount, 2);
  assert.equal(summary.failureCount, 1);
  assert.deepEqual(summary.updatedSlugs, ["case-a", "case-c"]);
  assert.equal(shouldTriggerRetestDeploy({ updatedCaseCount: summary.updatedCaseCount, ...SITE_DB }), true);

  const report = formatBatchReport(summary, [{ label: "case-d", reason: "verdict 留空，还没人审" }]);
  assert.match(report, /❌ case-boom —— 找不到 case-boom 的复测记录。/);
  assert.match(report, /成功 2 条，失败 1 条，跳过 1 条/);
});

test("全部失败：一条都没改到 Case，不触发部署", async () => {
  const summary = await applyVerdictBatch({
    entries: entriesOf("case-a", "case-b"),
    applyEntry: async () => {
      throw new Error("写入人工 verdict 失败：permission denied");
    },
  });

  assert.equal(summary.successCount, 0);
  assert.equal(summary.failureCount, 2);
  assert.equal(summary.updatedCaseCount, 0);
  assert.equal(shouldTriggerRetestDeploy({ updatedCaseCount: summary.updatedCaseCount, ...SITE_DB }), false);
});

/**
 * 写成功 ≠ 站上有变化：verdict 落进 case_retests 但算不出分数、或站上没发布
 * 这条 Case 时，公开页面一个字没变，白跑一次全量构建没意义。
 */
test("写成功但没改到已发布 Case 的行不计入部署判定", async () => {
  const summary = await applyVerdictBatch({
    entries: entriesOf("case-a", "case-unpublished"),
    applyEntry: async (entry) => ({
      slug: entry.slug,
      caseUpdated: entry.slug === "case-a",
      message: entry.slug === "case-a" ? "stability_score=100" : "站上没有已发布 Case",
    }),
  });

  assert.equal(summary.successCount, 2);
  assert.equal(summary.updatedCaseCount, 1);
  assert.equal(shouldTriggerRetestDeploy({ updatedCaseCount: summary.updatedCaseCount, ...SITE_DB }), true);
});
