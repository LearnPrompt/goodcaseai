import assert from "node:assert/strict";
import test from "node:test";
import { toCaseCardItem } from "../../../src/lib/case-card-item.ts";
import { toCreatorCardItem } from "../../../src/lib/creator-card-item.ts";

/**
 * 这两个 mapper 存在的唯一理由，是别把卡片不渲染的字段序列化进 RSC payload。
 * CaseCard / CreatorCard 都是客户端组件，props 会原样进 HTML；
 * 谁要是顺手改回 {...item}，payload 会立刻涨回去而页面看起来毫无变化——
 * 所以这里把「不该出现的字段」钉死成断言，让回归在测试里就炸掉。
 */

/** 一条字段齐全的 DisplayCaseItem，重点是带上那些卡片压根不渲染的重字段。 */
function makeCase() {
  return {
    slug: "case-x",
    title: "标题",
    category: "image",
    source: "X / 𝕏",
    creator: "@someone",
    summary: "一句摘要",
    promptPreview: "preview",
    promptFull: "P".repeat(2000),
    contentLocale: "en",
    promptTranslationZh: "中文翻译",
    promptTranslationEn: "english translation",
    resultBreakdown: ["决定", "结构", "复测"],
    mediaType: "image",
    mediaUrl: "/media/x.png",
    posterUrl: "/media/x.jpg",
    thumbnailUrl: "/media/x-400.png",
    thumbnailFit: "contain",
    promptContributionNotes: ["第一条方法。", "第二条方法。", "第三条方法。"],
    stabilityScore: 82,
    sourceHeatScore: 91,
    sourcePublishedAt: "2026-05-10T11:01:43+00:00",
    // 以下全是卡片不渲染的
    sourceUrl: "https://x.com/someone/status/1",
    sourceLikeCount: 3916,
    sourceCommentCount: 145,
    sourceShareCount: 604,
    sourceSaveCount: 5239,
    sourceMetricsCapturedAt: "2026-07-23T10:14:54.102+00:00",
    creatorAvatarUrl: "https://example.com/a.jpg",
    likedCount: 0,
    remakeCount: 7,
    favoriteScore: 3,
    recommendedModels: ["gpt-image-2"],
    costBand: "low",
    evidenceLevel: "L1",
    tags: ["a", "b", "c"],
    createdAt: "2026-05-10T00:00:00Z",
    promptPublicNote: "note",
    promptLoginNotes: ["l1", "l2"],
    editorNote: "editor",
    labNote: ["lab1", "lab2"],
    spreadScore: 10,
    spreadScoreNote: "note",
  };
}

/** CaseCard / CaseCardPrompt 真正会读到的字段。 */
const CASE_CARD_RENDERED_FIELDS = [
  "slug",
  "title",
  "category",
  "source",
  "creator",
  "summary",
  "promptPreview",
  "contentLocale",
  "promptTranslationZh",
  "promptTranslationEn",
  "mediaType",
  "mediaUrl",
  "posterUrl",
  "promptContributionNotes",
  "thumbnailUrl",
  "thumbnailFit",
  "stabilityScore",
  // 稳定度格子要靠它区分「没测过」和「复测未通过」（src/lib/stability.ts）。
  // 两个字符的 payload，换掉「给失败的复测显示投票催复测」这个假状态。
  "evidenceLevel",
  "sourceHeatScore",
  "sourcePublishedAt",
  "skills",
];

/** 卡片一个都不渲染、必须被挡在 payload 外面的重字段。 */
const CASE_CARD_FORBIDDEN_FIELDS = [
  "promptFull",
  "resultBreakdown",
  "sourceUrl",
  "sourceLikeCount",
  "sourceCommentCount",
  "sourceShareCount",
  "sourceSaveCount",
  "sourceMetricsCapturedAt",
  "creatorAvatarUrl",
  "likedCount",
  "remakeCount",
  "favoriteScore",
  "recommendedModels",
  "costBand",
  "tags",
  "createdAt",
  "promptPublicNote",
  "promptLoginNotes",
  "editorNote",
  "labNote",
  "spreadScore",
  "spreadScoreNote",
];

test("toCaseCardItem 只输出卡片会渲染的字段，不多一个", () => {
  const result = toCaseCardItem(makeCase(), [{ slug: "s", title: "T" }]);
  assert.deepEqual(
    Object.keys(result).sort(),
    [...CASE_CARD_RENDERED_FIELDS].sort()
  );
});

test("toCaseCardItem 挡住 promptFull / resultBreakdown 等卡片不渲染的重字段", () => {
  const result = toCaseCardItem(makeCase());
  for (const field of CASE_CARD_FORBIDDEN_FIELDS) {
    assert.ok(
      !(field in result),
      `${field} 不该出现在 CaseCard 的 props 里，否则会被序列化进 RSC payload`
    );
  }
});

