import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublishedDate,
  getCaseCardPrompt,
  getCaseCardSummary,
  getPresentableCaseSummary,
  MISSING_PROMPT_PREVIEW,
} from "../../../src/lib/case-presentation.ts";
import {
  getRelatedCases,
  MISSING_MODEL,
} from "../../../src/lib/related-cases.ts";

const cases = [
  {
    slug: "current",
    category: "web",
    recommendedModels: ["GPT Image 2"],
  },
  {
    slug: "same-category",
    category: "web",
    recommendedModels: ["Claude"],
  },
  {
    slug: "same-model",
    category: "image",
    recommendedModels: ["gpt image 2"],
  },
  {
    slug: "unrelated",
    category: "video",
    recommendedModels: ["Veo"],
  },
];

test("related cases keep relevant matches without unrelated padding", () => {
  assert.deepEqual(
    getRelatedCases(cases[0], cases).map((item) => item.slug),
    ["same-category", "same-model"]
  );
});

test("related cases exclude self, honor limits, and sort ties deterministically", () => {
  const tied = [
    cases[0],
    { slug: "z-case", category: "web", recommendedModels: ["Claude"] },
    { slug: "a-case", category: "web", recommendedModels: ["Claude"] },
  ];

  assert.deepEqual(
    getRelatedCases(cases[0], tied, 1).map((item) => item.slug),
    ["a-case"]
  );
});

test("missing-model sentinels never create cross-category relationships", () => {
  const missingModels = [
    {
      slug: "image-without-model",
      category: "image",
      recommendedModels: [MISSING_MODEL],
    },
    {
      slug: "video-without-model",
      category: "video",
      recommendedModels: [MISSING_MODEL],
    },
  ];

  assert.deepEqual(getRelatedCases(missingModels[0], missingModels), []);
});

test("published dates are normalized to a stable UTC day", () => {
  assert.equal(
    formatPublishedDate("2026-04-08T23:30:00-07:00"),
    "2026-04-09"
  );
  assert.equal(formatPublishedDate("not-a-date"), null);
  assert.equal(formatPublishedDate(), null);
});

test("missing prompt sentinel stays stable for card suppression", () => {
  assert.equal(MISSING_PROMPT_PREVIEW, "该案例暂未提供 Prompt 预览。");
});

test("case cards render the selected prompt language", () => {
  assert.deepEqual(
    getCaseCardPrompt("中文提示语"),
    { text: "中文提示语", resourceUrl: null }
  );
});

test("standalone prompt links become explicit resources", () => {
  assert.deepEqual(
    getCaseCardPrompt(
      "[https://github.com/example/project](https://github.com/example/project)"
    ),
    {
      text: null,
      resourceUrl: "https://github.com/example/project",
    }
  );
});

test("generic source summaries are hidden while specific summaries remain", () => {
  assert.equal(
    getCaseCardSummary(
      "来自 X / 𝕏 的真实 图像 案例，由 @creator 发布。适合观察 Prompt 结构、素材组织和可复用的创作模式。"
    ),
    null
  );
  assert.equal(
    getCaseCardSummary("镜头沿箭矢连续推进，并从宏观战场切入微观世界。"),
    "镜头沿箭矢连续推进，并从宏观战场切入微观世界。"
  );
});

const GENERIC_SUMMARY =
  "来自 X / 𝕏 的真实 编程/UI 案例，由 @xxx 发布。适合观察 Prompt 结构、素材组织和可复用的创作模式。";
const CONTRIBUTION_NOTES = [
  "先不改：完整复制提示语，生成一版基线结果。",
  "只替换：先改画面主体，其余结构保持不动。",
  "再对比：优先用主力模型起步，每次只改一个变量。",
];

test("getPresentableCaseSummary keeps a specific summary untouched and ignores the fallback", () => {
  assert.equal(
    getPresentableCaseSummary(
      "镜头沿箭矢连续推进，并从宏观战场切入微观世界。",
      CONTRIBUTION_NOTES
    ),
    "镜头沿箭矢连续推进，并从宏观战场切入微观世界。"
  );
});

test("getPresentableCaseSummary falls back to the first sentence of the reuse method when the summary is generic", () => {
  assert.equal(
    getPresentableCaseSummary(GENERIC_SUMMARY, CONTRIBUTION_NOTES),
    "先不改：完整复制提示语，生成一版基线结果。"
  );
});

test("getPresentableCaseSummary falls back the same way when the summary is empty", () => {
  assert.equal(
    getPresentableCaseSummary("", CONTRIBUTION_NOTES),
    "先不改：完整复制提示语，生成一版基线结果。"
  );
});

test("getPresentableCaseSummary returns null when neither the summary nor the fallback notes are usable", () => {
  assert.equal(getPresentableCaseSummary(GENERIC_SUMMARY, undefined), null);
  assert.equal(getPresentableCaseSummary(GENERIC_SUMMARY, []), null);
  assert.equal(getPresentableCaseSummary("   ", []), null);
});

test("getPresentableCaseSummary truncates an overlong fallback sentence with an ellipsis", () => {
  const longNote = "极".repeat(120); // 没有句读，firstSentence 拿到的是整段文本
  const result = getPresentableCaseSummary(GENERIC_SUMMARY, [longNote]);
  assert.equal(result.length, 90);
  assert.ok(result.endsWith("…"));
  assert.equal(result.slice(0, -1), longNote.slice(0, 89));
});
