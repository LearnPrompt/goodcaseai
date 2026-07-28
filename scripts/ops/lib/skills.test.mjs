import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveSkillCatalog,
  getCaseSkillLinks,
  getCreatorMethods,
} from "../../../src/lib/skills.ts";

function caseItem(slug, title, category, creator, tags = []) {
  return { slug, title, category, creator, tags };
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
