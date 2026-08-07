import assert from "node:assert/strict";
import test from "node:test";
import {
  SKILL_DEFINITIONS,
  deriveSkillCatalog,
  getCaseSkillLinks,
  getCreatorMethods,
  filterSkillsByQuery,
} from "../../../src/lib/skills.ts";

function caseItem(slug, title, category, creator, tags = []) {
  return { slug, title, category, creator, tags };
}

/** 生成端标成 authored 的复盘句：这条 Case 自己写的，能当证据。 */
function authored(notes) {
  return {
    promptContributionNotes: notes,
    promptContributionNotesSource: "authored",
  };
}

/**
 * 生成端标成 template 的套话：src/lib/cases.ts 在 Case 没有 resultBreakdown 时
 * 按 category 拼出来的句子，同一个 category 下每条 Case 拿到的是同一段文字。
 * card 档取数不带 resultBreakdown，所以列表页上这才是常态。
 */
function templated(notes) {
  return {
    promptContributionNotes: notes,
    promptContributionNotesSource: "template",
  };
}

const VIDEO_TEMPLATE_NOTES = [
  "观察最终结果里，主体动作与镜头连续性 是否同时成立。",
  "把“目标结果 → 主体、场景、镜头运动和结尾动作 → 约束条件”抽成模板，后续可复用到同类任务。",
  "围绕 运动节奏与镜头衔接 做单变量对照，并记录模型、成本和失败结果；重复成立后再沉淀为 Skill。",
];

const ACTION_SKILL = SKILL_DEFINITIONS.find(
  (definition) => definition.slug === "action-continuity-choreography"
);

function findActionSkill(catalog) {
  return catalog.sharedSkills.find(
    (item) => item.slug === "action-continuity-choreography"
  );
}

test("shared Skills require at least three cases across two creators", () => {
  const catalog = deriveSkillCatalog([
    caseItem("a-1", "品牌落地页", "web", "Alice"),
    caseItem("a-2", "产品 Landing Page", "web", "Alice"),
    caseItem("b-1", "Startup 官网", "web", "Bob"),
  ]);

  const skill = catalog.sharedSkills.find(
    (item) => item.slug === "landing-page-information-structure"
  );
  assert.equal(skill?.caseCount, 3);
  assert.equal(skill?.creatorCount, 2);

  const belowThreshold = deriveSkillCatalog([
    caseItem("a-1", "品牌落地页", "web", "Alice"),
    caseItem("a-2", "产品 Landing Page", "web", "Alice"),
  ]);
  assert.equal(
    belowThreshold.sharedSkills.some(
      (item) => item.slug === "landing-page-information-structure"
    ),
    false
  );
});

test("creator methods require three matching cases and ignore popularity", () => {
  const cases = [
    caseItem("a-1", "3D 动效落地页", "web", "Alice"),
    caseItem("a-2", "WebGL 动画网站", "web", "Alice"),
    caseItem("a-3", "Three.js 交互官网", "web", "Alice"),
    caseItem("b-1", "3D Hero 网站", "web", "Bob"),
    caseItem("b-2", "WebGL 产品站", "web", "Bob"),
    {
      ...caseItem("famous", "普通网页", "web", "Famous Creator"),
      sourceHeatScore: 100,
    },
  ];
  const catalog = deriveSkillCatalog(cases);
  const aliceMethods = getCreatorMethods(catalog, "Alice");

  assert.equal(aliceMethods.length, 1);
  assert.equal(aliceMethods[0].baseSlug, "web-3d-motion-hero");
  assert.equal(getCreatorMethods(catalog, "Famous Creator").length, 0);
});

test("high-overlap creator labels collapse to one method", () => {
  const catalog = deriveSkillCatalog([
    caseItem("a-1", "3D 动效落地页", "web", "Alice"),
    caseItem("a-2", "WebGL 动画网站", "web", "Alice"),
    caseItem("a-3", "Three.js 交互官网", "web", "Alice"),
    caseItem("b-1", "3D Hero 落地页", "web", "Bob"),
    caseItem("b-2", "WebGL 产品网站", "web", "Bob"),
    caseItem("b-3", "Three.js Startup 官网", "web", "Bob"),
  ]);

  assert.equal(getCreatorMethods(catalog, "Alice").length, 1);
  assert.equal(getCreatorMethods(catalog, "Bob").length, 1);
});

