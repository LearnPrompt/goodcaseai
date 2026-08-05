import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BATCH_SLUGS,
  cleanCaseSlug,
  cleanSessionId,
  countReactionRows,
  isMissingTableError,
  isReactionKind,
  isUniqueViolation,
  parseReactionWriteBody,
  parseSlugQuery,
} from "../../../src/lib/reactions-payload.ts";

const VALID_SESSION = "1f0d3f6a-2b6e-4a55-9c3e-7f2a1d4b8c90";

test("only the two known reaction kinds pass the whitelist", () => {
  assert.equal(isReactionKind("like"), true);
  assert.equal(isReactionKind("retest_vote"), true);
  assert.equal(isReactionKind("Like"), false);
  assert.equal(isReactionKind("dislike"), false);
  assert.equal(isReactionKind(""), false);
  assert.equal(isReactionKind(null), false);
  assert.equal(isReactionKind(["like"]), false);
});

test("slug validation accepts real slugs and rejects everything else", () => {
  assert.equal(cleanCaseSlug("case-7daa3577470c"), "case-7daa3577470c");
  assert.equal(cleanCaseSlug("real-case-01-umesh-ai"), "real-case-01-umesh-ai");
  assert.equal(cleanCaseSlug("  case-7daa3577470c  "), "case-7daa3577470c");

  assert.equal(cleanCaseSlug(""), "");
  assert.equal(cleanCaseSlug("case--double"), "");
  assert.equal(cleanCaseSlug("-leading"), "");
  assert.equal(cleanCaseSlug("trailing-"), "");
  assert.equal(cleanCaseSlug("中文 slug"), "");
  assert.equal(cleanCaseSlug("a".repeat(121)), "");
  assert.equal(cleanCaseSlug(42), "");
  assert.equal(cleanCaseSlug(null), "");
});

test("slug validation accepts the CJK slug that actually exists in production", () => {
  // 线上 395 条 cases 里有一条带中文的 slug，详情页 URL 已经在用它。
  // 只允许 ASCII 的规则会让整个列表页的批量查询 400，实测踩过。
  assert.equal(
    cleanCaseSlug("sensenova-u1-pro-功能页面"),
    "sensenova-u1-pro-功能页面"
  );
});

test("slug validation blocks PostgREST filter metacharacters", () => {
  // 这些字符在 PostgREST 的 in.(...) / or=(...) 语法里有含义，绝不能进过滤器。
  for (const hostile of [
    "case,other",
    "case)",
    "case*",
    "case.eq",
    "case'or'1",
    "case%2C",
    'case"quoted"',
    "case slug",
    "case_underscore",
  ]) {
    assert.equal(cleanCaseSlug(hostile), "", `should reject ${hostile}`);
  }
});

test("session id validation matches the analytics session value range", () => {
  assert.equal(cleanSessionId(VALID_SESSION), VALID_SESSION);
  assert.equal(cleanSessionId("1754400000000-abc12xyz"), "1754400000000-abc12xyz");

  assert.equal(cleanSessionId("short"), "");
  assert.equal(cleanSessionId("a".repeat(101)), "");
  assert.equal(cleanSessionId("has space here"), "");
  assert.equal(cleanSessionId("has_underscore_x"), "");
  assert.equal(cleanSessionId(undefined), "");
});

test("the shared ephemeral fallback is not an acceptable dedupe key", () => {
  // 埋点在拿不到存储时用 "ephemeral"，形状上能过正则，但所有这类浏览器
  // 会挤在同一个防重键上，必须显式拒掉。
  assert.equal(cleanSessionId("ephemeral"), "");
});

