import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPromptUrls,
  extractWeeklyPromptUrls,
  inferSourceCategoryFromListingUrl,
  normalizeYouMindPromptPage,
  splitSourceReference,
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

test("inferSourceCategoryFromListingUrl reads the category from dedicated listing pages, and returns null for the mixed root index", () => {
  assert.equal(
    inferSourceCategoryFromListingUrl("https://youmind.com/zh-CN/prompts/video"),
    "video"
  );
  assert.equal(
    inferSourceCategoryFromListingUrl("https://youmind.com/zh-CN/prompts/webpage"),
    "web"
  );
  assert.equal(
    inferSourceCategoryFromListingUrl("https://youmind.com/zh-CN/prompts/image"),
    "image"
  );
  assert.equal(
    inferSourceCategoryFromListingUrl("https://youmind.com/zh-CN/prompts"),
    null
  );
});

test("normalizeYouMindPromptPage lets an explicit sourceCategory override the applicationCategory/mediaKind guess", () => {
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({ "@context": "https://schema.org", "@graph": [creativeWork, video] })}
    </script>
  `;

  // 不传 sourceCategory 时走兜底：这条素材有 VideoObject，兜底逻辑判成 video。
  const withoutSourceCategory = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
  );
  assert.equal(withoutSourceCategory.category, "video");

  // 传了 sourceCategory（比如抓取时已知这条来自 /prompts/webpage）就是唯一判据，
  // 优先级高于素材本身的 mediaKind 兜底猜测。
  const withSourceCategory = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697",
    { sourceCategory: "web" }
  );
  assert.equal(withSourceCategory.category, "web");
});

test("normalizeYouMindPromptPage falls back to about.applicationCategory only when sourceCategory is unknown, and now also accepts WebApplication", () => {
  const webWork = {
    ...creativeWork,
    about: {
      "@type": "SoftwareApplication",
      name: "Gemini 3 Pro",
      applicationCategory: "WebApplication",
    },
  };
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({ "@context": "https://schema.org", "@graph": [webWork] })}
    </script>
  `;

  const item = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/prompts/example-101"
  );
  assert.equal(item.category, "web");
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

test("normalizeYouMindPromptPage 保留 isBasedOn 的 #reversed-N 锚点，sourceUrl 仍然去 hash", () => {
  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({ "@context": "https://schema.org", "@graph": [creativeWork, video] })}
    </script>
  `;
  const item = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
  );

  // 这是根因：以前 stripSourceFragment() 在这一层就把锚点抹了，
  // 全库 source_url 含 #reversed 的数量因此是 0，唯一的自动溯源信号被自己销毁。
  assert.equal(item.provenanceAnchor, "reversed-0");
  assert.equal(item.promptReverseEngineered, true);
  assert.equal(
    item.sourceUrl,
    "https://x.com/paranoidream/status/2079799074325422343"
  );
});

test("normalizeYouMindPromptPage 对超长 prompt 一字不截", () => {
  // 钉死根因边界：2026-07-28 批次那堵「2950 字墙」不是我们截的，
  // 是 youmind 在原推第 3000 个字符上下的刀（见 lib/prompt-truncation.mjs）。
  // 这一层只要有任何 slice/substring 冒出来，这条就会红。
  const hugePrompt = "1234567890".repeat(2_000);
  assert.equal(hugePrompt.length, 20_000);

  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{ ...creativeWork, text: hugePrompt }, video],
      })}
    </script>
  `;
  const item = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
  );

  assert.equal(item.promptText.length, 20_000);
  assert.equal(item.promptText, hugePrompt);
  // 超过截断带就不再是嫌疑，别把正常的长 prompt 标脏。
  assert.equal(item.promptTruncation.suspected, false);
});

test("normalizeYouMindPromptPage 把 youmind 侧的截断嫌疑标出来，但照样原样带出正文", () => {
  const cappedTail = "Black ice cubes and red bottle cap float a";
  const cappedPrompt =
    "cinematic handheld shot of a city street, "
      .repeat(100)
      .slice(0, 2_928 - cappedTail.length) + cappedTail;
  assert.equal(cappedPrompt.length, 2_928);

  const html = `
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{ ...creativeWork, text: cappedPrompt }, video],
      })}
    </script>
  `;
  const item = normalizeYouMindPromptPage(
    html,
    "https://youmind.com/zh-CN/video-prompts/pixel-fairy-7697"
  );

  assert.equal(item.promptTruncation.suspected, true);
  assert.equal(item.promptTruncation.length, 2_928);
  // 标记归标记，正文一个字都不许动——补全要靠这段残文去原帖里对齐。
  assert.equal(item.promptText, cappedPrompt);
});

test("splitSourceReference 对不带锚点的出处返回空锚点", () => {
  assert.deepEqual(
    splitSourceReference("https://x.com/foo/status/123"),
    {
      sourceUrl: "https://x.com/foo/status/123",
      provenanceAnchor: "",
      promptReverseEngineered: false,
    }
  );
  assert.deepEqual(splitSourceReference(""), {
    sourceUrl: "",
    provenanceAnchor: "",
    promptReverseEngineered: false,
  });
});

test("splitSourceReference 只把 reversed 系列当逆向标记，普通锚点不算", () => {
  const plain = splitSourceReference("https://x.com/foo/status/123#section-2");
  assert.equal(plain.provenanceAnchor, "section-2");
  assert.equal(plain.promptReverseEngineered, false);
  assert.equal(plain.sourceUrl, "https://x.com/foo/status/123");
});