test("toCaseCardItem 原样保留卡片要显示的内容", () => {
  const source = makeCase();
  const skills = [{ slug: "s", title: "T" }];
  const result = toCaseCardItem(source, skills);
  assert.equal(result.title, source.title);
  assert.equal(result.summary, source.summary);
  assert.equal(result.promptPreview, source.promptPreview);
  assert.equal(result.promptTranslationZh, source.promptTranslationZh);
  assert.equal(result.thumbnailUrl, source.thumbnailUrl);
  assert.equal(result.thumbnailFit, source.thumbnailFit);
  assert.equal(result.stabilityScore, source.stabilityScore);
  assert.equal(result.sourceHeatScore, source.sourceHeatScore);
  assert.deepEqual(result.skills, skills);
});

test("toCaseCardItem 的复用方法只留第一条（卡片只读 [0] 的第一句）", () => {
  const source = makeCase();
  const result = toCaseCardItem(source);
  assert.deepEqual(result.promptContributionNotes, ["第一条方法。"]);
  // 卡片实际读的是 [0]，截断前后必须是同一条，否则推荐理由会变。
  assert.equal(
    result.promptContributionNotes[0],
    source.promptContributionNotes[0]
  );
});

test("toCaseCardItem 在没有复用方法时不炸", () => {
  const source = makeCase();
  delete source.promptContributionNotes;
  const result = toCaseCardItem(source);
  assert.equal(result.promptContributionNotes, undefined);
});

function makeCreator() {
  return {
    slug: "someone",
    name: "@someone",
    avatarUrl: "https://example.com/a.jpg",
    bio: "一段简介",
    tags: ["标签一", "标签二", "标签三"],
    highlightedLabel: "AI 图像",
    caseCount: 12,
    averageSourceHeatScore: 88,
    averageStabilityScore: 79,
    primaryCategory: "image",
    sourceFootprint: ["X / 𝕏"],
    totalSourceInteractions: 12345,
    latestWorkDate: "2026/05/17",
    heroCase: {
      slug: "case-hero",
      title: "代表作标题",
      summary: "代表作摘要",
      promptFull: "P".repeat(2000),
      resultBreakdown: ["决定", "结构", "复测"],
    },
    representativeCases: [
      { slug: "c1", title: "t1", promptFull: "Q".repeat(2000) },
      { slug: "c2", title: "t2", promptFull: "R".repeat(2000) },
    ],
  };
}

const CREATOR_CARD_RENDERED_FIELDS = [
  "slug",
  "name",
  "avatarUrl",
  "bio",
  "tags",
  "highlightedLabel",
  "caseCount",
  "averageSourceHeatScore",
  "averageStabilityScore",
  "heroCaseSlug",
  "heroCaseTitle",
  "heroCaseSummary",
  "latestWorkDate",
];

test("toCreatorCardItem 只输出卡片会渲染的字段，不多一个", () => {
  const result = toCreatorCardItem(makeCreator());
  assert.deepEqual(
    Object.keys(result).sort(),
    [...CREATOR_CARD_RENDERED_FIELDS].sort()
  );
});

test("toCreatorCardItem 把 heroCase 摊平成三个字段，不整个带进 payload", () => {
  const result = toCreatorCardItem(makeCreator());
  assert.ok(!("heroCase" in result), "heroCase 整个对象不该进 props");
  assert.ok(
    !("representativeCases" in result),
    "representativeCases 是一整数组完整 CaseItem，绝不能进 props"
  );
  assert.equal(result.heroCaseSlug, "case-hero");
  assert.equal(result.heroCaseTitle, "代表作标题");
  assert.equal(result.heroCaseSummary, "代表作摘要");
  // 序列化出来的内容里不该出现任何 Prompt 正文。
  assert.ok(!JSON.stringify(result).includes("PPPP"));
  assert.ok(!JSON.stringify(result).includes("QQQQ"));
});

test("toCreatorCardItem 的标签只留卡片显示的前两个", () => {
  const result = toCreatorCardItem(makeCreator());
  assert.deepEqual(result.tags, ["标签一", "标签二"]);
});

test("toCreatorCardItem 原样保留卡片要显示的内容", () => {
  const source = makeCreator();
  const result = toCreatorCardItem(source);
  assert.equal(result.name, source.name);
  assert.equal(result.bio, source.bio);
  assert.equal(result.avatarUrl, source.avatarUrl);
  assert.equal(result.highlightedLabel, source.highlightedLabel);
  assert.equal(result.caseCount, source.caseCount);
  assert.equal(result.averageSourceHeatScore, source.averageSourceHeatScore);
  assert.equal(result.averageStabilityScore, source.averageStabilityScore);
  assert.equal(result.latestWorkDate, source.latestWorkDate);
});

test("toCreatorCardItem 一条可用日期都没有时 latestWorkDate 是 null，不是占位字符串", () => {
  const source = makeCreator();
  source.latestWorkDate = null;
  const result = toCreatorCardItem(source);
  assert.equal(result.latestWorkDate, null);
});
