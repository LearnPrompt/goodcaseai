import assert from "node:assert/strict";
import test from "node:test";
import {
  getSearchMatch,
  getSearchSnippet,
  rankSearchResults,
  splitHighlightedText,
} from "../../../src/lib/search.ts";

test("weighted search ranks title matches ahead of prompt-only matches", () => {
  const results = rankSearchResults(
    [
      { title: "A quiet poster", prompt: "Use a red identity anchor" },
      { title: "Identity reference sheet", prompt: "Keep the subject fixed" },
    ],
    "identity",
    (item) => [
      { key: "title", value: item.title, weight: 140 },
      { key: "prompt", value: item.prompt, weight: 40 },
    ]
  );
  assert.equal(results[0].item.title, "Identity reference sheet");
  assert.equal(results[0].match.field, "title");
});

test("search exposes a compact hit snippet and highlight parts", () => {
  const match = getSearchMatch(
    [{ key: "prompt", value: "A very long prompt with a stable character reference sheet near the end.", weight: 40 }],
    "reference sheet"
  );
  assert.ok(match);
  assert.match(getSearchSnippet(match, "reference sheet", 48), /reference sheet/);
  assert.deepEqual(splitHighlightedText("Keep the reference sheet stable", "reference sheet"), [
    { text: "Keep the ", matched: false },
    { text: "reference sheet", matched: true },
    { text: " stable", matched: false },
  ]);
});
