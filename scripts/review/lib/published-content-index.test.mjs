import test from "node:test";
import assert from "node:assert/strict";
import { loadPublishedContentIndex } from "./published-content-index.mjs";

/** 只实现被用到的链式方法，range 负责按页切数据。 */
function fakeSupabase(rowsBySelect, { onQuery } = {}) {
  return {
    from() {
      const state = { select: "", categories: null };
      const builder = {
        select(columns) {
          state.select = columns;
          return builder;
        },
        eq() {
          return builder;
        },
        in(_column, values) {
          state.categories = values;
          return builder;
        },
        order() {
          return builder;
        },
        range(from, to) {
          onQuery?.({ ...state, from, to });
          const source = rowsBySelect(state);
          return Promise.resolve({
            data: source.slice(from, to + 1),
            error: null,
          });
        },
      };
      return builder;
    },
  };
}

test("published content index pages past the PostgREST row cap", async () => {
  const all = Array.from({ length: 2500 }, (_, index) => ({
    slug: `case-${String(index).padStart(4, "0")}`,
    source_candidate_id: index,
    source_url: `https://example.com/${index}`,
  }));
  const rows = await loadPublishedContentIndex(
    fakeSupabase(() => all),
    [],
    1000
  );
  assert.equal(rows.length, 2500);
});

test("published content index only pulls prompt_full for the batch categories", async () => {
  const queries = [];
  const supabase = fakeSupabase(
    (state) =>
      state.select.includes("prompt_full")
        ? [
            {
              slug: "case-1",
              category: "video",
              creator_name: "Alice",
              prompt_full: "锁定同一个主体",
            },
          ]
        : [
            { slug: "case-1", source_candidate_id: 1, source_url: "https://a" },
            { slug: "case-2", source_candidate_id: 2, source_url: "https://b" },
          ],
    { onQuery: (state) => queries.push(state) }
  );

  const rows = await loadPublishedContentIndex(supabase, ["video"], 1000);

  const promptQuery = queries.find((query) => query.select.includes("prompt_full"));
  assert.deepEqual(promptQuery.categories, ["video"]);
  // 来源 URL 那一趟是全量，但不带 prompt_full 这个最长的字段。
  const sourceQuery = queries.find((query) => !query.select.includes("prompt_full"));
  assert.equal(sourceQuery.categories, null);

  // 两趟按 slug 合并：case-1 拿到 prompt，case-2 只有来源信息。
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.slug === "case-1").prompt_full, "锁定同一个主体");
  assert.equal(rows.find((row) => row.slug === "case-2").prompt_full, undefined);
  assert.equal(rows.find((row) => row.slug === "case-2").source_url, "https://b");
});

test("published content index skips the prompt pass when no category is in play", async () => {
  const queries = [];
  const supabase = fakeSupabase(() => [], {
    onQuery: (state) => queries.push(state),
  });
  await loadPublishedContentIndex(supabase, [], 1000);
  assert.equal(
    queries.some((query) => query.select.includes("prompt_full")),
    false
  );
});
