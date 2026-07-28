import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import manifest from "../../../src/generated/installable-skills.json" with { type: "json" };
import {
  assertValidSkillName,
  buildInstallableSkillFiles,
} from "../../skills/lib/render-installable-skill.mjs";

const root = process.cwd();

test("Skill renderer produces a strict executable bundle", () => {
  const files = buildInstallableSkillFiles({
    slug: "test-motion-workflow",
    baseSlug: "test-motion-workflow",
    baseTitle: "Motion workflow",
    kind: "shared",
    title: "Motion workflow",
    description: "A test method",
    category: "video",
    methodSteps: ["Set the subject", "Plan the motion", "Verify continuity"],
    cases: [
      {
        slug: "case-one",
        title: "Case one",
        category: "video",
        creator: "Alice",
        sourceUrl: "https://example.com/source",
      },
    ],
    creators: [{ name: "Alice", caseCount: 1 }],
    caseCount: 1,
    creatorCount: 1,
    generalSkillSlug: null,
  });

  assert.match(files["SKILL.md"], /^---\nname: test-motion-workflow\n/);
  assert.match(files["SKILL.md"], /## Inputs/);
  assert.match(files["SKILL.md"], /## Workflow/);
  assert.match(files["SKILL.md"], /## Verification/);
  assert.match(files["SKILL.md"], /reference image/);
  assert.doesNotMatch(files["SKILL.md"], /TODO/);
  assert.match(files["references/cases.md"], /GoodCase evidence/);
});

test("invalid Agent Skill names are rejected", () => {
  assert.throws(() => assertValidSkillName("Bad Skill"));
  assert.throws(() => assertValidSkillName("claude-method"));
  assert.throws(() => assertValidSkillName("a".repeat(65)));
});

test("installable manifest only lists complete packaged Skills", () => {
  assert.ok(manifest.length > 0);
  for (const item of manifest) {
    assertValidSkillName(item.slug);
    const skillDir = path.join(root, "skills", "generated", item.slug);
    const skillMd = path.join(skillDir, "SKILL.md");
    const evidence = path.join(skillDir, "references", "cases.md");
    const archive = path.join(
      root,
      "public",
      "skill-packages",
      `${item.slug}.skill`
    );

    assert.equal(existsSync(skillMd), true, skillMd);
    assert.equal(existsSync(evidence), true, evidence);
    assert.equal(existsSync(archive), true, archive);
    assert.match(readFileSync(skillMd, "utf8"), new RegExp(`name: ${item.slug}`));
  }
});