test("case cards expose at most two shared Skills", () => {
  const cases = [
    caseItem("a-1", "时尚产品广告海报", "image", "Alice"),
    caseItem("b-1", "产品海报", "image", "Bob"),
    caseItem("c-1", "商业产品 Poster", "image", "Carol"),
    caseItem("d-1", "编辑时尚肖像", "image", "Dave"),
    caseItem("e-1", "Fashion portrait", "image", "Eve"),
    caseItem("f-1", "Editorial 人像", "image", "Frank"),
  ];
  const catalog = deriveSkillCatalog(cases);

  assert.ok(getCaseSkillLinks(catalog, "a-1").length <= 2);
});

test("Chinese and English catalogs keep stable slugs", () => {
  const cases = [
    caseItem("a-1", "产品广告", "video", "Alice"),
    caseItem("b-1", "UGC 商业广告", "video", "Bob"),
    caseItem("c-1", "品牌 Product Commercial", "video", "Carol"),
  ];
  const zh = deriveSkillCatalog(cases, "zh-CN");
  const en = deriveSkillCatalog(cases, "en");

  assert.deepEqual(
    zh.allSkills.map((item) => item.slug),
    en.allSkills.map((item) => item.slug)
  );
  assert.notEqual(zh.sharedSkills[0].title, en.sharedSkills[0].title);
});

test("Skill search reaches method steps, creators, and evidence prompts", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "角色身份参考图", "image", "Alice", ["identity"]),
      promptPreview: "Lock the same character across every angle.",
    },
    {
      ...caseItem("b-1", "角色表情矩阵", "image", "Bob", ["identity"]),
      promptPreview: "Keep the character identity fixed.",
    },
    {
      ...caseItem("c-1", "角色锚点清单", "image", "Carol", ["identity"]),
      promptPreview: "Build a stable character reference sheet.",
    },
  ]);
  const skill = catalog.sharedSkills.find(
    (item) => item.slug === "character-style-consistency"
  );
  assert.ok(skill);
  assert.equal(filterSkillsByQuery([skill], "Alice").length, 1);
  assert.equal(filterSkillsByQuery([skill], "固定角色").length, 1);
  assert.equal(filterSkillsByQuery([skill], "reference sheet").length, 1);
});

test("Skill descriptions and steps keep real case evidence attached", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成宏观到微观的尺度转换。"]),
    },
    {
      ...caseItem("a-2", "飞船尺度转换", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一艘飞船完成宏观到微观的尺度转换。"]),
    },
    {
      ...caseItem("a-3", "骑士追逐镜头", "video", "Alice", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进保持方向一致。"]),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进完成尺度变化。"]),
    },
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.match(shared.description, /箭矢微观战场/);
  assert.equal(shared.methodSteps[0], "镜头持续追随同一支箭完成宏观到微观的尺度转换。");

  const creatorMethod = getCreatorMethods(catalog, "Alice").find(
    (item) => item.baseSlug === "action-continuity-choreography"
  );
  assert.ok(creatorMethod);
  assert.match(creatorMethod.description, /飞船尺度转换|箭矢微观战场/);
});

/**
 * P0：category 模板句不是证据。
 *
 * 这些句子由 src/lib/cases.ts 按 category 拼出来，同一个 category 下所有 Case
 * 拿到的是同一段文字。去重后只剩一句，看上去像「一条 Case 提供了一句证据」，
 * 实际上跟这条 Case 没有任何关系。放它进来会盖掉 SKILL_DEFINITIONS 里人工写的
 * methodSteps，最后渲染进用户可下载的 SKILL.md。
 */
