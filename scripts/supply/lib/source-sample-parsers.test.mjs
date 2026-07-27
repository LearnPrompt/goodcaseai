import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySample,
  decodeHtml,
  extractBalancedJsonValue,
  extractComfyWorkflowCards,
  extractIdeogramGalleryItems,
  extractJsonScript,
  extractMeta,
  extractNextFlightText,
  hasBlockedTerms,
  stripHtml,
} from "./source-sample-parsers.mjs";

test("HTML helpers extract metadata and readable text", () => {
  const html = `
    <meta property="og:image" content="https://cdn.example.com/a.jpg">
    <meta name="description" content="A &amp; B">
    <p>Hello <strong>world</strong></p>`;
  assert.equal(
    extractMeta(html, "og:image", { property: true }),
    "https://cdn.example.com/a.jpg"
  );
  assert.equal(extractMeta(html, "description"), "A & B");
  assert.equal(stripHtml(html), "Hello world");
  assert.equal(decodeHtml("A &quot;quote&quot;"), 'A "quote"');
});

test("JSON helpers handle script payloads and nested arrays", () => {
  const html =
    '<script id="__NEXT_DATA__" type="application/json">{"ok":true}</script>';
  assert.deepEqual(extractJsonScript(html, "__NEXT_DATA__"), { ok: true });

  const text = 'prefix [{"a":[1,{"b":"x]y"}]}] suffix';
  const start = text.indexOf("[");
  assert.equal(
    extractBalancedJsonValue(text, start),
    '[{"a":[1,{"b":"x]y"}]}]'
  );
});

test("Next flight chunks are decoded and joined", () => {
  const html = [
    '<script>self.__next_f.push([1,"hello "])</script>',
    '<script>self.__next_f.push([1,"world"])</script>',
  ].join("");
  assert.equal(extractNextFlightText(html), "hello world");
});

test("Ideogram gallery parser keeps prompt, detail URL, and media", () => {
  const html = `
    <div class="blog-gallery-item wide"
      data-prompt="A &amp; B"
      data-link="https://ideogram.ai/g/abc/0"
      data-fullsize="https://cdn.example.com/result.png">`;
  assert.deepEqual(extractIdeogramGalleryItems(html), [
    {
      prompt: "A & B",
      sourceUrl: "https://ideogram.ai/g/abc/0",
      mediaUrl: "https://cdn.example.com/result.png",
    },
  ]);
});

test("Comfy workflow parser extracts embedded community cards once", () => {
  const html = [
    '<astro-island props="{&quot;items&quot;:[1,[[0,{',
    '&quot;name&quot;:[0,&quot;abc123&quot;],',
    '&quot;shareId&quot;:[0,&quot;abc123&quot;],',
    '&quot;title&quot;:[0,&quot;Product Poster&quot;],',
    '&quot;description&quot;:[0,&quot;A reproducible workflow description long enough to explain the method.&quot;],',
    '&quot;mediaType&quot;:[0,&quot;image&quot;],',
    '&quot;models&quot;:[1,[[0,&quot;Flux&quot;]]],',
    '&quot;thumbnails&quot;:[1,[[0,&quot;https://cdn.example.com/result.png&quot;]]],',
    '&quot;username&quot;:[0,&quot;alice&quot;],',
    '&quot;creatorDisplayName&quot;:[0,&quot;Alice&quot;]',
    "}]]]}",
    '"></astro-island>',
  ].join("");

  assert.deepEqual(extractComfyWorkflowCards(html), [
    {
      name: "abc123",
      shareId: "abc123",
      title: "Product Poster",
      description:
        "A reproducible workflow description long enough to explain the method.",
      mediaType: "image",
      mediaUrl: "https://cdn.example.com/result.png",
      username: "alice",
      creator: "Alice",
      model: "Flux",
    },
  ]);
});

test("sample classification separates complete cases from discovery seeds", () => {
  const complete = classifySample({
    sourceUrl: "https://example.com/case",
    creator: "Alice",
    mediaUrl: "https://example.com/result.jpg",
    promptText: "A reproducible product poster prompt",
    license: "允许公开展示",
  });
  assert.equal(complete.candidateType, "case");
  assert.equal(complete.completeness, 1);
  assert.equal(complete.checks.license, true);

  const seed = classifySample({
    sourceUrl: "https://example.com/case",
    creator: "未知作者",
    mediaUrl: "https://example.com/result.jpg",
    promptText: "",
    method: "",
    license: "未知",
  });
  assert.equal(seed.candidateType, "topic_seed");
  assert.equal(seed.completeness, 0.5);
  assert.equal(hasBlockedTerms("NSFW portrait"), true);
  assert.equal(hasBlockedTerms("Mario and Luigi poster"), true);
  assert.equal(hasBlockedTerms("product poster"), false);
});
