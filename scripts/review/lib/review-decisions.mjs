const DECISION_VALUES = new Set(["include", "seed", "reject"]);

export function storageKeyForReport(report) {
  return `goodcase-source-review:${report.runDate}:${report.generatedAt}`;
}

export function normalizeDecisions(value, total) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("审核决定格式无效");
  }

  const decisions = {};
  for (const [rawIndex, decision] of Object.entries(value)) {
    const index = Number(rawIndex);
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > total ||
      !DECISION_VALUES.has(decision)
    ) {
      throw new Error(`审核决定无效：${rawIndex}=${decision}`);
    }
    decisions[String(index)] = decision;
  }
  return decisions;
}
