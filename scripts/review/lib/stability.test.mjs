import test from "node:test";
import assert from "node:assert/strict";
import {
  averageMeasuredStability,
  formatAggregateStability,
  formatStabilityScore,
  hasMeasuredStability,
  isFailedRetest,
  measuredStabilityValue,
  resolveStabilityState,
} from "../../../src/lib/stability.ts";

test("unmeasured stability invites a retest vote instead of showing a score", () => {
  assert.equal(hasMeasuredStability(0), false);
  assert.equal(hasMeasuredStability(null), false);
  assert.equal(formatStabilityScore(0), "投票催复测");
  assert.equal(formatStabilityScore(undefined), "投票催复测");
  assert.equal(resolveStabilityState(0), "pending");
  assert.equal(resolveStabilityState(null), "pending");
});

test("unmeasured stability follows the requested locale", () => {
  assert.equal(formatStabilityScore(0, "zh-CN"), "投票催复测");
  assert.equal(formatStabilityScore(0, "en"), "Vote to retest");
  assert.equal(formatStabilityScore(null, "en"), "Vote to retest");
});

test("measured stability keeps the existing numeric display in both locales", () => {
  assert.equal(hasMeasuredStability(91), true);
  assert.equal(formatStabilityScore(91), "91");
  assert.equal(formatStabilityScore(91, "en"), "91");
  assert.equal(resolveStabilityState(91, "L1"), "measured");
});

/**
 * 库里 stability_score 是 `int not null default 0`，没测过的案例落库就是 0，
 * 所以 0 分本身说明不了任何事。判别位是 evidence_level：站上对外口径里
 * L2 才代表存在独立复测记录。
 */
test("零分只有配上 L2 才算复测未通过，否则仍是没测过", () => {
  assert.equal(isFailedRetest(0, "L2"), true);
  assert.equal(resolveStabilityState(0, "L2"), "failed");
  assert.equal(formatStabilityScore(0, "zh-CN", "L2"), "复测未通过");
  assert.equal(formatStabilityScore(0, "en", "L2"), "Failed retest");

  for (const level of ["L0", "L1", undefined, null]) {
    assert.equal(isFailedRetest(0, level), false);
    assert.equal(resolveStabilityState(0, level), "pending");
    assert.equal(formatStabilityScore(0, "zh-CN", level), "投票催复测");
  }
});

test("L2 只在零分时才意味着失败，实测分照常显示数字", () => {
  assert.equal(resolveStabilityState(88, "L2"), "measured");
  assert.equal(formatStabilityScore(88, "zh-CN", "L2"), "88");
});

test("复测未通过进「有实测分」桶按 0 计，没测过返回 null", () => {
  assert.equal(measuredStabilityValue(0, "L2"), 0);
  assert.equal(measuredStabilityValue(0, "L1"), null);
  assert.equal(measuredStabilityValue(null, "L2"), null);
  assert.equal(measuredStabilityValue(91, "L1"), 91);
});

test("均分把复测未通过按 0 计入，把没测过跳过", () => {
  // 已经过 measuredStabilityValue 解析：0 是真实结论，null 是没测过。
  assert.equal(averageMeasuredStability([0, 90, 92]), 61);
  assert.equal(averageMeasuredStability([null, 90, 92]), 91);
  assert.equal(averageMeasuredStability([null, undefined]), null);
  assert.equal(averageMeasuredStability([0]), 0);
});

test("聚合值的 0 直接显示数字，只有 null 才退回催复测文案", () => {
  // 作者均分为 0 表示「这个作者的实测全挂了」，是真实结果，不是占位分。
  assert.equal(formatAggregateStability(0), "0");
  assert.equal(formatAggregateStability(61, "en"), "61");
  assert.equal(formatAggregateStability(null), "投票催复测");
  assert.equal(formatAggregateStability(undefined, "en"), "Vote to retest");
});
