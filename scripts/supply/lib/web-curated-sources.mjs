const WEB_CATEGORIES = [
  "landing-pages",
  "app-dashboards",
  "ecommerce-and-marketplaces",
  "portfolios-and-agencies",
  "full-website-concepts",
  "saas-and-ai-startups",
];

export const UI_PROMPT_LIST_URLS = WEB_CATEGORIES.map(
  (category) => `https://uipromptlibrary.com/categories/${category}/`
);

export const V0_SHARE_URLS = [
  "https://v0.app/t/SxxcT4tILa8",
  "https://v0.app/t/EzHnFQkVEVE",
  "https://v0.app/t/xIKtdRTGTKl",
  "https://v0.app/t/akRkkjfUl4Q",
  "https://v0.app/t/T0IINYToI5E",
  "https://v0.app/t/cOp5yKZpx8T",
  "https://v0.app/t/X3KljaxpscR",
  "https://v0.app/t/oPLBKTuG91N",
  "https://v0.app/t/WFRDbwAzwlj",
  "https://v0.app/t/RjnbcVlKZcu",
  "https://v0.app/t/1mqRG2ruFwm",
  "https://v0.app/t/d1gqK6maKXY",
  "https://v0.app/t/0HWWiOJl5WY",
  "https://v0.app/t/nUjSbyC98QV",
  "https://v0.app/t/Pv0uWUttIZj",
  "https://v0.app/t/oPPN0wEKOs6",
  "https://v0.app/t/0WV1Z40YeVG",
  "https://v0.app/t/NEoZMS2lzdr",
  "https://v0.app/t/TaTsUIRRSG6",
  "https://v0.app/t/GXoSLBPsSPg",
  "https://v0.app/t/cydRZqgVrLb",
  "https://v0.app/t/k6jteOUYBYM",
  "https://v0.app/t/jVbumEVnAYE",
  "https://v0.app/t/j9CYFyzw0i6",
  "https://v0.app/t/HG0gjTWsTaV",
  "https://v0.app/t/LVXanQ3bcCd",
  "https://v0.app/t/AjybWsOkff9",
  "https://v0.app/t/OxiOhJYgyWW",
  "https://v0.app/t/mczhNJZcgas",
  "https://v0.app/t/55dCxfJ5xmR",
];

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function textContent(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<!--.*?-->/gs, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|pre|section|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${value}["'][^>]*>`,
    "i"
  );
  return decodeHtml(html.match(pattern)?.[1] || html.match(reversePattern)?.[1] || "");
}

