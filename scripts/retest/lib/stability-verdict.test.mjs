import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCaseStabilityPatch,
  buildVerdictUpdate,
  resolveEvidenceLevel,
  selectLatestConclusiveVerdict,
  shouldTriggerRetestDeploy,
} from "./stability-verdict.mjs";

test("verdict update requires a human note and operator", () => {
  assert.deepEqual(
    buildVerdictUpdate({ verdict: "reproduced", notes: "结构和主要视觉结果一致", operator: "YC" }),
    { verdict: "reproduced", notes: "结构和主要视觉结果一致", operator: "YC" }
  );
  assert.throws(() => buildVerdictUpdate({ verdict: "reproduced", notes: "", operator: "YC" }), /notes/);
  assert.throws(() => buildVerdictUpdate({ verdict: "unknown", notes: "有记录", operator: "YC" }), /verdict/);
});

test("stability patch uses the newest conclusive verdict", () => {
  const rows = [
    { id: 1, tested_at: "2026-08-01T00:00:00Z", verdict: "reproduced" },
    { id: 2, tested_at: "2026-08-05T00:00:00Z", verdict: "degraded" },
    { id: 3, tested_at: "2026-08-06T00:00:00Z", verdict: "inconclusive" },
  ];
  assert.equal(selectLatestConclusiveVerdict(rows).id, 2);
  assert.deepEqual(buildCaseStabilityPatch(rows, "L1"), {
    stability_score: 50,
    evidence_level: "L2",
  });
});

test("inconclusive-only retests do not erase an existing score", () => {
  assert.equal(buildCaseStabilityPatch([{ verdict: "inconclusive" }], "L1"), null);
});

/**
 * failed 写的 stability_score 是 0，而库里 not null default 0 —— 没测过的案例
 * 也是 0。evidence_level 是站上唯一能把两者分开的判别位（见 src/lib/stability.ts），
 * 所以 failed 也必须把它升到 L2，否则复测未通过的案例会继续显示「投票催复测」。
 */
test("复测未通过同样把证据等级升到 L2，否则站上分不出它和没测过", () => {
  const rows = [{ id: 1, tested_at: "2026-08-05T00:00:00Z", verdict: "failed" }];
  assert.deepEqual(buildCaseStabilityPatch(rows, "L0"), {
    stability_score: 0,
    evidence_level: "L2",
  });
  assert.deepEqual(buildCaseStabilityPatch(rows, "L1"), {
    stability_score: 0,
    evidence_level: "L2",
  });
});

test("证据等级只升不降，认不出来的等级一律保持原值", () => {
  assert.equal(resolveEvidenceLevel("L0"), "L2");
  assert.equal(resolveEvidenceLevel("L1"), "L2");
  assert.equal(resolveEvidenceLevel("L2"), "L2");
  // 将来加的更高档位不能被这次复测冲成 L2。
  assert.equal(resolveEvidenceLevel("L3"), "L3");
  // 脏数据同样不动它，留给人处理。
  assert.equal(resolveEvidenceLevel("weird"), "weird");
  // 完全读不到当前值时才落到 L2——复测确实发生过。
  assert.equal(resolveEvidenceLevel(undefined), "L2");
  assert.equal(resolveEvidenceLevel(null), "L2");
});

test("已经是 L2 的案例复测后不会被改写成别的等级", () => {
  const rows = [{ id: 9, tested_at: "2026-08-07T00:00:00Z", verdict: "reproduced" }];
  assert.deepEqual(buildCaseStabilityPatch(rows, "L3"), {
    stability_score: 100,
    evidence_level: "L3",
  });
});

test("改到了已发布 Case 才触发部署", () => {
  const prodTarget = { supabaseUrl: "https://live.supabase.co" };
  assert.equal(
    shouldTriggerRetestDeploy({ updatedCaseCount: 1, ...prodTarget }),
    true
  );
  // verdict 只落进 case_retests（分数算不出来 / 站上没这条 Case）时公开页面没变化，
  // 不该白跑一次部署。
  assert.equal(
    shouldTriggerRetestDeploy({ updatedCaseCount: 0, ...prodTarget }),
    false
  );
  assert.equal(shouldTriggerRetestDeploy({}), false);
  assert.equal(shouldTriggerRetestDeploy(), false);
});

test("写的是本地测试库时不去戳生产的 Deploy Hook", () => {
  // 配了 PROD_SUPABASE_URL 就说明当前写入目标是本地库（见 .env.example 的口径），
  // apply-verdict 的 assertSafeTarget 也只放行写目标 !== 它的情况。
  assert.equal(
    shouldTriggerRetestDeploy({
      updatedCaseCount: 1,
      supabaseUrl: "http://127.0.0.1:54321",
      prodSupabaseUrl: "https://live.supabase.co",
    }),
    false
  );
  // 没配 PROD_SUPABASE_URL 时写入目标就是站点唯一的库，照常触发。
  assert.equal(
    shouldTriggerRetestDeploy({
      updatedCaseCount: 1,
      supabaseUrl: "https://live.supabase.co",
      prodSupabaseUrl: "",
    }),
    true
  );
});
