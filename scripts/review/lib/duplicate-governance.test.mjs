import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicateContent } from "./duplicate-governance.mjs";

const base = {
  slug: "new-case",
  category: "image",
  source_url: "https://example.com/post?id=2&utm_source=test",
  creator_name: "Alice",
  prompt_full: "A cinematic orange cat on a wooden table, soft natural light, shallow depth of field.",
};

test("duplicate governance blocks canonical-equivalent source URLs", () => {
  const result = findDuplicateContent({
    candidate: base,
    existingCases: [{
      slug: "old-case",
      category: "image",
      source_url: "https://example.com/post?id=2",
      prompt_full: "A completely different prompt",
    }],
  });

  assert.equal(result?.kind, "same-source");
  assert.equal(result?.existingSlug, "old-case");
});

test("duplicate governance blocks an exact prompt in the same category", () => {
  const result = findDuplicateContent({
    candidate: base,
    existingCases: [{
      slug: "old-case",
      category: "image",
      source_url: "https://example.com/other",
      creator_name: "Different creator",
      prompt_full: base.prompt_full,
    }],
  });

  assert.equal(result?.kind, "same-prompt");
});

test("duplicate governance blocks near prompts only for the same creator", () => {
  const result = findDuplicateContent({
    candidate: { ...base, prompt_full: base.prompt_full.replace("soft natural light", "soft natural lights") },
    existingCases: [{
      slug: "old-case",
      category: "image",
      creator_name: "Alice",
      prompt_full: base.prompt_full,
      source_url: "https://example.com/other",
    }],
  });

  assert.equal(result?.kind, "near-duplicate-prompt");
  assert.ok(result.similarity >= 0.92);
});

test("duplicate governance does not block a similar prompt from another creator", () => {
  const result = findDuplicateContent({
    candidate: { ...base, prompt_full: `${base.prompt_full} subtle film grain` },
    existingCases: [{
      slug: "old-case",
      category: "image",
      creator_name: "Bob",
      prompt_full: base.prompt_full,
      source_url: "https://example.com/other",
    }],
  });

  assert.equal(result, null);
});

test("duplicate governance can ignore the case being resumed", () => {
  assert.equal(
    findDuplicateContent({
      candidate: { ...base, slug: "same-case", id: "candidate-1" },
      existingCases: [{
        slug: "same-case",
        source_candidate_id: "candidate-1",
        category: "image",
        source_url: base.source_url,
        prompt_full: base.prompt_full,
      }],
      ignoreCandidateId: "candidate-1",
      ignoreSlug: "same-case",
    }),
    null
  );
});
