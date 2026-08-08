import test from "node:test";
import assert from "node:assert/strict";
import {
  assertWriteTarget,
  normalizeExpectedRef,
  resolveWriteTargetRef,
  LOCAL_PROJECT_REF,
} from "./write-target.mjs";

test("写入目标归一成 project ref，尾斜杠和大小写不算两个目标", () => {
  assert.equal(resolveWriteTargetRef("https://example-project.supabase.co"), "example-project");
  assert.equal(resolveWriteTargetRef("https://example-project.supabase.co/"), "example-project");
  assert.equal(resolveWriteTargetRef("https://Example-Project.supabase.co"), "example-project");
  assert.equal(resolveWriteTargetRef("http://127.0.0.1:54321"), LOCAL_PROJECT_REF);
  assert.equal(resolveWriteTargetRef("https://example.com"), null);
  assert.equal(resolveWriteTargetRef(""), null);
});

test("--expect-project 可以直接贴整个 URL", () => {
  assert.equal(normalizeExpectedRef("https://example-project.supabase.co/"), "example-project");
  assert.equal(normalizeExpectedRef(" Example-Project "), "example-project");
  assert.equal(normalizeExpectedRef(""), "");
});

/**
 * 这条是 issue #44 的核心：旧守卫写成
 *   if (env.PROD_SUPABASE_URL && url === env.PROD_SUPABASE_URL) throw
 * PROD_SUPABASE_URL 不在 .env.local 里（平时就是不在）时整条静默失效。
 * 现在没点名就直接拒绝，配没配 PROD_SUPABASE_URL 都一样。
 */
test("没有 --expect-project 一律拒绝执行，不看 PROD_SUPABASE_URL 配没配", () => {
  assert.throws(
    () => assertWriteTarget({ url: "https://live-project.supabase.co", expectedProject: "" }),
    /必须显式点名目标/
  );
  assert.throws(
    () =>
      assertWriteTarget({
        url: "https://live-project.supabase.co",
        expectedProject: "",
        prodSupabaseUrl: "https://live-project.supabase.co",
      }),
    /必须显式点名目标/
  );
});

test("点名和实际不一致直接拒绝执行", () => {
  assert.throws(
    () =>
      assertWriteTarget({
        url: "https://live-project.supabase.co",
        expectedProject: "sandbox-project",
      }),
    /拒绝执行/
  );
});

test("认不出是哪个 Supabase 项目就拒绝执行", () => {
  assert.throws(
    () => assertWriteTarget({ url: "https://db.example.com", expectedProject: "whatever" }),
    /认不出写入目标/
  );
  assert.throws(() => assertWriteTarget({ url: "", expectedProject: "whatever" }), /NEXT_PUBLIC_SUPABASE_URL/);
});

/**
 * 旧守卫的第二个洞：精确串比对，尾斜杠差一个字符就绕过去了。
 * 归一成 ref 之后，同一个项目的两种写法必须被判成同一个目标。
 */
test("尾斜杠差异不再是绕过守卫的口子", () => {
  const target = assertWriteTarget({
    url: "https://live-project.supabase.co/",
    expectedProject: "live-project",
    prodSupabaseUrl: "https://live-project.supabase.co",
  });
  assert.equal(target.projectRef, "live-project");
  assert.equal(target.isKnownProduction, true);
});

/**
 * fail-closed 不等于把生产堵死：复测回写生产是既定事实，显式点名就是合法姿势。
 */
test("显式点名生产 ref 时放行，并标出这是生产", () => {
  assert.deepEqual(
    assertWriteTarget({
      url: "https://live-project.supabase.co",
      expectedProject: "live-project",
      prodSupabaseUrl: "https://live-project.supabase.co",
    }),
    { projectRef: "live-project", isKnownProduction: true }
  );
  // 没配 PROD_SUPABASE_URL 时认不出哪个是生产，但点名一致照样放行。
  assert.deepEqual(
    assertWriteTarget({ url: "https://live-project.supabase.co", expectedProject: "live-project" }),
    { projectRef: "live-project", isKnownProduction: false }
  );
});
