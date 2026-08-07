import test from "node:test";
import assert from "node:assert/strict";
import { diversifyByCreator } from "./creator-diversity.mjs";

test("creator diversity keeps all cases and breaks long creator runs", () => {
  const items = [
    { slug: "a1", creator: "Alice" },
    { slug: "a2", creator: "Alice" },
    { slug: "a3", creator: "Alice" },
    { slug: "b1", creator: "Bob" },
    { slug: "c1", creator: "Carol" },
  ];
  const result = diversifyByCreator(items);

  assert.deepEqual(result.map((item) => item.slug), ["a1", "a2", "b1", "a3", "c1"]);
  assert.deepEqual(new Set(result.map((item) => item.slug)), new Set(items.map((item) => item.slug)));
});

test("creator diversity falls back without dropping items when one creator dominates", () => {
  const items = [{ slug: "a1", creator: "Alice" }, { slug: "a2", creator: "Alice" }];
  assert.deepEqual(diversifyByCreator(items).map((item) => item.slug), ["a1", "a2"]);
});

