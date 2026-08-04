import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_MEDIA_ASPECT_RATIO,
  CARD_MEDIA_COVER_TOLERANCE,
  resolveCardMediaFit,
} from "../../../src/lib/card-media-fit.ts";
import { parseImageSize } from "../../media/build-thumbnails.mjs";

/**
 * 卡片媒体框是固定 16:9，填充方式按每张缩略图的实际比例走：
 * 偏离小的 cover 填满，偏离大的 contain 完整显示、纸色底当留白。
 * 判错的代价是可见的——竖版封面被 cover 只剩 42% 高度，正好是信息最密的那类，
 * 所以这里把边界、退化路径和脏数据都钉死。
 */

test("目标比例就是 16:9，容差是 25%（改了要同步 aspect-[16/9]）", () => {
  assert.equal(CARD_MEDIA_ASPECT_RATIO, 16 / 9);
  assert.equal(CARD_MEDIA_COVER_TOLERANCE, 0.25);
});

test("正好 16:9 用 cover", () => {
  assert.equal(resolveCardMediaFit(1600, 900), "cover");
  assert.equal(resolveCardMediaFit(400, 225), "cover");
});

test("竖版 9:16 视频封面用 contain，不再被裁掉一半", () => {
  assert.equal(resolveCardMediaFit(900, 1600), "contain");
  // 实测样本里的 p10 附近：0.56
  assert.equal(resolveCardMediaFit(400, 712), "contain");
});

test("超宽分镜 / 拼贴用 contain", () => {
  assert.equal(resolveCardMediaFit(400, 100), "contain");
});

test("4:3、3:2、1:1 这些常见比例按容差各归各位", () => {
  // 4:3 ≈ 1.333，相对 16:9 偏离 25%，正好压线，仍算 cover
  assert.equal(resolveCardMediaFit(400, 300), "cover");
  // 3:2 = 1.5，偏离 15.6%
  assert.equal(resolveCardMediaFit(400, 267), "cover");
  // 1:1 偏离 43.75%
  assert.equal(resolveCardMediaFit(400, 400), "contain");
});

test("边界：容差两侧各差 1% 就分成 cover / contain", () => {
  const target = CARD_MEDIA_ASPECT_RATIO;
  const low = target * (1 - CARD_MEDIA_COVER_TOLERANCE);
  const high = target * (1 + CARD_MEDIA_COVER_TOLERANCE);
  // 界内（浮点边界本身不测，真实输入都是整数像素，压线是零测度事件）
  assert.equal(resolveCardMediaFit(low * 1.01 * 1000, 1000), "cover");
  assert.equal(resolveCardMediaFit(high * 0.99 * 1000, 1000), "cover");
  // 界外
  assert.equal(resolveCardMediaFit(low * 0.99 * 1000, 1000), "contain");
  assert.equal(resolveCardMediaFit(high * 1.01 * 1000, 1000), "contain");
});

test("拿不到宽高时退化成 cover，不报错（老 manifest 条目、外链原图）", () => {
  assert.equal(resolveCardMediaFit(undefined, undefined), "cover");
  assert.equal(resolveCardMediaFit(400, undefined), "cover");
  assert.equal(resolveCardMediaFit(undefined, 400), "cover");
  assert.equal(resolveCardMediaFit(null, null), "cover");
});

test("宽高是脏数据时也退化成 cover，不产生 NaN 判定", () => {
  assert.equal(resolveCardMediaFit(0, 0), "cover");
  assert.equal(resolveCardMediaFit(-400, 225), "cover");
  assert.equal(resolveCardMediaFit(Number.NaN, 225), "cover");
  assert.equal(resolveCardMediaFit(Infinity, 225), "cover");
  assert.equal(resolveCardMediaFit("400", "225"), "cover");
});

test("parseImageSize 解析 sips 输出，缺字段返回 null", () => {
  assert.deepEqual(
    parseImageSize(
      "/x/y.jpg\n  pixelWidth: 400\n  pixelHeight: 225\n"
    ),
    { width: 400, height: 225 }
  );
  assert.equal(parseImageSize("/x/y.jpg\n  pixelWidth: 400\n"), null);
  assert.equal(parseImageSize(""), null);
});

test("sips 量到的尺寸能直接喂给判定，两端接得上", () => {
  const size = parseImageSize("/x/y.jpg\n  pixelWidth: 400\n  pixelHeight: 711\n");
  assert.equal(resolveCardMediaFit(size.width, size.height), "contain");
});

test("web 分类容差收紧到 0.10：11% 偏离判 contain，同样偏离的 video 仍判 cover（线上真实案例：落地页截图偏离 11%，旧的全局 0.25 容差下走 cover 把标题啃掉一行）", () => {
  const target = CARD_MEDIA_ASPECT_RATIO;
  const width = 1000;
  const height = width / (target * 1.11); // 相对 16:9 偏离 11%
  assert.equal(resolveCardMediaFit(width, height, "web"), "contain");
  assert.equal(resolveCardMediaFit(width, height, "video"), "cover");
});

test("分类拿不到（缺省 / null / 未知字符串）时退化到默认容差 0.25，不抛错", () => {
  const target = CARD_MEDIA_ASPECT_RATIO;
  const width = 1000;
  const height = width / (target * 1.11); // 11% 偏离：超过 web 的 0.10，仍在默认 0.25 内
  assert.equal(resolveCardMediaFit(width, height), "cover");
  assert.equal(resolveCardMediaFit(width, height, null), "cover");
  assert.equal(resolveCardMediaFit(width, height, "unknown-category"), "cover");
});
