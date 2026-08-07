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
