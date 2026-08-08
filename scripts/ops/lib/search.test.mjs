import assert from "node:assert/strict";
import test from "node:test";
import {
  getSearchMatch,
  getSearchSnippet,
  rankSearchResults,
  splitHighlightedText,
} from "../../../src/lib/search.ts";

test("weighted search ranks title matches ahead of prompt-only matches", () => {
  const results = rankSearchResults(
    [
      { title: "A quiet poster", prompt: "Use a red identity anchor" },
      { title: "Identity reference sheet", prompt: "Keep the subject fixed" },
    ],
    "identity",
    (item) => [
      { key: "title", value: item.title, weight: 140 },
      { key: "prompt", value: item.prompt, weight: 40 },
    ]
  );
  assert.equal(results[0].item.title, "Identity reference sheet");
  assert.equal(results[0].match.field, "title");
});

test("search exposes a compact hit snippet and highlight parts", () => {
  const match = getSearchMatch(
    [{ key: "prompt", value: "A very long prompt with a stable character reference sheet near the end.", weight: 40 }],
    "reference sheet"
  );
  assert.ok(match);
  assert.match(getSearchSnippet(match, "reference sheet", 48), /reference sheet/);
  assert.deepEqual(splitHighlightedText("Keep the reference sheet stable", "reference sheet"), [
    { text: "Keep the ", matched: false },
    { text: "reference sheet", matched: true },
    { text: " stable", matched: false },
  ]);
});

test("cross-field multi-word query hits when tokens split across fields", () => {
  // 「模型 + 主题」的自然查法：veo 只在 model 字段，猫咪只在 title 字段，
  // 没有任何一个字段自己就包含全部 token，但结果整体应该命中。
  const fields = [
    { key: "title", value: "猫咪水墨动画", weight: 140 },
    { key: "model", value: "Veo 3", weight: 88 },
  ];
  const match = getSearchMatch(fields, "veo 猫咪");
  assert.ok(match, "expected a cross-field union match, got null");
  // 两个字段都只是部分命中，展示字段退化为分数最高的那个（权重更高的 title）。
  assert.equal(match.field, "title");
});

test("a token with no owner in any field makes the whole result miss", () => {
  // 「veo」在 model 字段命中，但「恐龙」在任何字段都找不到——
  // 整体应该判定为不命中，而不是把没有归属的 token 悄悄忽略掉。
  const fields = [
    { key: "title", value: "猫咪水墨动画", weight: 140 },
    { key: "model", value: "Veo 3", weight: 88 },
  ];
  const match = getSearchMatch(fields, "veo 恐龙");
  assert.equal(match, null);
});

test("a field that alone covers every token is preferred as the display field", () => {
  // tag 字段权重很低，但它自己就包含全部 token（完整覆盖），应该优先于
  // title / model 这两个只覆盖部分 token、但字段权重更高的字段。
  const fields = [
    { key: "title", value: "猫咪水墨动画", weight: 140 },
    { key: "model", value: "Veo 3", weight: 88 },
    { key: "tag", value: "veo 猫咪", weight: 20 },
  ];
  const match = getSearchMatch(fields, "veo 猫咪");
  assert.ok(match);
  assert.equal(match.field, "tag");
});

test("Chinese model alias expands to hit English-named data (千问→Qwen)", () => {
  // aimap 等外部入口按中文实体名跳转 /cases?q=千问，库内数据写的是英文
  // 模型名。同义词组扩展后中文查询应命中，且排序、片段、高亮同样生效。
  const fields = [
    { key: "title", value: "Qwen Image 海报设计", weight: 140 },
    { key: "model", value: "Qwen Image", weight: 88 },
  ];
  const match = getSearchMatch(fields, "千问");
  assert.ok(match, "expected 千问 to match Qwen via alias expansion, got null");
  assert.equal(match.field, "title");
});

test("alias expansion works for extra synonym groups (智谱→GLM, 可灵→Kling)", () => {
  const glm = getSearchMatch(
    [{ key: "model", value: "ChatGLM 4", weight: 88 }],
    "智谱"
  );
  assert.ok(glm, "expected 智谱 to match ChatGLM");
  const kling = getSearchMatch(
    [{ key: "model", value: "Kling 2.5", weight: 88 }],
    "可灵"
  );
  assert.ok(kling, "expected 可灵 to match Kling");
});

test("alias-expanded token cooperates with plain tokens across fields", () => {
  // 「千问 海报」：千问经别名命中 model 字段的 Qwen，海报命中 title 字段，
  // 跨字段并集判定应该整体命中。
  const fields = [
    { key: "title", value: "极简风格海报", weight: 140 },
    { key: "model", value: "Qwen Image", weight: 88 },
  ];
  const match = getSearchMatch(fields, "千问 海报");
  assert.ok(match, "expected cross-field match with alias token, got null");
});

test("alias expansion is exact-term only and does not fuzz specific queries", () => {
  // 「qwen3」比组内词更具体，不该被扩展；数据里没有 qwen3 就该落空。
  const match = getSearchMatch(
    [{ key: "model", value: "千问海报模板", weight: 88 }],
    "qwen3"
  );
  assert.equal(match, null);
});

test("snippet and highlight follow the alias variant that actually hit", () => {
  const match = getSearchMatch(
    [
      {
        key: "prompt",
        value:
          "A very long prompt describing the workflow in detail before mentioning Qwen Image near the end of the text.",
        weight: 40,
      },
    ],
    "千问"
  );
  assert.ok(match);
  assert.match(getSearchSnippet(match, "千问", 48), /qwen/i);
  const parts = splitHighlightedText("Qwen Image 出图流程", "千问");
  assert.deepEqual(
    parts.find((part) => part.matched)?.text,
    "Qwen"
  );
});
