import assert from "node:assert/strict";
import test from "node:test";
import {
  mapSourceSampleToCandidate,
  sanitizeSourceText,
  selectSourceCandidates,
} from "./source-candidate-mapper.mjs";

function sample(overrides = {}) {
  return {
    sourceId: "comfy",
    sourceLabel: "Comfy Workflows",
    sourceUrl: "https://comfy.org/workflows/example-example/",
    title: "Example workflow",
    creator: "Alice",
    mediaUrl: "https://cdn.example.com/result.png",
    mediaKind: "image",
    promptText: "",
    method:
      "Upload one product image, preserve its proportions, then generate a clean commercial background with controlled lighting.",
    model: "ComfyUI",
    notes: "Not rerun by GoodCase.",
    license: "原页未明确，待人工复核",
    checks: { license: false },
    completeness: 1,
    candidateType: "case",
    ...overrides,
  };
}

test("candidate mapper preserves provenance and flags review gaps", () => {
  const candidate = mapSourceSampleToCandidate(
    sample({
      method:
        "Upload one product image, preserve its proportions, and generate a commercial background. 微信：1287723024",
    })
  );
  assert.equal(candidate.source_platform, "Comfy Workflows");
  assert.equal(candidate.evidence_level, "L1");
  assert.equal(candidate.prompt_full.startsWith("Upload one product"), true);
  assert.equal(candidate.prompt_full.includes("1287723024"), false);
  assert.equal(candidate.prompt_full.includes("微信：[已省略]"), true);
  assert.deepEqual(candidate.recommended_models, ["ComfyUI"]);
  assert.deepEqual(candidate.tags, [
    "source-comfy",
    "workflow-method",
    "not-rerun",
    "license-review",
  ]);
});

test("source text sanitizer removes direct contact identifiers", () => {
  assert.equal(
    sanitizeSourceText("联系作者 QQ: 12345678，邮箱 hello@example.com"),
    "联系作者 QQ: [已省略]，邮箱 [已省略邮箱]"
  );
});

test("source selection keeps complete cases and favors creator diversity", () => {
  const selected = selectSourceCandidates(
    [
      sample({ title: "Alice A" }),
      sample({ title: "Alice B" }),
      sample({ title: "Bob A", creator: "Bob" }),
      sample({ title: "Seed", candidateType: "topic_seed" }),
    ],
    { sourceIds: ["comfy"], maxPerSource: 2 }
  );

  assert.deepEqual(
    selected.map((item) => item.title),
    ["Alice A", "Bob A"]
  );
});