test("全是 category 模板句时，人工 methodSteps 和描述一个字都不动", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
    {
      ...caseItem("a-2", "飞船尺度转换", "video", "Alice", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.deepEqual(shared.methodSteps, [...ACTION_SKILL.methodSteps["zh-CN"]]);
  assert.equal(shared.description, ACTION_SKILL.description["zh-CN"]);
  // 模板句一个字都不该漏进 Skill 文案里。
  for (const note of VIDEO_TEMPLATE_NOTES) {
    assert.doesNotMatch(shared.description, new RegExp(note.slice(0, 12)));
  }
});

test("一真一模板凑不出两条证据，仍然退回人工 methodSteps", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成尺度转换。"]),
    },
    {
      ...caseItem("a-2", "飞船尺度转换", "video", "Alice", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.deepEqual(shared.methodSteps, [...ACTION_SKILL.methodSteps["zh-CN"]]);
  assert.equal(shared.description, ACTION_SKILL.description["zh-CN"]);
  assert.doesNotMatch(shared.description, /箭矢微观战场/);
});

test("两条以上真实证据跨 Case 复现时才允许覆盖，且描述里的数字属实", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成尺度转换。"]),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进保持方向一致。"]),
    },
    {
      ...caseItem("c-1", "没有复盘的案例", "video", "Carol", ["battle"]),
      ...templated(VIDEO_TEMPLATE_NOTES),
    },
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);

  // 覆盖成立：两步都来自真实复盘，且分别来自两条不同 Case。
  assert.deepEqual(shared.methodSteps, [
    "镜头持续追随同一支箭完成尺度转换。",
    "先锁定运动主体，再用连续推进保持方向一致。",
  ]);
  // Skill 一共 3 条 Case，但只有 2 条出了证据；描述里必须说 2 不能说 3。
  assert.match(shared.description, /2 位作者的 2 个已发布 Case/);
  assert.doesNotMatch(shared.description, /3 个已发布 Case/);
  // 只出模板句的那条不能被列成证据案例。
  assert.doesNotMatch(shared.description, /没有复盘的案例/);
  assert.match(shared.description, /箭矢微观战场/);
  assert.match(shared.description, /微观战争/);
});

/**
 * 没打标就当模板句处理（fail closed）。任何新的取数路径如果忘了带 source，
 * 结果是「少说一句」而不是「把套话当证据」。
 */
test("没打标的 promptContributionNotes 一律不当证据", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      promptContributionNotes: ["镜头持续追随同一支箭完成尺度转换。"],
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      promptContributionNotes: ["先锁定运动主体，再用连续推进保持方向一致。"],
    },
    caseItem("c-1", "第三条", "video", "Carol", ["battle"]),
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.deepEqual(shared.methodSteps, [...ACTION_SKILL.methodSteps["zh-CN"]]);
});

test("resultBreakdown 不需要打标，它本身就是人写的复盘", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      resultBreakdown: ["镜头持续追随同一支箭。", "尺度从宏观切到微观。", "全程不切镜。"],
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      resultBreakdown: ["先锁定运动主体。", "再用连续推进保持方向。", "结尾收在同一主体上。"],
    },
    caseItem("c-1", "第三条", "video", "Carol", ["battle"]),
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.deepEqual(shared.methodSteps, [
    "镜头持续追随同一支箭。",
    "先锁定运动主体。",
  ]);
});

