import test from "node:test";
import assert from "node:assert/strict";
import {
  averageMeasuredStability,
  formatStabilityScore,
  hasMeasuredStability,
} from "../../../src/lib/stability.ts";

test("unmeasured stability renders as a compact pending placeholder", () => {
  assert.equal(hasMeasuredStability(0), false);
  assert.equal(hasMeasuredStability(null), false);
  assert.equal(formatStabilityScore(0), "待复测");
  assert.equal(formatStabilityScore(undefined), "待复测");
});

test("measured stability keeps the existing numeric display", () => {
  assert.equal(hasMeasuredStability(91), true);
  assert.equal(formatStabilityScore(91), "91");
});

test("averages ignore unmeasured zero values", () => {
  assert.equal(averageMeasuredStability([0, 90, 92]), 91);
  assert.equal(averageMeasuredStability([0, null, undefined]), null);
});
