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

export function formatStabilityScore(score: number | null | undefined) {
  return hasMeasuredStability(score) ? String(Math.round(score)) : "待复测";
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
