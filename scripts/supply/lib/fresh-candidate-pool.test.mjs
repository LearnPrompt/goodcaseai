import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateToSourceReviewItem,
  selectFreshCandidatePool,
} from "./fresh-candidate-pool.mjs";

function candidate(id, sourceUrl, category = "image") {
  return {
    id,
    title: `Case ${id}`,
    category,
    source_url: sourceUrl,
    creator_name: "Creator",
    summary: "Reusable method",
    prompt_full: "Complete prompt",
    media_kind: "image",
    media_url: `https://media.example.com/${id}.jpg`,
  };
}

test("fresh candidate pool excludes production and cross-input duplicates", () => {
  const result = selectFreshCandidatePool(
    [
      {
        label: "v3",
        items: [
          candidate("1", "https://x.com/a/status/1"),
          candidate("2", "https://x.com/a/status/2"),
        ],
      },
      {
        label: "v4",
        items: [
          candidate("2b", "https://x.com/i/status/2"),
          candidate("3", "https://x.com/a/status/3"),
        ],
      },
    ],
    {
      existingUrls: ["https://x.com/i/status/1"],
      category: "image",
      limit: 10,
    }
  );

  assert.deepEqual(
    result.items.map((item) => item.id),
    ["2", "3"]
  );
  assert.equal(result.stats.existingOrLocalDuplicates, 2);
});

test("fresh candidate mapper produces a complete source review item", () => {
  const item = candidateToSourceReviewItem(
    candidate("1", "https://x.com/a/status/1"),
    0
  );
  assert.equal(item.candidateType, "case");
  assert.equal(item.checks.prompt, true);
  assert.equal(item.sourceLabel, "YouMind Prompt Library");
});
