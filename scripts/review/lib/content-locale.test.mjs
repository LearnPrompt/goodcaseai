import test from "node:test";
import assert from "node:assert/strict";
import {
  cjkRatio,
  describeLocaleMismatch,
  detectLocale,
  resolveContentLocale,
  similarity,
} from "./content-locale.mjs";

const ENGLISH_PROMPT =
  "A cinematic wide shot of a lone astronaut walking across a red dune at golden hour, " +
  "shot on 35mm film, shallow depth of field, volumetric light, photorealistic.";

const CHINESE_PROMPT =
  "电影感广角镜头，一名宇航员在黄昏时分独自穿越红色沙丘，35mm 胶片质感，浅景深，体积光，照片级真实。";

test("纯英文 Prompt 判为 en", () => {
  assert.equal(detectLocale(ENGLISH_PROMPT), "en");
  assert.equal(cjkRatio(ENGLISH_PROMPT), 0);
});

test("纯中文 Prompt 判为 zh-CN", () => {
  assert.equal(detectLocale(CHINESE_PROMPT), "zh-CN");
  assert.ok(cjkRatio(CHINESE_PROMPT) > 0.15);
});

test("中英混排里中文占主体时判为 zh-CN", () => {
  const mixed = "生成一张赛博朋克风格的城市夜景，风格参考 Blade Runner，比例 16:9，画质 ultra detailed。";
  assert.ok(cjkRatio(mixed) > 0.15);
  assert.equal(detectLocale(mixed), "zh-CN");
});

test("英文 Prompt 夹少量中文注释仍判为 en", () => {
  const annotated = `${ENGLISH_PROMPT}\n\n（备注：换模型）`;
  assert.ok(cjkRatio(annotated) < 0.15);
  assert.equal(detectLocale(annotated), "en");
});

test("中文标点不计入分母，不会把英文 Prompt 拉成中文", () => {
  const punctuated =
    "Generate a poster，with bold typography。「centered」and a minimal grid layout；no gradients！";
  assert.equal(cjkRatio(punctuated), 0);
  assert.equal(detectLocale(punctuated), "en");
});

test("空值不抛错，按无中日文字符处理", () => {
  for (const empty of ["", null, undefined]) {
    assert.equal(cjkRatio(empty), 0);
    assert.equal(detectLocale(empty), "en");
  }
  assert.equal(resolveContentLocale(null), "en");
  assert.equal(resolveContentLocale({}), "en");
});

test("日文假名同样算作 CJK", () => {
  assert.equal(detectLocale("かわいい猫のイラストを生成して"), "zh-CN");
});

test("阈值口径：15% 以下不算中文", () => {
  // 17 个 ASCII 字母配 3 个汉字 = 15%，正好卡在阈值上，按定义不算中文。
  assert.equal(cjkRatio(`${"a".repeat(17)}中文字`), 0.15);
  assert.equal(detectLocale(`${"a".repeat(17)}中文字`), "en");
  assert.equal(detectLocale(`${"a".repeat(16)}中文字`), "zh-CN");
});

test("候选显式带了合法 content_locale 就尊重它", () => {
  assert.equal(
    resolveContentLocale({ content_locale: "zh-CN", prompt_full: ENGLISH_PROMPT }),
    "zh-CN"
  );
  assert.equal(
    resolveContentLocale({ content_locale: "en", prompt_full: CHINESE_PROMPT }),
    "en"
  );
});

test("没带 content_locale 时按 prompt_full 判定，prompt_preview 兜底", () => {
  assert.equal(resolveContentLocale({ prompt_full: ENGLISH_PROMPT }), "en");
  assert.equal(resolveContentLocale({ prompt_full: CHINESE_PROMPT }), "zh-CN");
  assert.equal(
    resolveContentLocale({ prompt_full: null, prompt_preview: CHINESE_PROMPT }),
    "zh-CN"
  );
});

test("不合法的 content_locale 当作没给，避免写进库违反 check 约束", () => {
  for (const bogus of ["", "  ", "zh", "ZH-CN", "ja", 42, true]) {
    assert.equal(
      resolveContentLocale({ content_locale: bogus, prompt_full: CHINESE_PROMPT }),
      "zh-CN"
    );
  }
});

test("resolveContentLocale 把 null 当作未判定，按正文走", () => {
  // migration 之后候选表的 content_locale 可以是 null，这是刻意的「尚未判定」。
  assert.equal(
    resolveContentLocale({ content_locale: null, prompt_full: ENGLISH_PROMPT }),
    "en"
  );
  assert.equal(
    resolveContentLocale({ content_locale: null, prompt_full: CHINESE_PROMPT }),
    "zh-CN"
  );
});

test("describeLocaleMismatch 只在声明与正文冲突时报警", () => {
  assert.equal(
    describeLocaleMismatch({ content_locale: "en", prompt_full: ENGLISH_PROMPT }),
    null
  );
  assert.equal(
    describeLocaleMismatch({ content_locale: "zh-CN", prompt_full: CHINESE_PROMPT }),
    null
  );

  const mismatch = describeLocaleMismatch({
    content_locale: "zh-CN",
    prompt_full: ENGLISH_PROMPT,
  });
  assert.equal(mismatch.declared, "zh-CN");
  assert.equal(mismatch.detected, "en");
  assert.equal(mismatch.cjkRatio, 0);
});

test("describeLocaleMismatch 在没有依据时保持沉默", () => {
  // 没声明、声明非法、或者根本没正文，都没有可比对的东西，不该刷警告。
  assert.equal(describeLocaleMismatch({ prompt_full: ENGLISH_PROMPT }), null);
  assert.equal(describeLocaleMismatch({ content_locale: null }), null);
  assert.equal(
    describeLocaleMismatch({ content_locale: "ja", prompt_full: ENGLISH_PROMPT }),
    null
  );
  assert.equal(
    describeLocaleMismatch({ content_locale: "zh-CN", prompt_full: "   " }),
    null
  );
  assert.equal(describeLocaleMismatch(null), null);
});

test("similarity 能识别译文等于原文", () => {
  assert.equal(similarity(ENGLISH_PROMPT, ENGLISH_PROMPT), 1);
  assert.ok(similarity(ENGLISH_PROMPT, "完全不同的一段中文描述") < 0.1);
  assert.equal(similarity("", ENGLISH_PROMPT), 0);
});
