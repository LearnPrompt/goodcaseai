import test from "node:test";
import assert from "node:assert/strict";
import { formatCompactCount } from "../../../src/lib/format-compact-count.ts";

test("counts under 1000 render as plain integers", () => {
  assert.equal(formatCompactCount(0), "0");
  assert.equal(formatCompactCount(45), "45");
  assert.equal(formatCompactCount(999), "999");
});

test("counts at or above 1000 render with one decimal and a k suffix", () => {
  assert.equal(formatCompactCount(1000), "1k");
  assert.equal(formatCompactCount(2300), "2.3k");
  assert.equal(formatCompactCount(6471), "6.5k");
  assert.equal(formatCompactCount(5000), "5k");
});

test("non-finite or negative input degrades safely instead of throwing", () => {
  assert.equal(formatCompactCount(Number.NaN), "0");
  assert.equal(formatCompactCount(-5), "0");
});

test("fractional input is rounded before formatting", () => {
  assert.equal(formatCompactCount(1249.6), "1.3k");
  assert.equal(formatCompactCount(44.6), "45");
});
