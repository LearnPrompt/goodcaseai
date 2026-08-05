import assert from "node:assert/strict";
import test from "node:test";
import {
  PROMPT_MATCH_THRESHOLD,
  checkPromptProvenance,
  extractUrlFragment,
  hasPromptCue,
  isReversedAnchor,
  normalizeProvenanceText,
  promptMatchRatio,
  provenanceTags,
  stripUrlFragment,
} from "./prompt-provenance.mjs";

/**
 * 阈值标定（2026-08-05 溯源审计的 24 条人工核对样本，逐条跑本模块的 promptMatchRatio）：
 *
 * | 人工判定 | 条数 | 命中率区间 |
 * |---|---:|---|
 * | 一致     | 11 | 0.68 – 1.00 |
 * | 部分一致 |  8 | 0.50 – 1.00 |
 * | 对不上   |  5 | 0.00 – 0.00 |
 *
 * 阈值 0.5 在这 24 条上：漏报 0、误报 0。0.00 和 0.50 之间没有样本，安全带很宽。
 */

test("extractUrlFragment / stripUrlFragment 把 fragment 和 URL 主体拆开", () => {
  const url = "https://x.com/foo/status/123#reversed-2";
  assert.equal(extractUrlFragment(url), "reversed-2");
  assert.equal(stripUrlFragment(url), "https://x.com/foo/status/123");
  assert.equal(extractUrlFragment("https://x.com/foo/status/123"), "");
  assert.equal(extractUrlFragment(""), "");
  assert.equal(stripUrlFragment(""), "");
});

test("extractUrlFragment 对非法 URL 也能退化处理，不抛异常", () => {
  assert.equal(extractUrlFragment("not a url#reversed-0"), "reversed-0");
  assert.equal(stripUrlFragment("not a url#reversed-0"), "not a url");
});

test("isReversedAnchor 只认 reversed / reversed-N，不误伤普通锚点", () => {
  assert.equal(isReversedAnchor("reversed"), true);
  assert.equal(isReversedAnchor("reversed-0"), true);
  assert.equal(isReversedAnchor("reversed-12"), true);
  assert.equal(isReversedAnchor("Reversed-3"), true);
  assert.equal(isReversedAnchor("section-2"), false);
  assert.equal(isReversedAnchor("reversed-engineering-notes"), false);
  assert.equal(isReversedAnchor(""), false);
  assert.equal(isReversedAnchor(null), false);
});

test("normalizeProvenanceText 去空白、统一全角标点，并把 {argument} 模板还原成 default 值", () => {
  assert.equal(
    normalizeProvenanceText('一张 {argument name="主体" default="白猫"} 的照片，逆光。'),
    "一张白猫的照片,逆光."
  );
  assert.equal(normalizeProvenanceText('{argument name="风格"}纯色背景'), "纯色背景");
});

test("promptMatchRatio 对逐字抄自原帖的 prompt 给满命中率", () => {
  const prompt = "a".repeat(40) + "b".repeat(40) + "c".repeat(40);
  const tweet = `Prompt: ${prompt} —— 用 Nano Banana 生成`;
  const { ratio, windows, hits } = promptMatchRatio(prompt, tweet);
  assert.equal(windows, 3);
  assert.equal(hits, 3);
  assert.equal(ratio, 1);
});

test("promptMatchRatio 对原帖里根本不存在的 prompt 给 0", () => {
  const { ratio, hits } = promptMatchRatio(
    "x".repeat(200),
    "这条推在讲某个模型的发布会，没有贴任何提示词。"
  );
  assert.equal(hits, 0);
  assert.equal(ratio, 0);
});

test("promptMatchRatio 容忍 youmind 的参数化替换，只丢掉被替换掉的那个窗口", () => {
  // youmind 把原推里的「成人女性」换成了自己模板的 default「20代女性」，
  // 只有跨过这个词的那一个窗口对不上，其余照旧命中。用前缀比对会被它一票否决。
  const head = "画面中央やや左に小さな".padEnd(40, "背");
  const swapped = "20代女性".padEnd(40, "景");
  const tail = "巨大な日用品との対比を強調する".padEnd(40, "光");
  const prompt = head + swapped + tail;
  const tweet = head + "成人女性".padEnd(40, "景") + tail;
  const { ratio } = promptMatchRatio(prompt, tweet);
  assert.equal(ratio, 2 / 3);
  assert.ok(ratio >= PROMPT_MATCH_THRESHOLD);
});

