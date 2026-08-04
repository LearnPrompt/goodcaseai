import test from "node:test";
import assert from "node:assert/strict";
import { planCandidateRow } from "../recalibrate-candidate-locale.mjs";

const ENGLISH_PROMPT =
  "A cinematic wide shot of a lone astronaut walking across a red dune at golden hour, shot on 35mm film.";
const CHINESE_PROMPT = "电影感广角镜头，一名宇航员在黄昏时分独自穿越红色沙丘，35mm 胶片质感。";

test("库默认值填出来的 zh-CN 遇上英文正文要改", () => {
  const plan = planCandidateRow({
    content_locale: "zh-CN",
    prompt_full: ENGLISH_PROMPT,
  });
  assert.equal(plan.skip, null);
  assert.equal(plan.changed, true);
  assert.equal(plan.detected, "en");
});

test("已经标对的候选不动", () => {
  assert.equal(
    planCandidateRow({ content_locale: "zh-CN", prompt_full: CHINESE_PROMPT }).changed,
    false
  );
  assert.equal(
    planCandidateRow({ content_locale: "en", prompt_full: ENGLISH_PROMPT }).changed,
    false
  );
});

test("content_locale 为 null 的候选会被补上", () => {
  const plan = planCandidateRow({ content_locale: null, prompt_full: CHINESE_PROMPT });
  assert.equal(plan.changed, true);
  assert.equal(plan.detected, "zh-CN");
});

test("没有 Prompt 正文的候选跳过，不瞎猜", () => {
  for (const row of [
    { content_locale: "zh-CN", prompt_full: null, prompt_preview: null },
    { content_locale: "zh-CN", prompt_full: "   " },
    { content_locale: null },
  ]) {
    const plan = planCandidateRow(row);
    assert.equal(plan.skip, "无 Prompt 正文");
    assert.equal(plan.detected, null);
  }
});

test("prompt_full 缺失时回退到 prompt_preview", () => {
  const plan = planCandidateRow({
    content_locale: "zh-CN",
    prompt_full: null,
    prompt_preview: ENGLISH_PROMPT,
  });
  assert.equal(plan.changed, true);
  assert.equal(plan.detected, "en");
});
