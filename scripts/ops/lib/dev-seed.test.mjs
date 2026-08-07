import assert from "node:assert/strict";
import test from "node:test";
import {
  CASE_COLUMNS,
  assertDifferentHosts,
  chunkRows,
  fetchPublishedCases,
  normalizeOrigin,
  toLocalCaseRow,
} from "./dev-seed.mjs";

test("seed refuses identical source and target hosts", () => {
  assert.throws(
    () => assertDifferentHosts(
      "https://prod.supabase.co",
      "https://prod.supabase.co/",
    ),
    /source and target Supabase hosts are identical/,
  );
  assert.doesNotThrow(() =>
    assertDifferentHosts("https://prod.supabase.co", "https://local.supabase.co"),
  );
});

test("seed rows omit production ids, foreign keys, and generated columns", () => {
  const row = toLocalCaseRow({
    id: "production-id",
    slug: "case-1",
    title: "Case",
    source_candidate_id: "production-candidate-id",
    prompt_preview_zh: "generated",
    is_published: true,
  });
  assert.deepEqual(row, { slug: "case-1", title: "Case", is_published: true });
  assert.equal(CASE_COLUMNS.includes("prompt_preview_zh"), false);
});

test("seed rows are chunked for bounded upserts", () => {
  assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("seed output origins never include credentials", () => {
  assert.equal(normalizeOrigin("https://user:password@local.supabase.co:443/path"), "https://local.supabase.co");
});

test("seed pagination follows returned rows when max-rows is below the page size", async () => {
  const all = Array.from({ length: 1200 }, (_, index) => ({ slug: `case-${index}` }));
  const sourceClient = {
    from() {
      const builder = {
        select(_columns, options) {
          builder.count = options?.count ?? null;
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        range(from, to) {
          return Promise.resolve({
            data: all.slice(from, to + 1).slice(0, 200),
            count: builder.count === "exact" ? all.length : null,
            error: null,
          });
        },
      };
      return builder;
    },
  };

  const rows = await fetchPublishedCases(sourceClient);
  assert.equal(rows.length, 1200);
  assert.equal(rows.at(-1).slug, "case-1199");
});