function compactTitle(prompt, fallback) {
  const firstLine = prompt
    .split(/\n+/)
    .map((value) => value.replace(/^["“'_*\s]+|["”'_*\s]+$/g, "").trim())
    .find(Boolean);
  const sentence = (firstLine || fallback).split(/(?<=[.!?。！？])\s+/)[0];
  return sentence.replace(/\s+/g, " ").slice(0, 88);
}

function extractEscapedFlightField(html, field) {
  const marker = `\\"${field}\\":\\"`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const contentStart = start + marker.length;
  let contentEnd = -1;
  for (let index = contentStart; index < html.length; index += 1) {
    if (html[index] !== '"') continue;
    let slashCount = 0;
    for (
      let cursor = index - 1;
      cursor >= 0 && html[cursor] === "\\";
      cursor -= 1
    ) {
      slashCount += 1;
    }
    if (slashCount === 1) {
      contentEnd = index - 1;
      break;
    }
  }
  if (contentEnd < contentStart) return "";
  try {
    const once = JSON.parse(`"${html.slice(contentStart, contentEnd)}"`);
    return JSON.parse(`"${once}"`).trim();
  } catch {
    return "";
  }
}

function hasBalancedDelimiters(value) {
  const pairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];
  return pairs.every(
    ([opening, closing]) =>
      value.split(opening).length === value.split(closing).length
  );
}

function isCompleteV0Prompt(value) {
  const prompt = value.trim();
  if (prompt.length < 70 || prompt.length >= 990) return false;
  if (!hasBalancedDelimiters(prompt)) return false;
  if (
    /\b(?:and|or|with|for|of|to|the|a|an|etc|inf|schem|sta|dev|optimize)\s*$/i.test(
      prompt
    )
  ) {
    return false;
  }
  return (
    /\b(?:build|create|design|develop|implement|generate|make)\b/i.test(prompt) &&
    /\b(?:website|landing page|dashboard|web app|user interface|portfolio|homepage|page)\b/i.test(
      prompt
    )
  );
}

function baseItem({
  id,
  sourceId,
  sourceLabel,
  sourceUrl,
  title,
  creator,
  creatorUrl,
  mediaUrl,
  promptText,
  method,
  model,
  notes,
}) {
  return {
    id,
    sourceId,
    sourceLabel,
    sourceUrl,
    title,
    creator,
    creatorUrl,
    mediaUrl,
    posterUrl: "",
    mediaKind: "image",
    promptText,
    promptSourceUrl: sourceUrl,
    method,
    model,
    license: "原页可公开访问；转载与二次展示许可仍需复核",
    notes,
    metrics: {},
    checks: {
      source: true,
      author: true,
      result: true,
      method: true,
      prompt: true,
      license: false,
    },
    completeness: 1,
    candidateType: "case",
  };
}

export function extractUiPromptLinks(html, baseUrl = "https://uipromptlibrary.com") {
  const links = [
    ...String(html || "").matchAll(/href=["'](\/prompts\/[^"']+-free\/)["']/gi),
  ].map((match) => new URL(match[1], baseUrl).toString());
  return [
    ...new Set(
      links.filter((url) =>
        WEB_CATEGORIES.some((category) => url.includes(`/prompts/${category}-`))
      )
    ),
  ];
}

export function parseUiPromptDetail(html, sourceUrl) {
  const title = textContent(
    html.match(/<h1[^>]*class=["'][^"']*prompt-detail-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  );
  const promptText = textContent(
    html.match(/<pre[^>]*class=["'][^"']*copy-block[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i)?.[1]
  );
  const previewPath = html.match(
    /src=["']([^"']+\/hero-16x10\.png)["']/i
  )?.[1];
  const mediaUrl = previewPath
    ? new URL(previewPath, sourceUrl).toString()
    : metaContent(html, "property", "og:image");
  if (!title || promptText.length < 160 || !mediaUrl) return null;
  const id = new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1);
  return baseItem({
    id: `ui-prompt-${id}`,
    sourceId: "ui-prompt-library",
    sourceLabel: "UI Prompt Library",
    sourceUrl,
    title,
    creator: "UI Prompt Library",
    creatorUrl: "https://uipromptlibrary.com/",
    mediaUrl,
    promptText,
    method: "公开详情页同时提供完整可复制 Prompt、桌面结果预览与交互预览。",
    model: /\bGPT-5\b/i.test(html) ? "GPT-5" : "AI Web Builder",
    notes: "免费 Prompt 详情页；Prompt 与结果预览同页；GoodCase 尚未复跑。",
  });
}

export function parseV0ShareDetail(html, sourceUrl) {
  const promptText = extractEscapedFlightField(html, "prompt");
  const mediaUrl = metaContent(html, "property", "og:image");
  const author = textContent(
    html.match(
      /href=["']\/([^"'/?#]+)["'][^>]*><span[^>]+class=["'][^"']*sr-only[^"']*["'][^>]*>Link to[\s\S]*?<\/span>/i
    )?.[1]
  );
  if (!isCompleteV0Prompt(promptText) || !mediaUrl || !author) return null;
  const id = new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1);
  return baseItem({
    id: `v0-${id}`,
    sourceId: "v0-community",
    sourceLabel: "v0 · 社区生成",
    sourceUrl,
    title: compactTitle(promptText, `v0 网页生成 · ${id}`),
    creator: author,
    creatorUrl: `https://v0.app/${author}`,
    mediaUrl,
    promptText,
    method: "v0 公共分享页直接展示原始 Prompt 与对应生成界面。",
    model: "v0",
    notes: "v0 公共分享页；Prompt 与生成结果同页；GoodCase 尚未复跑。",
  });
}
