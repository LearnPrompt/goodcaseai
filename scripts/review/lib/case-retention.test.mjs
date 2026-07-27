import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublishedDate,
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
