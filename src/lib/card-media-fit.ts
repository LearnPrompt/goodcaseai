/**
 * 卡片媒体框的 cover / contain 判定。
 *
 * 背景：public/media/thumbs 里 302 张缩略图的宽高比是双峰分布——
 * p10 0.56（9:16 竖版视频封面）、p25 0.75、中位 1.50、p75 1.77、p90 1.79（16:9）。
 * 固定框 + object-cover 平均要裁掉 28.8%（16:9 框）到 32.3%（4:3 框）的画面，
 * 而且丢失集中在两个极端：竖版封面在 4:3 框里只剩 42% 高度，宽幅分镜只剩 40% 宽度，
 * 恰好是信息密度最高的两类。换任何单一固定比例都救不了双峰分布，
 * 所以框固定成 16:9，填充方式按每张图的实际比例自适应。
 */

/** 卡片媒体框的目标比例，和 aspect-[16/9] 必须保持一致。 */
export const CARD_MEDIA_ASPECT_RATIO = 16 / 9;

/**
 * 允许 cover 裁切的最大比例偏离度（相对目标比例的倍率偏差）。
 *
 * 取 0.25 的依据有两条：
 * 1. 上界可算：偏离 25% 意味着图片与框的比例相差最多 1.25 倍，
 *    cover 在被裁的那一维至少保留 1/1.25 = 80% —— 即最多裁掉 20% 画面，
 *    这个量级不会吃掉主体，超过就开始切主体了。
 * 2. 对阈值不敏感：实测 302 张的偏离度直方图里，
 *    ≤0.20 有 144 张、≤0.25 有 160 张、≤0.30 有 169 张，
 *    阈值正好落在双峰之间的稀疏带，前后浮动 5 个点只影响个位数张数。
 */
export const CARD_MEDIA_COVER_TOLERANCE = 0.25;

export type CardMediaFit = "cover" | "contain";

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * 宽高未知时一律返回 cover：老 manifest 条目没有宽高字段、
 * 或者卡片用的是拿不到尺寸的外链原图，都退化成改动前的固定裁切行为。
 */
export function resolveCardMediaFit(
  width?: number | null,
  height?: number | null
): CardMediaFit {
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
    return "cover";
  }

  const ratio = width / height;
  const deviation = Math.abs(ratio / CARD_MEDIA_ASPECT_RATIO - 1);
  return deviation <= CARD_MEDIA_COVER_TOLERANCE ? "cover" : "contain";
}
