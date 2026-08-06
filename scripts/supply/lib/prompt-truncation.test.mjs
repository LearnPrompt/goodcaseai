import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_LEAD_IN_ALLOWANCE,
  detectPromptCapTruncation,
  endsAtSentenceBoundary,
  truncationTags,
  UPSTREAM_PROMPT_CAP,
} from "./prompt-truncation.mjs";

/** 拼一段刚好 `length` 个字符、以 `tail` 收尾的 prompt。 */
function promptOfLength(length, tail) {
  const body = "cinematic handheld shot of a city street, ".repeat(400);
  const filled = body.slice(0, length - tail.length) + tail;
  assert.equal(filled.length, length);
  return filled;
}

test("落在 3000 截断带内且没有收尾标点 → 报截断嫌疑", () => {
  // 真实样本 seedance-2-0-181cb461432f：库里 2928 字符，
  // 原推里被剥掉的引导语 72 字符，72 + 2928 = 3000 正好是上游下刀的位置。
  const check = detectPromptCapTruncation(
    promptOfLength(2928, "Black ice cubes and red bottle cap float a")
  );

  assert.equal(check.suspected, true);
  assert.equal(check.length, 2928);
  assert.equal(check.nearCap, true);
  assert.equal(check.endsAtSentenceBoundary, false);
  assert.match(check.reason, /疑似被来源站截断/);
  assert.deepEqual(truncationTags(check), ["prompt-maybe-truncated"]);
});

test("落在截断带内但收在句末标点上 → 不报（压误报）", () => {
  // 真实样本 case-e53b614b0f42（2750 字符）和 case-a9ab0266f96a（2833 字符，日文），
  // 人工判定都是 complete，靠的就是这道收尾标点闸门。
  const english = detectPromptCapTruncation(
    promptOfLength(2750, "Premium luxury logo animation. Fade to black.")
  );
  const japanese = detectPromptCapTruncation(
    promptOfLength(2833, "そのフレームで即カットする。アクション継続。")
  );

  assert.equal(english.suspected, false);
  assert.equal(english.nearCap, true);
  assert.equal(japanese.suspected, false);
  assert.equal(japanese.nearCap, true);
  assert.deepEqual(truncationTags(english), []);
});

test("离 3000 很远的 prompt 一律不报，哪怕结尾没标点", () => {
  // 样本里 100 / 107 / 1140 字符这三条结尾都没标点，人工判定全是 complete。
  // 短 prompt 结尾不带标点太常见，单靠形态学判据会淹死人。
  const short = detectPromptCapTruncation("a city that never sleeps");
  // 7739 字符那条确实也是截断的，但它是「原推有多段、youmind 只收了一段」，
  // 不是 3000 字符截断带这个根因，不归这个检测器管。
  const long = detectPromptCapTruncation(
    promptOfLength(7739, "diagonal sweep - the pack pours")
  );

  assert.equal(short.suspected, false);
  assert.equal(short.nearCap, false);
  assert.equal(long.suspected, false);
  assert.equal(long.nearCap, false);
});

test("嫌疑区间就是 [cap - 引导语余量, cap]，边界含端点", () => {
  assert.equal(UPSTREAM_PROMPT_CAP, 3000);
  assert.equal(CAP_LEAD_IN_ALLOWANCE, 300);

  const lower = detectPromptCapTruncation(promptOfLength(2700, "street,"));
  const belowLower = detectPromptCapTruncation(promptOfLength(2699, "street,"));
  const upper = detectPromptCapTruncation(promptOfLength(3000, "street,"));
  const aboveUpper = detectPromptCapTruncation(promptOfLength(3001, "street,"));

  assert.equal(lower.suspected, true);
  assert.equal(belowLower.suspected, false);
  assert.equal(upper.suspected, true);
  assert.equal(aboveUpper.suspected, false);
});

test("endsAtSentenceBoundary 认成对符号的右半边，也吃掉尾部空白和字面量 \\n", () => {
  assert.equal(endsAtSentenceBoundary("拍完直接黑场。"), true);
  assert.equal(endsAtSentenceBoundary('he says "cut it".'), true);
  assert.equal(endsAtSentenceBoundary("…and says: '啊——爽！'"), true);
  assert.equal(endsAtSentenceBoundary("fade to black.  \n\n"), true);
  assert.equal(endsAtSentenceBoundary("fade to black.\\n"), true);
  assert.equal(endsAtSentenceBoundary("no duplicate people,"), false);
  assert.equal(endsAtSentenceBoundary("cards flying awa"), false);
  assert.equal(endsAtSentenceBoundary(""), false);
  assert.equal(endsAtSentenceBoundary(null), false);
});

test("空 prompt 和 null 不报嫌疑", () => {
  assert.equal(detectPromptCapTruncation("").suspected, false);
  assert.equal(detectPromptCapTruncation(null).length, 0);
  assert.equal(detectPromptCapTruncation(undefined).suspected, false);
});
