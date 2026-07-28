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
import { getEnglishCaseTranslation } from "../../../src/i18n/content.ts";
import { caseItems } from "../../../src/lib/mock-data.ts";

function messageKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return nested && typeof nested === "object"
      ? messageKeys(nested, path)
      : [path];
  });
}

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
  assert.deepEqual(messageKeys(enMessages), messageKeys(zhCNMessages));
  for (const messages of [enMessages, zhCNMessages]) {
    for (const key of messageKeys(messages)) {
      const value = key
        .split(".")
        .reduce((current, segment) => current[segment], messages);
      assert.ok(String(value).trim(), `${key} must not be empty`);
    }
  }
});

test("all published fixtures have English metadata and translatable prompts", () => {
  assert.equal(caseItems.length, 12);
  for (const item of caseItems) {
    const translation = getEnglishCaseTranslation(item.slug);
    assert.ok(translation?.title, `${item.slug} is missing an English title`);
    assert.ok(translation?.summary, `${item.slug} is missing an English summary`);

    if (
      item.slug !== "real-case-11-servasyy-ai" &&
      item.slug !== "real-case-12-viktoroddy"
    ) {
      assert.ok(
        translation?.promptTranslationZh || item.promptTranslationZh,
        `${item.slug} is missing a Chinese prompt translation`
      );
    }
  }
});
