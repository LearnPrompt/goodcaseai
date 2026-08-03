import test from "node:test";
import assert from "node:assert/strict";
import {
  averageMeasuredStability,
  formatStabilityScore,
  hasMeasuredStability,
} from "../../../src/lib/stability.ts";

test("unmeasured stability invites a retest vote instead of showing a score", () => {
  assert.equal(hasMeasuredStability(0), false);
  assert.equal(hasMeasuredStability(null), false);
  assert.equal(formatStabilityScore(0), "投票催复测");
  assert.equal(formatStabilityScore(undefined), "投票催复测");
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
});

test("averages ignore unmeasured zero values", () => {
  assert.equal(averageMeasuredStability([0, 90, 92]), 91);
  assert.equal(averageMeasuredStability([0, null, undefined]), null);
});
