import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFrameTimestamps,
  buildLocalAnalysisPrompt,
  parseLocalAnalysis,
} from "./local-media.mjs";

test("buildFrameTimestamps samples frame midpoints", () => {
  assert.deepEqual(buildFrameTimestamps(15, 6), [1.25, 3.75, 6.25, 8.75, 11.25, 13.75]);
});

test("buildFrameTimestamps rejects unsafe counts", () => {
  assert.throws(() => buildFrameTimestamps(15, 1), /2 到 12/);
  assert.throws(() => buildFrameTimestamps(0, 6), /大于 0/);
});

test("buildLocalAnalysisPrompt grounds output in visible frames", () => {
  const prompt = buildLocalAnalysisPrompt("An arrow crosses a battlefield.");
  assert.match(prompt, /只根据可见画面/);
  assert.match(prompt, /An arrow crosses a battlefield/);
  assert.match(prompt, /promptTranslationZh/);
});

test("parseLocalAnalysis validates the four output fields", () => {
  assert.deepEqual(
    parseLocalAnalysis(
      JSON.stringify({
        resultHighlight: " 结果 ",
        reusableStructure: " 结构 ",
        retestStandard: " 标准 ",
        promptTranslationZh: " 翻译 ",
      })
    ),
    {
      resultHighlight: "结果",
      reusableStructure: "结构",
      retestStandard: "标准",
      promptTranslationZh: "翻译",
    }
  );
  assert.throws(() => parseLocalAnalysis("{}"), /resultHighlight/);
});
