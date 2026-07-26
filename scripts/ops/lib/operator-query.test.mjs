import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperatorHref,
  normalizeOperatorSearch,
  parseOperatorQuery,
} from "../../../src/lib/operator/query.ts";

test("operator query defaults to the pending candidate queue", () => {
  assert.deepEqual(parseOperatorQuery({}), {
    view: "candidates",
    status: "pending",
    feedbackStatus: "open",
    category: "all",
    origin: "all",
    query: "",
    page: 1,
    candidateId: null,
  });
});

test("operator query rejects unsafe filters and invalid candidate ids", () => {
  const parsed = parseOperatorQuery({
    status: "deleted",
    page: "-5",
    candidate: "not-a-uuid",
    q: "  @creator_(case),  ",
  });

  assert.equal(parsed.status, "pending");
  assert.equal(parsed.page, 1);
  assert.equal(parsed.candidateId, null);
  assert.equal(parsed.query, "@creator case");
});

test("operator search keeps readable Chinese and removes PostgREST grammar", () => {
  assert.equal(
    normalizeOperatorSearch(" 3D 游戏%,(测试)_作者 "),
    "3D 游戏 测试 作者"
  );
});

test("operator href keeps one route and omits default filters", () => {
  const parsed = parseOperatorQuery({});
  assert.equal(buildOperatorHref(parsed), "/operator");
  assert.equal(
    buildOperatorHref(parsed, {
      status: "approved",
      page: 2,
      candidateId: "7c347c23-20f3-4fc8-949f-030698f3809c",
    }),
    "/operator?status=approved&page=2&candidate=7c347c23-20f3-4fc8-949f-030698f3809c"
  );
});
