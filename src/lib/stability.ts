// 这个模块被 scripts/review/lib/stability.test.mjs 用纯 node 直接加载，
// 不能引入任何带 "@/" 别名的运行时依赖，所以 locale 类型和文案都在本地定义。
// 同一份文案在 src/i18n/messages.ts 的 stability 组里有一份供组件使用，改动请同步。
type StabilityLocale = "zh-CN" | "en";

export const STABILITY_PENDING_LABEL: Record<StabilityLocale, string> = {
  "zh-CN": "投票催复测",
  en: "Vote to retest",
};

export function hasMeasuredStability(
  score: number | null | undefined
): score is number {
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score > 0 &&
    score <= 100
  );
}

export function formatStabilityScore(
  score: number | null | undefined,
  locale: StabilityLocale = "zh-CN"
) {
  return hasMeasuredStability(score)
    ? String(Math.round(score))
    : STABILITY_PENDING_LABEL[locale];
}

export function averageMeasuredStability(
  scores: Array<number | null | undefined>
) {
  const measured = scores.filter(hasMeasuredStability);
  if (!measured.length) {
    return null;
  }

  return Math.round(
    measured.reduce((sum, score) => sum + score, 0) / measured.length
  );
}
