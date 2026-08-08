import assert from "node:assert/strict";
import test from "node:test";
import { caseMatchesModel, getModelFamily } from "../../../src/lib/models.ts";

test("qwen-image aliases still match qwen / 千问 / 通义千问", () => {
  const family = getModelFamily("qwen-image");
  assert.ok(family, "expected qwen-image family to exist");
  assert.equal(
    caseMatchesModel({ recommendedModels: ["Qwen Image"] }, family),
    true
  );
  assert.equal(
    caseMatchesModel({ recommendedModels: ["千问"] }, family),
    true
  );
  assert.equal(
    caseMatchesModel({ recommendedModels: ["通义千问"] }, family),
    true
  );
});

test("qwen-image aliases do NOT match 通义万相 2.5 (regression lock for bare 通义 leak)", () => {
  // 回归锁：models.ts 的 qwen-image aliases 曾经收录裸词「通义」，
  // 子串匹配下会把「通义万相」（Wan，阿里视频模型，跟 Qwen Image 无关）
  // 也归进 Qwen Image 的模型筛选/模型页。裸「通义」已经从 aliases 里
  // 撤出（只留在 search.ts 的 EXTRA_SYNONYM_GROUPS 供搜索使用），这里
  // 锁住不再回归。
  const family = getModelFamily("qwen-image");
  assert.ok(family, "expected qwen-image family to exist");
  assert.equal(
    caseMatchesModel({ recommendedModels: ["通义万相 2.5"] }, family),
    false,
    "通义万相 2.5 (Wan, unrelated to Qwen Image) should not be classified as qwen-image"
  );
});

test("qwen-image aliases do NOT match 通义听悟 either", () => {
  const family = getModelFamily("qwen-image");
  assert.ok(family, "expected qwen-image family to exist");
  assert.equal(
    caseMatchesModel({ recommendedModels: ["通义听悟"] }, family),
    false
  );
});
