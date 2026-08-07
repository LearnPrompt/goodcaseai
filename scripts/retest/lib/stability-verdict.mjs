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
 * 证据等级阶梯，从低到高。站上对外口径（src/app/[lang]/llms.txt/route.ts）：
 * 「L2 才代表已有独立复测记录」。
 */
export const EVIDENCE_LEVELS = Object.freeze(["L0", "L1", "L2"]);

/** 复测跑过就是 L2，不管人判成什么——failed 也是一次真实的独立复测。 */
const RETESTED_EVIDENCE_LEVEL = "L2";

/**
 * 证据等级只升不降。
 *
 * 原来所有档位都无条件写死 "L2"，等于让复测脚本单方面决定证据等级。
 * 现在改成取阶梯上的较高者：认不出来的等级（历史值、将来加的 L3）一律保持原样，
 * 不被这次复测冲掉。
 */
export function resolveEvidenceLevel(currentLevel) {
  const currentIndex = EVIDENCE_LEVELS.indexOf(currentLevel);
  const retestedIndex = EVIDENCE_LEVELS.indexOf(RETESTED_EVIDENCE_LEVEL);
  if (currentIndex === -1) {
    // 不在已知阶梯上：可能是脏数据，也可能是比 L2 更高的新档位。
    // 两种情况下"不动它"都比"降级成 L2"安全，留给人处理。
    return currentLevel ?? RETESTED_EVIDENCE_LEVEL;
  }
  return currentIndex >= retestedIndex ? currentLevel : RETESTED_EVIDENCE_LEVEL;
}

/**
 * inconclusive 只留下人审记录，不把已有稳定分冲成未知。
 * 没有任何有效人审时返回 null，调用方应保持当前 cases.stability_score 不变。
 *
 * 为什么 failed 也写 evidence_level
 * ---------------------------------
 * cases.stability_score 在库里是 `int not null default 0`，从来没测过的案例
 * 落库就是 0。所以 failed 写进去的这个 0 单看分数和「没测过」完全一样。
 * 站上靠 evidence_level === "L2" 把两者分开（见 src/lib/stability.ts）：
 * L2 + 0 分 = 测过没通过，非 L2 + 0 分 = 还没测。
 * 这时候如果按「失败就别升级证据等级」处理，反而把唯一的判别位抹掉，
 * 让复测未通过的案例继续在站上显示「投票催复测」——正是要修的那个 bug。
 * 真正要防的是**降级**，由 resolveEvidenceLevel 兜住。
 */
export function buildCaseStabilityPatch(rows = [], currentEvidenceLevel) {
  const latest = selectLatestConclusiveVerdict(rows);
  if (!latest) return null;

  return {
    stability_score: VERDICT_SCORES[latest.verdict],
    evidence_level: resolveEvidenceLevel(currentEvidenceLevel),
  };
}
