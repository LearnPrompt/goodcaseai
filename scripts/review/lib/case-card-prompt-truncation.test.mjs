import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_PROMPT_EN_CHAR_LIMIT,
  CARD_PROMPT_ZH_CHAR_LIMIT,
  getCaseCardPrompt,
  truncateCardPrompt,
} from "../../../src/lib/case-presentation.ts";

// 阈值本身来自实测（见 case-presentation.ts 里 truncateCardPrompt 上方的注释），
// 这里只锁定当前取值，避免以后有人顺手改了阈值却没意识到会影响卡片截断。
test("compact 提示语的字符预算和实测结果一致", () => {
  assert.equal(CARD_PROMPT_ZH_CHAR_LIMIT, 44);
  assert.equal(CARD_PROMPT_EN_CHAR_LIMIT, 75);
});

test("短提示语不受截断影响", () => {
  const zh = "一位教授在传统黑板上写出三角恒等式的数学证明。";
  const en = "a short prompt that fits easily";
  assert.equal(truncateCardPrompt(zh), zh);
  assert.equal(truncateCardPrompt(en), en);
});

test("超长中文提示语按字符预算截断并收尾省略号", () => {
  const longZh = "测".repeat(120);
  const result = truncateCardPrompt(longZh);
  assert.ok(result.length <= CARD_PROMPT_ZH_CHAR_LIMIT);
  assert.ok(result.endsWith("…"));
  // 前面的字符必须是原文的前缀，不能是别的内容拼出来的。
  assert.ok(longZh.startsWith(result.slice(0, -1)));
});

test("超长英文提示语在最近的单词边界收尾，不砍断单词", () => {
  const longEn =
    "a professional photograph of a modern office desk with natural light and a laptop showing a dashboard, shot from a slightly elevated angle with soft shadows";
  const result = truncateCardPrompt(longEn);
  assert.ok(result.length <= CARD_PROMPT_EN_CHAR_LIMIT);
  assert.ok(result.endsWith("…"));
  const withoutEllipsis = result.slice(0, -1);
  // 掐头去尾后剩下的内容必须仍然是原文里连续出现的完整单词序列。
  assert.ok(longEn.startsWith(withoutEllipsis));
  assert.ok(
    !withoutEllipsis.endsWith(" "),
    "截断结果不应该以空格收尾"
  );
  const cutPoint = withoutEllipsis.length;
  const nextChar = longEn[cutPoint];
  assert.ok(
    nextChar === undefined || nextChar === " ",
    "截断必须发生在单词边界（下一个字符应是空格或已到结尾），不能砍在单词中间"
  );
});

test("中英文各自用不同的可见长度上限", () => {
  const longZh = "测".repeat(200);
  const longEn = "word ".repeat(60);
  assert.ok(truncateCardPrompt(longZh).length <= CARD_PROMPT_ZH_CHAR_LIMIT);
  assert.ok(truncateCardPrompt(longEn).length <= CARD_PROMPT_EN_CHAR_LIMIT);
});

test("getCaseCardPrompt 默认不截断（详情页场景）", () => {
  const longZh = "测".repeat(120);
  const result = getCaseCardPrompt(longZh);
  assert.deepEqual(result, { text: longZh, resourceUrl: null });
});

test("getCaseCardPrompt 传 compact=true 才截断（列表卡片场景）", () => {
  const longZh = "测".repeat(120);
  const result = getCaseCardPrompt(longZh, true);
  assert.ok(result.text !== null);
  assert.ok(result.text.length <= CARD_PROMPT_ZH_CHAR_LIMIT);
  assert.ok(result.text.endsWith("…"));
});

test("compact=true 不影响独立资源链接的识别", () => {
  const url = "https://github.com/example/project";
  const result = getCaseCardPrompt(url, true);
  assert.deepEqual(result, { text: null, resourceUrl: url });
});
