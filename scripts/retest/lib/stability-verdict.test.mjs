import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCaseStabilityPatch,
  buildVerdictUpdate,
  selectLatestConclusiveVerdict,
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
  assert.deepEqual(buildCaseStabilityPatch(rows), { stability_score: 50, evidence_level: "L2" });
});

test("inconclusive-only retests do not erase an existing score", () => {
  assert.equal(buildCaseStabilityPatch([{ verdict: "inconclusive" }]), null);
});
