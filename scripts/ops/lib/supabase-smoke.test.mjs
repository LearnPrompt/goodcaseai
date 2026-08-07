import test from "node:test";
import assert from "node:assert/strict";
import { assertTestTarget, projectRefFromUrl } from "./supabase-smoke.mjs";

test("projectRefFromUrl only accepts Supabase project URLs", () => {
  assert.equal(projectRefFromUrl("https://rywuhhixnyxpkbxytipj.supabase.co"), "rywuhhixnyxpkbxytipj");
  assert.equal(projectRefFromUrl("https://example.com"), null);
});

test("assertTestTarget rejects a wrong or production project", () => {
  assert.throws(
    () => assertTestTarget({
      url: "https://other.supabase.co",
      expectedProject: "rywuhhixnyxpkbxytipj",
      productionUrl: "https://prod.supabase.co",
    }),
    /期望测试项目/
  );
  assert.throws(
    () => assertTestTarget({
      url: "https://prod.supabase.co",
      expectedProject: "prod",
      productionUrl: "https://prod.supabase.co",
    }),
    /生产/
  );
});