test("promptMatchRatio 对拼不满一个窗口的短 prompt 走整段比对，不放过去", () => {
  assert.deepEqual(promptMatchRatio("一只猫", "Prompt: 一只猫"), {
    ratio: 1,
    windows: 1,
    hits: 1,
  });
  assert.deepEqual(promptMatchRatio("一只猫", "这条推在讲天气"), {
    ratio: 0,
    windows: 1,
    hits: 0,
  });
});

test("promptMatchRatio 拿不到原帖正文时返回 null，而不是假装 0", () => {
  assert.equal(promptMatchRatio("一只猫", "").ratio, null);
  assert.equal(promptMatchRatio("", "Prompt: 一只猫").ratio, null);
});

test("hasPromptCue 认得中英日韩的 prompt 引导词", () => {
  assert.equal(hasPromptCue("Prompt: a cat"), true);
  assert.equal(hasPromptCue("提示词：一只猫"), true);
  assert.equal(hasPromptCue("プロンプトはこちら"), true);
  assert.equal(hasPromptCue("完整 Prompt 在下面"), true);
  assert.equal(hasPromptCue("今天发布了新模型"), false);
});

test("checkPromptProvenance 见到 #reversed-N 直接拦，且不需要原帖正文", () => {
  const check = checkPromptProvenance({
    promptText: "随便什么 prompt",
    sourceUrl: "https://x.com/foo/status/123#reversed-1",
  });
  assert.equal(check.status, "reversed-anchor");
  assert.equal(check.blocked, true);
  assert.equal(check.anchor, "reversed-1");
  assert.equal(check.reversed, true);
  assert.match(check.reason, /逆向重构/);
  assert.deepEqual(provenanceTags(check), [
    "provenance-reversed",
    "provenance-blocked",
  ]);
});

test("checkPromptProvenance 接受调用方单独传进来的锚点", () => {
  const check = checkPromptProvenance({
    promptText: "随便什么 prompt",
    sourceUrl: "https://x.com/foo/status/123",
    anchor: "reversed-0",
  });
  assert.equal(check.status, "reversed-anchor");
  assert.equal(check.blocked, true);
});

test("checkPromptProvenance 在 prompt 与原帖对不上时拦下来", () => {
  const check = checkPromptProvenance({
    promptText: "y".repeat(200),
    sourceUrl: "https://x.com/foo/status/123",
    sourceText: "这条推在讲发布会，什么提示词都没贴。",
  });
  assert.equal(check.status, "prompt-not-in-source");
  assert.equal(check.blocked, true);
  assert.equal(check.matchRatio, 0);
  assert.deepEqual(provenanceTags(check), [
    "provenance-mismatch",
    "provenance-blocked",
  ]);
});

test("checkPromptProvenance 对出自原帖的 prompt 放行", () => {
  const prompt = "a".repeat(120);
  const check = checkPromptProvenance({
    promptText: prompt,
    sourceUrl: "https://x.com/foo/status/123",
    sourceText: `Prompt: ${prompt}`,
  });
  assert.equal(check.status, "verified");
  assert.equal(check.blocked, false);
  assert.equal(check.matchRatio, 1);
  assert.equal(check.hasPromptCue, true);
  assert.deepEqual(provenanceTags(check), []);
});

test("checkPromptProvenance 抓不到原帖正文时标 unchecked，不拦但也不算干净", () => {
  const check = checkPromptProvenance({
    promptText: "a".repeat(120),
    sourceUrl: "https://x.com/foo/status/123",
  });
  assert.equal(check.status, "unchecked");
  assert.equal(check.blocked, false);
  assert.equal(check.matchRatio, null);
  // unchecked 故意不打标签：影子跑里 100% 的候选都是 unchecked，打了等于没打。
  assert.deepEqual(provenanceTags(check), []);
});

test("引导词缺失不单独构成拦截理由——审计里 5 条对不上有 1 条原帖是带引导词的", () => {
  const prompt = "b".repeat(120);
  const check = checkPromptProvenance({
    promptText: prompt,
    sourceUrl: "https://x.com/foo/status/123",
    sourceText: `一段没有任何引导词的正文，但确实逐字包含了 ${prompt}`,
  });
  assert.equal(check.hasPromptCue, false);
  assert.equal(check.status, "verified");
  assert.equal(check.blocked, false);
});
