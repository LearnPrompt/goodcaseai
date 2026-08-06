import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVENANCE_METHOD,
  PROVENANCE_POLICY_EFFECTIVE_AT,
  buildCaseProvenance,
} from "../../../src/lib/provenance.ts";

test("有原帖链接时声明已核验，并带上方法与规则生效日", () => {
  const provenance = buildCaseProvenance(
    "https://x.com/example/status/123",
    "zh-CN"
  );
  assert.equal(provenance.sourceUrl, "https://x.com/example/status/123");
  assert.equal(provenance.verifiedAgainstSource, true);
  assert.equal(provenance.method, PROVENANCE_METHOD);
  assert.equal(provenance.policyEffectiveAt, PROVENANCE_POLICY_EFFECTIVE_AT);
  assert.match(PROVENANCE_POLICY_EFFECTIVE_AT, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(provenance.note.length > 0);
});

test("没有原帖链接就不做任何核验声明", () => {
  // 这是这个字段的底线：没有可对照的原帖时把布尔置 true 就是虚报，
  // 而 provenance 整个的价值建立在它不虚报上。
  for (const empty of [null, undefined, "", "   "]) {
    const provenance = buildCaseProvenance(empty, "zh-CN");
    assert.equal(provenance.sourceUrl, null);
    assert.equal(provenance.verifiedAgainstSource, false);
    assert.equal(provenance.method, null);
    assert.equal(provenance.policyEffectiveAt, null);
    assert.ok(provenance.note.length > 0);
  }
});

test("note 跟随 locale，其余字段与语言无关", () => {
  const zh = buildCaseProvenance("https://x.com/a/status/1", "zh-CN");
  const en = buildCaseProvenance("https://x.com/a/status/1", "en");

  assert.notEqual(zh.note, en.note);
  assert.match(en.note, /[A-Za-z]/);
  assert.equal(zh.verifiedAgainstSource, en.verifiedAgainstSource);
  assert.equal(zh.method, en.method);
  assert.equal(zh.policyEffectiveAt, en.policyEffectiveAt);
});

test("首尾空白被裁掉，不产出带空格的 URL", () => {
  assert.equal(
    buildCaseProvenance("  https://x.com/a/status/1  ", "en").sourceUrl,
    "https://x.com/a/status/1"
  );
});
