import { resolveWriteTargetRef } from "./write-target.mjs";

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

/**
 * 复测回写完要不要触发一次部署。
 *
 * updatedCaseCount 是**这一批**里真正改到已发布 Case 的条数（批量模式下 N 条只
 * 触发一次部署，见 lib/verdict-batch.mjs）。单条模式就是 0 或 1，语义不变。
 *
 * 为什么复测也要触发
 * ------------------
 * 「内容只随部署变」这条模型原来只对发布链路成立：scripts/publish-approved-cases.mjs
 * 和 /operator 的发布动作都会触发 Deploy Hook，复测这条链路却是直接改 Supabase 里
 * 已发布 Case 的 stability_score / evidence_level，一次部署都不触发。而这两个字段
 * 恰好全落在缓存最狠的几个面上：
 *   - /cases/[slug] 是 dynamicParams=false 的构建期产物，不部署就永远是旧分数
 *   - 首页和 /cases 列表 revalidate=86400、CDN-Cache-Control s-maxage=86400
 * 合起来就是「今天判的 verdict，站上最长一天后才看得见」。每日复测是对外卖点，
 * 这个滞后不该靠 ISR 到期兜——补上这一次部署，模型才对复测也成立。
 *
 * 两个不触发的条件
 * ----------------
 * 1. 这一批没有任何已发布 Case 真被改到（verdict 不足以算分，或该 slug 站上没发布）。
 *    库里那些 case_retests 行是写了，但公开页面上一个字都没变，白跑一次部署没意义。
 * 2. 写的不是站点构建时读的那个库。PROD_SUPABASE_URL 按 .env.example 的口径，是
 *    「从生产只读拉数据到本地库」时才配的值，配了就说明当前写入目标八成是本地/测试库。
 *    这时候去戳生产的 Deploy Hook，只会拿没变过的生产数据重建一次生产站，
 *    还在终端上骗人说已经触发过了。
 *    比对走 project ref 而不是字符串：尾斜杠或大小写差一个字符就判成「两个库」，
 *    会把该触发的部署静默吞掉（同 issue #44 里守卫被绕过的那个根因）。
 */
export function shouldTriggerRetestDeploy({
  updatedCaseCount = 0,
  supabaseUrl = "",
  prodSupabaseUrl = "",
} = {}) {
  if (updatedCaseCount <= 0) return false;
  if (prodSupabaseUrl) {
    const targetRef = resolveWriteTargetRef(supabaseUrl);
    const prodRef = resolveWriteTargetRef(prodSupabaseUrl);
    // 两边都认得出来就比 ref，有一边认不出就退回原来的字符串比对。
    const sameTarget = targetRef && prodRef ? targetRef === prodRef : supabaseUrl === prodSupabaseUrl;
    if (!sameTarget) return false;
  }
  return true;
}
