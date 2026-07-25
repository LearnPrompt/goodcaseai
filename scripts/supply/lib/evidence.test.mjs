import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEvidence } from "./evidence.mjs";

test("evaluateEvidence accepts a case only when all four evidence checks pass", () => {
  const result = evaluateEvidence({
    sourceUrl: "https://x.com/carl/status/123",
    author: "@carl",
    resultUrls: ["https://example.com/result.png"],
    promptText: "Create a paper-cut poster.",
    promptIsPublic: true,
  });

  assert.equal(result.candidateType, "case");
  assert.equal(result.complete, true);
  assert.equal(result.safePromptText, "Create a paper-cut poster.");
});

test("evaluateEvidence does not treat a private or inferred prompt as public evidence", () => {
  const result = evaluateEvidence({
    sourceUrl: "https://x.com/carl/status/123",
    author: "@carl",
    resultUrls: ["https://example.com/result.png"],
    promptText: "An inferred prompt",
    promptIsPublic: false,
  });

  assert.equal(result.candidateType, "topic_seed");
  assert.equal(result.checks.method, false);
  assert.equal(result.safePromptText, null);
});

test("evaluateEvidence accepts reproducible steps instead of a full prompt", () => {
  const result = evaluateEvidence({
    sourceUrl: "https://github.com/example/project",
    author: "example",
    resultUrls: ["https://example.com/demo"],
    stepsSummary: "Install, run the demo, then select the video workflow.",
  });

  assert.equal(result.candidateType, "case");
  assert.equal(result.checks.method, true);
});

test("evaluateEvidence keeps incomplete discoveries as topic seeds", () => {
  const result = evaluateEvidence({
    sourceUrl: "https://example.com/news",
    author: "Example",
  });

  assert.equal(result.candidateType, "topic_seed");
  assert.deepEqual(result.checks, {
    source: true,
    author: true,
    result: false,
    method: false,
  });
});
