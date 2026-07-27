import assert from "node:assert/strict";
import test from "node:test";
import {
  isLocaleRoutablePath,
  localizeHref,
  normalizeLocale,
  splitLocalePathname,
} from "../../../src/i18n/config.ts";
import {
  enMessages,
  getMessages,
  zhCNMessages,
} from "../../../src/i18n/messages.ts";

test("locale path parsing keeps Chinese URLs stable and strips English prefix", () => {
  assert.deepEqual(splitLocalePathname("/cases/example"), {
    locale: "zh-CN",
    pathname: "/cases/example",
    hasLocalePrefix: false,
  });
  assert.deepEqual(splitLocalePathname("/en/cases/example"), {
    locale: "en",
    pathname: "/cases/example",
    hasLocalePrefix: true,
  });
  assert.deepEqual(splitLocalePathname("/en"), {
    locale: "en",
    pathname: "/",
    hasLocalePrefix: true,
  });
  assert.deepEqual(splitLocalePathname("/zh-CN/cases/example"), {
    locale: "zh-CN",
    pathname: "/cases/example",
    hasLocalePrefix: true,
  });
});

test("localized href preserves path, query and hash without double prefixes", () => {
  assert.equal(
    localizeHref("en", "/cases/example?q=video#prompt"),
    "/en/cases/example?q=video#prompt"
  );
  assert.equal(
    localizeHref("zh-CN", "/en/cases/example?q=video#prompt"),
    "/cases/example?q=video#prompt"
  );
  assert.equal(localizeHref("en", "/en"), "/en");
  assert.equal(localizeHref("zh-CN", "/en"), "/");
  assert.equal(localizeHref("en", "/zh-CN/cases/example"), "/en/cases/example");
  assert.equal(localizeHref("en", "https://example.com"), "https://example.com");
});

test("only page-like paths participate in locale rewrites", () => {
  assert.equal(isLocaleRoutablePath("/cases/example"), true);
  assert.equal(isLocaleRoutablePath("/feed.xml"), true);
  assert.equal(isLocaleRoutablePath("/llms.txt"), true);
  assert.equal(isLocaleRoutablePath("/api/public/cases"), false);
  assert.equal(isLocaleRoutablePath("/_next/static/file.js"), false);
  assert.equal(isLocaleRoutablePath("/icon.svg"), false);
});

test("locale normalization and message catalogs remain complete", () => {
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "zh-CN");
  assert.equal(getMessages("en").nav.cases, "Cases");
  assert.equal(getMessages("zh-CN").nav.cases, "案例");
  assert.deepEqual(Object.keys(enMessages), Object.keys(zhCNMessages));
  assert.deepEqual(Object.keys(enMessages.nav), Object.keys(zhCNMessages.nav));
  assert.deepEqual(
    Object.keys(enMessages.language),
    Object.keys(zhCNMessages.language)
  );
});
