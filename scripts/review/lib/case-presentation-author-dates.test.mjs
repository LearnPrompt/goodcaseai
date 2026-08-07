import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCardPublishedDate,
  pickLatestAuthorDate,
} from "../../../src/lib/case-presentation.ts";

// creator / skill 的「最近作品 / 最近例证」只展示作者侧时间，绝不展示我们的
// 编辑/收录时间。这里锁定：sourcePublishedAt 优先、缺失时才退 createdAt、
// 取一批案例里最新的一条、一条可用日期都没有时返回 null（不是占位字符串）。

test("formatCardPublishedDate 按 locale 输出 YYYY/MM/DD 风格，和卡片 chip 一致", () => {
  const value = "2026-05-16T18:26:21.000000Z";
  assert.equal(formatCardPublishedDate(value, "zh-CN"), "2026/05/17");
  assert.equal(formatCardPublishedDate(value, "en"), "05/17/2026");
});

test("formatCardPublishedDate 空值 / 非法日期返回 null", () => {
  assert.equal(formatCardPublishedDate(undefined, "zh-CN"), null);
  assert.equal(formatCardPublishedDate(null, "zh-CN"), null);
  assert.equal(formatCardPublishedDate("not-a-date", "zh-CN"), null);
});

test("pickLatestAuthorDate 优先用 sourcePublishedAt，取一批案例里最新的一条", () => {
  const items = [
    { sourcePublishedAt: "2026-04-08T05:14:10.000000Z" },
    { sourcePublishedAt: "2026-05-16T18:26:21.000000Z" },
    { sourcePublishedAt: "2026-05-10T17:13:15.000000Z" },
  ];
  assert.equal(pickLatestAuthorDate(items, "zh-CN"), "2026/05/17");
});

test("pickLatestAuthorDate 缺 sourcePublishedAt 时按案例退到 createdAt，不整批退化", () => {
  const items = [
    { sourcePublishedAt: "2026-04-08T05:14:10.000000Z" },
    { createdAt: "2026-06-01T00:00:00.000000Z" },
  ];
  // 第二条没有 sourcePublishedAt，退它自己的 createdAt；
  // 两条比较后 createdAt 那条更新，应该胜出——退化是逐条的，不是整批一刀切。
  assert.equal(pickLatestAuthorDate(items, "zh-CN"), "2026/06/01");
});

test("pickLatestAuthorDate 一条可用日期都没有时返回 null，不是占位字符串", () => {
  assert.equal(pickLatestAuthorDate([], "zh-CN"), null);
  assert.equal(
    pickLatestAuthorDate([{}, { sourcePublishedAt: "" }], "zh-CN"),
    null
  );
});

test("pickLatestAuthorDate 忽略非法日期字符串，不让它污染比较", () => {
  const items = [
    { sourcePublishedAt: "not-a-date" },
    { sourcePublishedAt: "2026-05-10T17:13:15.000000Z" },
  ];
  assert.equal(pickLatestAuthorDate(items, "zh-CN"), "2026/05/11");
});
