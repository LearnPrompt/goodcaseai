import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDecisions,
  storageKeyForReport,
} from "./review-decisions.mjs";

test("storageKeyForReport pins decisions to one review batch", () => {
  assert.equal(
    storageKeyForReport({
      runDate: "2026-07-28",
      generatedAt: "2026-07-28T01:02:03.000Z",
    }),
    "goodcase-source-review:2026-07-28:2026-07-28T01:02:03.000Z"
  );
});

test("normalizeDecisions accepts exact in-range review decisions", () => {
  assert.deepEqual(
    normalizeDecisions(
      {
        1: "include",
        2: "seed",
        3: "reject",
      },
      3
    ),
    {
      1: "include",
      2: "seed",
      3: "reject",
    }
  );
});

test("normalizeDecisions rejects malformed or out-of-range decisions", () => {
  assert.throws(() => normalizeDecisions([], 3), /格式无效/);
  assert.throws(() => normalizeDecisions({ 0: "include" }, 3), /审核决定无效/);
  assert.throws(() => normalizeDecisions({ 4: "include" }, 3), /审核决定无效/);
  assert.throws(() => normalizeDecisions({ 1: "maybe" }, 3), /审核决定无效/);
});
