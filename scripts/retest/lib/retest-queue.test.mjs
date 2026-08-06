import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRetestQueue,
  countRetestVotes,
  isResourceOnlyPrompt,
  referencesInputImage,
  restorePromptArguments,
} from "./retest-queue.mjs";

const LONG = "画一只橙色的猫坐在木桌上，写实摄影风格，柔和自然光，浅景深，35mm 镜头质感。";

test("restorePromptArguments 把带 default 的模板还原成原文", () => {
  const { text, restoredDefaults, unresolved } = restorePromptArguments(
    'Create a beautiful {argument name="subject" default="young Italian woman"} with olive skin'
  );

  assert.equal(text, "Create a beautiful young Italian woman with olive skin");
  assert.deepEqual(restoredDefaults, ["young Italian woman"]);
  assert.deepEqual(unresolved, []);
});

test("restorePromptArguments 保留没有 default 的占位符并报出参数名", () => {
  const { text, unresolved } = restorePromptArguments(
    'Exploding {argument name="subject"} with glitch distortion'
  );

  // 还原不了就别乱填，原样留着让人看见。
  assert.match(text, /\{argument name="subject"\}/);
  assert.deepEqual(unresolved, ["subject"]);
});

test("restorePromptArguments 能处理一条里的多个模板", () => {
  const { text, restoredDefaults } = restorePromptArguments(
    'A {argument name="a" default="cat"} next to a {argument name="b" default="dog"}'
  );

  assert.equal(text, "A cat next to a dog");
  assert.deepEqual(restoredDefaults, ["cat", "dog"]);
});

test("isResourceOnlyPrompt 拦下纯链接条目", () => {
  assert.equal(isResourceOnlyPrompt("https://github.com/huangserva/3DCellForge"), true);
  assert.equal(isResourceOnlyPrompt("   "), true);
  assert.equal(isResourceOnlyPrompt(null), true);
});

test("isResourceOnlyPrompt 拦下「查看方法」型指路文案", () => {
  assert.equal(isResourceOnlyPrompt("完整教程见原文，链接在评论区置顶。"), true);
  assert.equal(isResourceOnlyPrompt("Full tutorial at https://example.com/post — link in bio"), true);
});

test("isResourceOnlyPrompt 不误杀带参考图链接的正经 prompt", () => {
  assert.equal(
    isResourceOnlyPrompt(`${LONG} 参考图：https://example.com/ref.png`),
    false
  );
});

test("referencesInputImage 认出需要参考图的 prompt", () => {
  assert.equal(
    referencesInputImage("I have provided an image. Code a beautiful voxel art scene inspired by this image."),
    true
  );
  assert.equal(referencesInputImage("参考这张图的配色，做一张海报"), true);
  // 图生图不一定说「我提供了图」，动词句式同样是需要输入图的信号。
  assert.equal(
    referencesInputImage("Turn this photo into a funny ugly doodle drawing."),
    true
  );
  assert.equal(referencesInputImage("把这张照片改成蜡笔涂鸦风"), true);
  assert.equal(referencesInputImage(LONG), false);
  // 纯文生图不该被误判：句子里有 image 但不是「用户给的那张」。
  assert.equal(
    referencesInputImage("Generate an image of a cat on a table, photorealistic."),
    false
  );
});

test("countRetestVotes 只数 retest_vote，忽略点赞", () => {
  const counts = countRetestVotes([
    { case_slug: "a", kind: "retest_vote" },
    { case_slug: "a", kind: "retest_vote" },
    { case_slug: "a", kind: "like" },
    { case_slug: "b", kind: "like" },
    { case_slug: "", kind: "retest_vote" },
  ]);

  assert.equal(counts.get("a"), 2);
  assert.equal(counts.get("b"), undefined);
  assert.equal(counts.size, 1);
});

const baseCases = [
  { slug: "img-hot", category: "image", promptFull: LONG, sourceHeatScore: 90 },
  { slug: "img-cold", category: "image", promptFull: LONG, sourceHeatScore: 10 },
  { slug: "img-voted", category: "image", promptFull: LONG, sourceHeatScore: 5 },
  { slug: "web-hot", category: "web", promptFull: LONG, sourceHeatScore: 80 },
  { slug: "vid-hot", category: "video", promptFull: LONG, sourceHeatScore: 99 },
  { slug: "img-link", category: "image", promptFull: "https://example.com/x", sourceHeatScore: 100 },
];

test("buildRetestQueue 票数压过热度", () => {
  const { queue } = buildRetestQueue({
    cases: baseCases,
    votes: { "img-voted": 3 },
    limits: { image: 2, web: 1 },
  });

  assert.deepEqual(
    queue.map((item) => item.slug),
    ["img-voted", "img-hot", "web-hot"]
  );
});

test("buildRetestQueue 跳过 video 和纯链接，并记录跳过原因", () => {
  const { queue, skipped } = buildRetestQueue({ cases: baseCases, votes: {} });

  assert.equal(
    queue.some((item) => item.category === "video"),
    false
  );
  assert.equal(
    queue.some((item) => item.slug === "img-link"),
    false
  );
  assert.deepEqual(
    skipped.find((item) => item.slug === "vid-hot")?.reason,
    "category-out-of-scope"
  );
  assert.deepEqual(
    skipped.find((item) => item.slug === "img-link")?.reason,
    "resource-link-prompt"
  );
});

test("buildRetestQueue 分类配额各算各的", () => {
  const { queue } = buildRetestQueue({
    cases: baseCases,
    votes: {},
    limits: { image: 1, web: 1 },
  });

  assert.equal(queue.filter((item) => item.category === "image").length, 1);
  assert.equal(queue.filter((item) => item.category === "web").length, 1);
});

test("buildRetestQueue 把没有热度的排在有热度的后面", () => {
  const { queue } = buildRetestQueue({
    cases: [
      { slug: "no-heat", category: "image", promptFull: LONG, sourceHeatScore: null },
      { slug: "low-heat", category: "image", promptFull: LONG, sourceHeatScore: 1 },
    ],
    votes: {},
  });

  assert.deepEqual(
    queue.map((item) => item.slug),
    ["low-heat", "no-heat"]
  );
});

test("buildRetestQueue 全并列时按 slug 字典序，保证可复现", () => {
  const cases = ["c", "a", "b"].map((slug) => ({
    slug,
    category: "image",
    promptFull: LONG,
    sourceHeatScore: 50,
  }));

  const first = buildRetestQueue({ cases, votes: {} }).queue.map((item) => item.slug);
  const second = buildRetestQueue({ cases: [...cases].reverse(), votes: {} }).queue.map(
    (item) => item.slug
  );

  assert.deepEqual(first, ["a", "b", "c"]);
  assert.deepEqual(first, second);
});

test("buildRetestQueue 把还原后的 prompt 和未解析参数带给下游", () => {
  const { queue } = buildRetestQueue({
    cases: [
      {
        slug: "with-args",
        category: "image",
        promptFull: `${LONG} {argument name="mood" default="warm"} {argument name="extra"}`,
        sourceHeatScore: 50,
      },
    ],
    votes: {},
  });

  assert.match(queue[0].executablePrompt, /warm/);
  assert.deepEqual(queue[0].restoredDefaults, ["warm"]);
  assert.deepEqual(queue[0].unresolvedArguments, ["extra"]);
});
