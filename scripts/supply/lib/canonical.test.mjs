import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalKey, canonicalizeUrl } from "./canonical.mjs";

test("canonicalizeUrl removes tracking params and sorts meaningful params", () => {
  assert.equal(
    canonicalizeUrl("https://Example.com/case/?utm_source=x&b=2&a=1#result"),
    "https://example.com/case?a=1&b=2"
  );
});

test("canonicalizeUrl normalizes X status links to one stable URL", () => {
  const expected = "https://x.com/i/status/2080021408856293584";

  assert.equal(
    canonicalizeUrl(
      "https://twitter.com/sundarpichai/status/2080021408856293584?s=20"
    ),
    expected
  );
  assert.equal(
    canonicalizeUrl(
      "https://x.com/sundarpichai/status/2080021408856293584/photo/1"
    ),
    expected
  );
});

test("buildCanonicalKey is stable for equivalent URLs", () => {
  assert.equal(
    buildCanonicalKey("https://example.com/case?utm_medium=social"),
    buildCanonicalKey("https://EXAMPLE.com/case")
  );
});

test("canonicalizeUrl preserves ordinary business parameters", () => {
  assert.equal(
    canonicalizeUrl("https://example.com/search?s=robot&ref=homepage"),
    "https://example.com/search?ref=homepage&s=robot"
  );
});

test("canonicalizeUrl rejects invalid and unsupported URLs", () => {
  assert.equal(canonicalizeUrl("not a url"), null);
  assert.equal(canonicalizeUrl("file:///tmp/case.json"), null);
});
