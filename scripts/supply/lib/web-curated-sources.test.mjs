import assert from "node:assert/strict";
import test from "node:test";
import {
  extractUiPromptLinks,
  parseUiPromptDetail,
  parseV0ShareDetail,
} from "./web-curated-sources.mjs";

test("UI Prompt Library listing keeps full web categories only", () => {
  const html = [
    '<a href="/prompts/landing-pages-landing-pages-prompts-for-ai-startup-20260706-free/">Landing</a>',
    '<a href="/prompts/app-dashboards-app-dashboards-prompts-for-fintech-20260704-free/">Dashboard</a>',
    '<a href="/prompts/mobile-app-screens-native-app-checkout-20260706-free/">Mobile</a>',
    '<a href="/prompts/animated-backgrounds-animated-mesh-background-20260630-free/">Background</a>',
  ].join("");
  assert.deepEqual(extractUiPromptLinks(html), [
    "https://uipromptlibrary.com/prompts/landing-pages-landing-pages-prompts-for-ai-startup-20260706-free/",
    "https://uipromptlibrary.com/prompts/app-dashboards-app-dashboards-prompts-for-fintech-20260704-free/",
  ]);
});

test("UI Prompt Library detail requires a full prompt and result image", () => {
  const prompt = "Build a responsive website with hero, pricing, and FAQ. ".repeat(5);
  const html = [
    '<meta property="og:image" content="https://example.com/result.png"/>',
    '<h1 class="prompt-detail-title">Measured launch page</h1>',
    '<img src="/previews/measured-launch/hero-16x10.png"/>',
    `<pre class="copy-block">${prompt}</pre>`,
    "<span>GPT-5</span>",
  ].join("");
  const item = parseUiPromptDetail(
    html,
    "https://uipromptlibrary.com/prompts/measured-launch-free/"
  );
  assert.equal(item.title, "Measured launch page");
  assert.equal(item.promptText, prompt.trim());
  assert.equal(
    item.mediaUrl,
    "https://uipromptlibrary.com/previews/measured-launch/hero-16x10.png"
  );
  assert.equal(item.checks.prompt, true);
});

test("v0 share detail reads the public prompt, author, and generated image", () => {
  const prompt =
    "Design a responsive portfolio website with hero, projects, about, contact, typography, dark colors, mobile navigation, and hover interactions. ".repeat(
      2
    );
  const escapedPrompt = JSON.stringify(JSON.stringify(prompt).slice(1, -1)).slice(
    1,
    -1
  );
  const html = [
    '<meta property="og:image" content="https://v0.app/result.png"/>',
    `<script>self.__next_f.push([1,"{\\"prompt\\":\\"${escapedPrompt}\\"}"])</script>`,
    '<a href="/alice"><span class="sr-only">Link to <!-- -->alice<!-- -->&#x27;s v0.app Profile</span></a>',
  ].join("");
  const item = parseV0ShareDetail(html, "https://v0.app/t/example");
  assert.equal(item.creator, "alice");
  assert.equal(item.promptText, prompt.trim());
  assert.equal(item.mediaUrl, "https://v0.app/result.png");
});

test("v0 share detail rejects a prompt truncated by the public-page cap", () => {
  const prompt = `${"Build a responsive dashboard with tables and filters. ".repeat(30)}`.slice(
    0,
    1000
  );
  const escapedPrompt = JSON.stringify(JSON.stringify(prompt).slice(1, -1)).slice(
    1,
    -1
  );
  const html = [
    '<meta property="og:image" content="https://v0.app/result.png"/>',
    `<script>self.__next_f.push([1,"{\\"prompt\\":\\"${escapedPrompt}\\"}"])</script>`,
    '<a href="/alice"><span class="sr-only">Link to <!-- -->alice<!-- -->&#x27;s v0.app Profile</span></a>',
  ].join("");
  assert.equal(parseV0ShareDetail(html, "https://v0.app/t/truncated"), null);
});