test("write body validation reports the first offending field", () => {
  assert.deepEqual(
    parseReactionWriteBody({
      slug: "case-7daa3577470c",
      kind: "like",
      sessionId: VALID_SESSION,
    }),
    {
      ok: true,
      value: {
        caseSlug: "case-7daa3577470c",
        kind: "like",
        sessionId: VALID_SESSION,
      },
    }
  );

  assert.deepEqual(parseReactionWriteBody(null), {
    ok: false,
    error: "invalid body",
  });
  assert.deepEqual(parseReactionWriteBody([]), {
    ok: false,
    error: "invalid body",
  });
  assert.deepEqual(
    parseReactionWriteBody({ slug: "bad slug", kind: "like", sessionId: VALID_SESSION }),
    { ok: false, error: "invalid slug" }
  );
  assert.deepEqual(
    parseReactionWriteBody({
      slug: "case-7daa3577470c",
      kind: "boost",
      sessionId: VALID_SESSION,
    }),
    { ok: false, error: "invalid kind" }
  );
  assert.deepEqual(
    parseReactionWriteBody({
      slug: "case-7daa3577470c",
      kind: "retest_vote",
      sessionId: "nope",
    }),
    { ok: false, error: "invalid sessionId" }
  );
});

test("slug query parsing handles single, batch, duplicate and oversized input", () => {
  assert.deepEqual(parseSlugQuery("case-a", null), {
    ok: true,
    slugs: ["case-a"],
  });
  assert.deepEqual(parseSlugQuery(null, "case-a,case-b,case-a"), {
    ok: true,
    slugs: ["case-a", "case-b"],
  });

  assert.deepEqual(parseSlugQuery(null, null), {
    ok: false,
    error: "slug is required",
  });
  assert.deepEqual(parseSlugQuery("   ", null), {
    ok: false,
    error: "slug is required",
  });
  assert.deepEqual(parseSlugQuery(null, "case-a,bad_slug"), {
    ok: false,
    error: "invalid slug",
  });

  const tooMany = Array.from({ length: MAX_BATCH_SLUGS + 1 }, (_, i) => `case-${i}`);
  assert.deepEqual(parseSlugQuery(null, tooMany.join(",")), {
    ok: false,
    error: "too many slugs",
  });
});

test("row aggregation buckets by slug and kind, and zero-fills asked slugs", () => {
  const counts = countReactionRows(
    [
      { case_slug: "case-a", kind: "like" },
      { case_slug: "case-a", kind: "like" },
      { case_slug: "case-a", kind: "retest_vote" },
      { case_slug: "case-b", kind: "retest_vote" },
      // 未知 kind 和不在查询范围里的 slug 都直接忽略，不炸也不算进去。
      { case_slug: "case-a", kind: "boost" },
      { case_slug: "case-unrelated", kind: "like" },
      { kind: "like" },
    ],
    ["case-a", "case-b", "case-c"]
  );

  assert.deepEqual(counts, {
    "case-a": { like: 2, retestVote: 1 },
    "case-b": { like: 0, retestVote: 1 },
    "case-c": { like: 0, retestVote: 0 },
  });
});

test("missing-table detection covers both Postgres and PostgREST shapes", () => {
  // Postgres 原生 undefined_table。
  assert.equal(isMissingTableError({ code: "42P01" }), true);
  // supabase-js 走 PostgREST，表没建时实际拿到的是这个。
  assert.equal(
    isMissingTableError({
      code: "PGRST205",
      message: "Could not find the table 'public.case_reactions' in the schema cache",
    }),
    true
  );
  // 只有 message 没有码也要认出来。
  assert.equal(
    isMissingTableError({
      message: 'relation "public.case_reactions" does not exist',
    }),
    true
  );

  assert.equal(isMissingTableError(null), false);
  assert.equal(isMissingTableError({ code: "23505" }), false);
  assert.equal(
    isMissingTableError({ message: 'relation "public.cases" does not exist' }),
    false
  );
  assert.equal(isMissingTableError("42P01"), false);
});

test("unique violation is recognised so repeated reactions stay idempotent", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "42P01" }), false);
  assert.equal(isUniqueViolation(undefined), false);
});
