import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CASES_CACHE_TAG,
  CASES_CACHE_TTL_SECONDS,
  CaseRowsUnavailableError,
  memoizeInProcess,
} from "../../../src/lib/case-cache-policy.ts";

const CASES_TS = readFileSync(
  new URL("../../../src/lib/cases.ts", import.meta.url),
  "utf8"
);

test("缓存窗口和三个动态列表页的 revalidate 对齐", () => {
  assert.equal(CASES_CACHE_TTL_SECONDS, 3_600);

  // 这三个页面读 searchParams，页面级 revalidate 已经不生效了，
  // 但它仍然是「内容多久算旧」的唯一声明，取数层的窗口必须跟着它走。
  for (const page of ["cases", "creators", "skills"]) {
    const source = readFileSync(
      new URL(`../../../src/app/[lang]/${page}/page.tsx`, import.meta.url),
      "utf8"
    );
    const declared = source.match(/export const revalidate = ([\d_]+)/);
    assert.ok(declared, `${page}/page.tsx 没有声明 revalidate`);
    assert.equal(
      Number(declared[1].replaceAll("_", "")),
      CASES_CACHE_TTL_SECONDS,
      `${page} 的 revalidate 和缓存窗口不一致`
    );
  }
});

test("tag 是稳定常量，发布链路要靠它做 revalidateTag", () => {
  assert.equal(CASES_CACHE_TAG, "goodcase:cases");
  assert.equal(typeof CASES_CACHE_TAG, "string");
  assert.ok(CASES_CACHE_TAG.length > 0);
});

test("同样的参数只回源一次", async () => {
  let calls = 0;
  const load = memoizeInProcess(async (locale) => {
    calls += 1;
    return `${locale}:${calls}`;
  });

  const [a, b] = await Promise.all([load("zh-CN"), load("zh-CN")]);
  const c = await load("zh-CN");

  assert.equal(calls, 1);
  assert.equal(a, "zh-CN:1");
  assert.equal(b, "zh-CN:1");
  assert.equal(c, "zh-CN:1");
});

test("locale 不同就分开取，/en 不会吃到 /zh-CN 的结果", async () => {
  const seen = [];
  const load = memoizeInProcess(async (locale) => {
    seen.push(locale);
    return locale;
  });

  assert.equal(await load("zh-CN"), "zh-CN");
  assert.equal(await load("en"), "en");
  await load("zh-CN");
  await load("en");

  assert.deepEqual(seen, ["zh-CN", "en"]);
});

test("多个维度一起进键：locale 相同但 slug 集合不同不能互相串", async () => {
  const seen = [];
  const load = memoizeInProcess(async (locale, slugKey) => {
    seen.push(`${locale}|${slugKey}`);
    return slugKey;
  });

  await load("zh-CN", "");
  await load("zh-CN", "a,b");
  await load("en", "a,b");
  await load("zh-CN", "a,b");

  assert.deepEqual(seen, ["zh-CN|", "zh-CN|a,b", "en|a,b"]);
});

test("失败不留在 memo 里，下一次重新取", async () => {
  let calls = 0;
  const load = memoizeInProcess(async () => {
    calls += 1;
    if (calls === 1) {
      throw new CaseRowsUnavailableError("supabase timeout");
    }
    return "ok";
  });

  await assert.rejects(load(), /Case rows unavailable: supabase timeout/);
  assert.equal(await load(), "ok");
  assert.equal(calls, 2);
});

test("取数层的失败路径一律抛出，绝不返回可缓存的降级值", () => {
  // 缓存回调里出现 `return null` 就意味着降级结果会被写进缓存窗口。
  const loaders = CASES_TS.matchAll(
    /cacheCaseRows\(\s*"[^"]+",\s*async function [\s\S]*?\n  \}\n\);/g
  );
  const bodies = [...loaders].map((match) => match[0]);
  assert.equal(bodies.length, 5, "cacheCaseRows 的包装数量变了，测试要跟着更新");

  for (const body of bodies) {
    const name = body.match(/cacheCaseRows\(\s*"([^"]+)"/)[1];
    assert.ok(
      body.includes("throw new CaseRowsUnavailableError"),
      `${name} 缺少失败抛出路径`
    );
    assert.equal(
      /\breturn null\b/.test(body),
      false,
      `${name} 在缓存回调里返回了 null，降级结果会被缓存`
    );
  }
});

test("React cache 仍然包在跨请求缓存外面", () => {
  // 顺序反了的话，每次请求都会跳过渲染内去重直接查 Data Cache，
  // 映射和 enrich 的结果在同一次渲染里也不再共享。
  for (const wrapper of [
    "fetchCaseIndexUncached",
    "fetchCaseCardsByKeyUncached",
    "fetchCaseDetailRowUncached",
    "fetchPublishedCaseCountUncached",
  ]) {
    assert.ok(
      CASES_TS.includes(`cache(async function ${wrapper}`) ||
        CASES_TS.includes(`cache(\n  async function ${wrapper}`),
      `${wrapper} 不再被 React cache 包裹`
    );
  }

  assert.equal(
    /cacheCaseRows\(\s*"[^"]+",\s*cache\(/.test(CASES_TS),
    false,
    "跨请求缓存包在了 React cache 外面，顺序反了"
  );
});

test("三档取数的缓存名字互不相同", () => {
  const names = [...CASES_TS.matchAll(/cacheCaseRows\(\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(names, [
    "case-index-rows",
    "case-card-rows",
    "case-result-breakdown-rows",
    "case-detail-row",
    "case-published-count",
  ]);
  assert.equal(new Set(names).size, names.length);
});