test("one case cannot carry the recurrence claim on its own", () => {
  const catalog = deriveSkillCatalog([
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      // 一个 Case 的 resultBreakdown 本身就是三段，够填满三个方法步骤。
      resultBreakdown: [
        "镜头持续追随同一支箭。",
        "尺度从宏观切到微观。",
        "全程不切镜。",
      ],
    },
    caseItem("a-2", "飞船尺度转换", "video", "Alice", ["battle"]),
    caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  // 只有一个 Case 出证据时退回定义模板，不拼跨案例断言也不列证据案例。
  assert.doesNotMatch(shared.description, /箭矢微观战场/);
  assert.deepEqual(shared.methodSteps, [...ACTION_SKILL.methodSteps["zh-CN"]]);
});

/**
 * 描述里不写「反复出现 / repeatedly」：evidenceStep 是某一条 Case 写下的句子，
 * 我们只验证了「有 N 条 Case 各自留了复盘」，没验证这个动作在 N 条里都出现过。
 */
test("描述不做未经验证的「反复出现」断言", () => {
  const cases = [
    {
      ...caseItem("a-1", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成尺度转换。"]),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进保持方向一致。"]),
    },
    caseItem("c-1", "第三条", "video", "Carol", ["battle"]),
  ];
  const zh = findActionSkill(deriveSkillCatalog(cases, "zh-CN"));
  assert.doesNotMatch(zh.description, /反复出现/);
  assert.match(zh.description, /各自写下了可核对的做法，例如：/);

  const en = findActionSkill(
    deriveSkillCatalog(
      [
        {
          ...caseItem("a-1", "battle-arrow", "video", "Alice", ["battle"]),
          ...authored(["Track one subject through the whole scale change."]),
        },
        {
          ...caseItem("b-1", "battle-macro", "video", "Bob", ["battle"]),
          ...authored(["Lock the moving subject before pushing in."]),
        },
        caseItem("c-1", "battle-third", "video", "Carol", ["battle"]),
      ],
      "en"
    )
  );
  assert.doesNotMatch(en.description, /repeatedly/i);
  assert.match(en.description, /document how they built this, for example:/);
});

test("evidence examples name the cases that actually contributed a step", () => {
  const catalog = deriveSkillCatalog([
    // 排在最前但一句证据都没有，不该被当成证据案例列出来。
    caseItem("a-1", "没有证据的案例", "video", "Alice", ["battle"]),
    caseItem("a-2", "同样没有证据", "video", "Alice", ["battle"]),
    {
      ...caseItem("a-3", "箭矢微观战场", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成尺度转换。"]),
    },
    {
      ...caseItem("b-1", "微观战争", "video", "Bob", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进保持方向一致。"]),
    },
  ]);
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.match(shared.description, /2 位作者的 2 个已发布 Case/);
  assert.doesNotMatch(shared.description, /4 个已发布 Case/);
  assert.match(shared.description, /箭矢微观战场/);
  assert.match(shared.description, /微观战争/);
  assert.doesNotMatch(shared.description, /没有证据的案例|同样没有证据/);
});

test("English catalog drops examples whose titles have no translation", () => {
  const catalog = deriveSkillCatalog(
    [
      {
        ...caseItem("a-1", "中文标题一", "video", "Alice", ["battle"]),
        ...authored(["Track one subject through the scale change."]),
      },
      {
        ...caseItem("b-1", "中文标题二", "video", "Bob", ["battle"]),
        ...authored(["Lock the subject first, then push in."]),
      },
      caseItem("c-1", "third", "video", "Carol", ["battle"]),
    ],
    "en"
  );
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  // 证据句是英文的，描述保留；但标题没翻译，举例整段省掉而不是拼中文进去。
  assert.match(shared.description, /2 published cases from 2 creators/);
  assert.doesNotMatch(shared.description, /[一-鿿]/);
  assert.doesNotMatch(shared.description, /Examples:/);
});

test("English catalog never splices Chinese evidence into descriptions or steps", () => {
  const cases = [
    {
      ...caseItem("a-1", "battle-arrow", "video", "Alice", ["battle"]),
      ...authored(["镜头持续追随同一支箭完成尺度转换。"]),
    },
    {
      ...caseItem("a-2", "battle-ship", "video", "Alice", ["battle"]),
      ...authored(["先锁定运动主体，再用连续推进保持方向一致。"]),
    },
    {
      ...caseItem("b-1", "battle-macro", "video", "Bob", ["battle"]),
      ...authored(["镜头不切，全程一镜到底。"]),
    },
  ];
  const catalog = deriveSkillCatalog(cases, "en");
  const shared = findActionSkill(catalog);
  assert.ok(shared);
  assert.doesNotMatch(shared.description, /[一-鿿]/);
  for (const step of shared.methodSteps) {
    assert.doesNotMatch(step, /[一-鿿]/);
  }

  // 中文目录同一批数据仍然拿得到证据，说明跳过只发生在 en。
  const zh = findActionSkill(deriveSkillCatalog(cases, "zh-CN"));
  assert.match(zh.description, /各自写下了可核对的做法/);
});
