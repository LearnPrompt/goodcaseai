export const VERDICT_SCORES = Object.freeze({
  reproduced: 100,
  degraded: 50,
  failed: 0,
});

export const VALID_VERDICTS = Object.freeze([
  "reproduced",
  "degraded",
  "failed",
  "inconclusive",
]);

function sortNewestFirst(left, right) {
  const timeDiff = new Date(right.tested_at || 0).getTime() - new Date(left.tested_at || 0).getTime();
  return timeDiff || Number(right.id || 0) - Number(left.id || 0);
}
export function buildVerdictUpdate({ verdict, notes, operator }) {
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(`verdict 必须是 ${VALID_VERDICTS.join(" / ")} 之一。`);
  }
  const cleanNotes = typeof notes === "string" ? notes.trim() : "";
  const cleanOperator = typeof operator === "string" ? operator.trim() : "";
  if (!cleanNotes) throw new Error("人工 verdict 必须填写 notes，说明对照结果和判断依据。");
  if (!cleanOperator) throw new Error("人工 verdict 必须填写 operator，记录是谁做的判断。");

  return {
    verdict,
    notes: cleanNotes,
    operator: cleanOperator,
  };
}

export function selectLatestConclusiveVerdict(rows = []) {
  return [...rows]
    .filter((row) => Object.hasOwn(VERDICT_SCORES, row?.verdict))
    .sort(sortNewestFirst)[0] || null;
}

/**
 * inconclusive 只留下人审记录，不把已有稳定分冲成未知。
 * 没有任何有效人审时返回 null，调用方应保持当前 cases.stability_score 不变。
 */
export function buildCaseStabilityPatch(rows = []) {
  const latest = selectLatestConclusiveVerdict(rows);
  return latest
    ? { stability_score: VERDICT_SCORES[latest.verdict], evidence_level: "L2" }
    : null;
}
