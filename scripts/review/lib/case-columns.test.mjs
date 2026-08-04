import test from "node:test";
import assert from "node:assert/strict";
import {
  DETAIL_SELECT,
  GENERATED_PREVIEW_COLUMNS,
  PROMPT_PREVIEW_LIMIT,
  buildCardSelect,
  buildIndexSelect,
  buildResultBreakdownSelect,
  isMissingColumnError,
  truncatePromptPreview,
} from "../../../src/lib/case-columns.ts";

const HEAVY_COLUMNS = [
  "prompt_full",
  "translations,",
  "translations ",
  "summary",
  "prompt_preview,",
  "media_url",
  "poster_url",
];

test("index 档不带任何重字段，只留排序与聚合要用的列", () => {
  const select = buildIndexSelect("zh-CN");

  for (const column of HEAVY_COLUMNS) {
    assert.equal(
      select.includes(column),
      false,
      `index 档不应该包含 ${column}`
    );
  }

  // 来源热度、创作者聚合、Skill 归类、相关案例挑选依赖的列必须齐全
  for (const column of [
    "slug",
    "title",
    "category",
    "creator_name",
    "tags",
    "recommended_models",
    "stability_score",
    "cost_band",
    "source_platform",
    "source_url",
    "source_like_count",
    "source_published_at",
    "source_metrics_captured_at",
  ]) {
    assert.ok(select.includes(column), `index 档缺少 ${column}`);
  }
});

test("index 档按 locale 取译文标题，Skill 归类才不会在 /en 下变样", () => {
  assert.ok(
    buildIndexSelect("zh-CN").includes("tr_title:translations->zh-CN->>title")
  );
  assert.ok(
    buildIndexSelect("en").includes("tr_title:translations->en->>title")
  );
});

test("card 档在迁移跑过后直接取库侧截断列", () => {
  const select = buildCardSelect("zh-CN", { generatedPreviewColumns: true });

  for (const column of GENERATED_PREVIEW_COLUMNS) {
    assert.ok(select.includes(column), `card 档缺少 ${column}`);
  }
  // 库侧已经截断，就不该再把整段译文拉回来
  assert.equal(select.includes("->>promptFull"), false);
  assert.ok(select.includes("summary"));
  assert.ok(select.includes("prompt_preview"));
  assert.ok(select.includes("media_url"));
  // 整包 translations 任何时候都不进 card 档
  assert.equal(select.includes("translations,"), false);
});

test("迁移没跑时 card 档退回整段译文，页面仍然正确", () => {
  const select = buildCardSelect("en", { generatedPreviewColumns: false });

  assert.ok(select.includes("prompt_preview_zh:translations->zh-CN->>promptFull"));
  assert.ok(select.includes("prompt_preview_en:translations->en->>promptFull"));
  assert.ok(select.includes("tr_summary:translations->en->>summary"));
});

test("detail 档带整包译文和完整 Prompt", () => {
  assert.ok(DETAIL_SELECT.includes("prompt_full"));
  assert.ok(DETAIL_SELECT.includes("translations"));
  assert.ok(DETAIL_SELECT.includes("summary"));
});

test("resultBreakdown 用 -> 取数组，用 ->> 会拿到字符串导致解析失败", () => {
  const select = buildResultBreakdownSelect("zh-CN");

  assert.ok(
    select.includes("tr_result_breakdown:translations->zh-CN->resultBreakdown")
  );
  assert.equal(select.includes("->>resultBreakdown"), false);
  assert.ok(select.startsWith("slug"));
});

test("只把列缺失当成迁移没跑，其它错误一律不降级", () => {
  assert.equal(
    isMissingColumnError(
      { code: "42703", message: 'column cases.prompt_preview_zh does not exist' },
      GENERATED_PREVIEW_COLUMNS
    ),
    true
  );
  assert.equal(
    isMissingColumnError(
      { code: "PGRST204", message: "prompt_preview_en not found" },
      GENERATED_PREVIEW_COLUMNS
    ),
    true
  );
  // 别的列缺失不该触发这条降级路径
  assert.equal(
    isMissingColumnError(
      { code: "42703", message: "column cases.creator_avatar_url does not exist" },
      GENERATED_PREVIEW_COLUMNS
    ),
    false
  );
  // 超时、权限等错误不是列缺失
  assert.equal(
    isMissingColumnError(
      { code: "57014", message: "canceling statement due to statement timeout" },
      GENERATED_PREVIEW_COLUMNS
    ),
    false
  );
  assert.equal(isMissingColumnError(null, GENERATED_PREVIEW_COLUMNS), false);
});

test("译文预览截断到 240，空值归一成 undefined", () => {
  assert.equal(truncatePromptPreview(undefined), undefined);
  assert.equal(truncatePromptPreview(null), undefined);
  assert.equal(truncatePromptPreview("   "), undefined);
  assert.equal(truncatePromptPreview("  短提示语  "), "短提示语");

  const long = "字".repeat(PROMPT_PREVIEW_LIMIT + 60);
  assert.equal(truncatePromptPreview(long).length, PROMPT_PREVIEW_LIMIT);

  const exact = "字".repeat(PROMPT_PREVIEW_LIMIT);
  assert.equal(truncatePromptPreview(exact), exact);
});
