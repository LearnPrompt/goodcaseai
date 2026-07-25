import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPromptUrls,
  extractWeeklyPromptUrls,
  normalizeYouMindPromptPage,
} from "../adapters/youmind.mjs";

const creativeWork = {
  "@type": "CreativeWork",
  url: "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697",
  name: "8 位像素仙子动画",
  description: "银发仙子在暮色森林中漫步的循环动画。",
  text: "8-bit pixel art fairy in a glowing forest",
  datePublished: "2026-07-22T05:21:54.000Z",
  author: {
    "@type": "Person",
    name: "paranoidream",
    url: "https://x.com/paranoidream",
  },
  about: {
    "@type": "SoftwareApplication",
    name: "Grok Imagine",
    applicationCategory: "VideoGenerationApplication",
  },
  isBasedOn: "https://x.com/paranoidream/status/2079799074325422343#reversed-0",
  isAccessibleForFree: true,
  image: "https://pbs.twimg.com/thumb.jpg",
  interactionStatistic: [
    {
      "@type": "InteractionCounter",
      interactionType: { "@type": "LikeAction" },
      userInteractionCount: 1081,
    },
    {
      "@type": "InteractionCounter",
      interactionType: { "@type": "ViewAction" },
      userInteractionCount: 285382,
    },
  ],
};

const video = {
  "@type": "VideoObject",
  thumbnailUrl: ["https://pbs.twimg.com/thumb.jpg"],
  contentUrl: "https://cms-assets.youmind.com/pixel-fairy.mp4",
};

test("extractWeeklyPromptUrls only returns unique detail pages from weekly highlights", () => {
  const html = `
    <div id="prompts-weekly-highlights">
      <a href="/zh-CN/prompts/example-101">Example</a>
      <a href="/zh-CN/prompts/example-101">Duplicate</a>
      <a href="/zh-CN/video-prompts/clip-202">Clip</a>
    </div>
    <div id="prompts-media"></div>
    <a href="/zh-CN/prompts/outside-303">Outside</a>
  `;

  assert.deepEqual(extractWeeklyPromptUrls(html), [
    "https://youmind.com/zh-CN/prompts/example-101",
    "https://youmind.com/zh-CN/video-prompts/clip-202",
  ]);
});

test("extractPromptUrls returns unique detail pages from a listing", () => {
  const html = `
    <a href="/zh-CN/prompts/example-101">Example</a>
    <a href="/zh-CN/prompts/example-101">Duplicate</a>
    <a href="/zh-CN/video-prompts/clip-202?ref=list">Clip</a>
    <a href="/zh-CN/prompts/image/product">Category</a>
  `;

  assert.deepEqual(
    extractPromptUrls(html, {
      indexUrl: "https://youmind.com/zh-CN/prompts/image/product",
    }),
    [
      "https://youmind.com/zh-CN/prompts/example-101",
      "https://youmind.com/zh-CN/video-prompts/clip-202",
    ]
  );
});

test("normalizeYouMindPromptPage extracts original source, prompt, media, and metrics", () => {
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({ "@context": "https://schema.org", "@graph": [creativeWork, video] })}
    </script>
  `;
  const item = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
  );

  assert.equal(
    item.sourceUrl,
    "https://x.com/paranoidream/status/2079799074325422343"
  );
  assert.equal(item.author, "paranoidream");
  assert.equal(item.promptIsPublic, true);
  assert.equal(item.mediaKind, "video");
  assert.equal(item.mediaUrl, "https://cms-assets.youmind.com/pixel-fairy.mp4");
  assert.equal(item.posterUrl, "https://pbs.twimg.com/thumb.jpg");
  assert.equal(item.sourceLikeCount, 1081);
  assert.equal(item.sourceViewCount, 285382);
  assert.deepEqual(item.tags, ["youmind", "Grok Imagine"]);
});

test("normalizeYouMindPromptPage rejects pages without an original source", () => {
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{ ...creativeWork, isBasedOn: "" }, video],
      })}
    </script>
  `;

  assert.equal(
    normalizeYouMindPromptPage(
      html,
      "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
    ),
    null
  );
});
