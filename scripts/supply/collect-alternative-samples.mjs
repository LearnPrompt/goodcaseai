#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
} from "./lib/source-sample-parsers.mjs";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const USER_AGENT = "GoodCaseSupplyShadow/1.0 (+https://goodcase.ai)";

const RUNNINGHUB_SEEDS = [
  {
    url: "https://www.runninghub.ai/post/1929204278349479937",
    author: "道友请留步",
  },
  {
    url: "https://www.runninghub.ai/post/1863434480945135618",
    author: "Sun",
  },
  {
    url: "https://www.runninghub.ai/post/1845725471282753538",
    author: "Isabella",
  },
  {
    url: "https://www.runninghub.ai/post/1991530280437628929",
    author: "Little Wrangler",
  },
  {
    url: "https://www.runninghub.ai/post/2027204046305628162",
    author: "Little Wrangler",
  },
];

const LIBLIB_SEEDS = [
  "https://www.liblib.art/modelinfo/a104e1357d354686a53df93d0b6aabc9?from=search",
  "https://www.liblib.art/modelinfo/e934f3a693c14268a758905a7d20ceb4?from=feed",
  "https://www.liblib.art/modelinfo/6b7e46cb84234be5b614d014f6d1a0ed?from=feed",
  "https://www.liblib.art/modelinfo/f2410b240ac14a27ad8ff581e1833654?from=feed",
  "https://www.liblib.art/modelinfo/28b27d33a478466d9c2dc7abc17baa13?from=feed",
];

const LIBLIB_MEDIA_BY_ID = {
  a104e1357d354686a53df93d0b6aabc9:
    "https://liblibai-online.liblib.cloud/img/46987de339ac47e0965172f7ccd1b939/a9159b078a820a2928f1deb1a48c5330ed1d2e5e8c9f22ad6d1a000cc292eb86.png?x-oss-process=image/resize,w_1000,m_lfit/format,webp",
  e934f3a693c14268a758905a7d20ceb4:
    "https://liblibai-online.liblib.cloud/img/24e05fc45d19404bb88dcc76a0af73cd/f1336fc84a229f1fd1a66ed0b2b0b0ad7b3e1cf1cfb66ff8bcab1c095b8e499a.png?x-oss-process=image/resize,w_1000,m_lfit/format,webp",
  "6b7e46cb84234be5b614d014f6d1a0ed":
    "https://liblibai-online.liblib.cloud/img/8ca94a5320a54240be77717cd84a73dc/e0f12251ed1bee3ae648a192b628560895465ab8ac61258c50d15a328577cd1e.gif?x-oss-process=image/resize,w_1000,m_lfit",
  f2410b240ac14a27ad8ff581e1833654:
    "https://liblibai-online.liblib.cloud/img/8ca94a5320a54240be77717cd84a73dc/98c73e5977beac56c8bd03091259cff6cccb40b2c2e3e1350e550e080e82895a.gif?x-oss-process=image/resize,w_1000,m_lfit",
  "28b27d33a478466d9c2dc7abc17baa13":
    "https://liblibai-online.liblib.cloud/img/0f3b65f94bf348f5a9b791d07ed82184/df383da82523cab30cc22f525b133fd2caff836ef61a52fe56be218e1b3170dc.gif?x-oss-process=image/resize,w_1000,m_lfit",
};

const PROMPTHERO_SEEDS = [
  "https://prompthero.com/prompt/18dffab107a-flux-flux-11-pro-product-mockup-of-organic-betalain-packaging-in-hands-being-held-and-picture-of-celosia-argentea-at-center-of-packaging-modern",
  "https://prompthero.com/prompt/240dad3ab67-flux-flux-kontext-pro-photography-productive-view-cylindrical-podium-with-mgm-at-sport-tire",
  "https://prompthero.com/prompt/33adbdab409-flux-pro-11-product-photograph-of-drink-soda-refress-with-the-logo-of-prompthero",
  "https://prompthero.com/prompt/7b6ea9e8895-flux-flux-11-pro-mobile-pendant-promotional-poster",
];

const GLIF_SEEDS = [
  {
    id: "mwgTXxfm",
    slug: "create-a-logo",
    title: "Create a logo",
    description:
      "根据品牌与受众设计主标志，并额外生成适合社交头像小尺寸使用的版本。",
    prompt:
      "Design a logo for my brand that appeals to my audience. Create an additional version that will work well at small sizes for social media icons.",
    mediaUrl:
      "https://res.cloudinary.com/dzkwltgyd/image/upload/v1776690806/glif-run-outputs/fwisfgrd1agj4dwvmzkd.png",
    model: "Glif creative agent",
  },
  {
    id: "Xo7vf3jG",
    slug: "product-placements",
    title: "Product Placements",
    description:
      "上传产品照片，再指定场景与光线，生成新的写实产品植入图。",
    prompt:
      "I will upload a photo of my product. Please create a photorealistic image showing it being used in a specific setting with select lighting to highlight its features and appeal.",
    mediaUrl:
      "https://res.cloudinary.com/dzkwltgyd/image/upload/v1778503840/glif-run-outputs/cgjhzuiu7rxtztiyybk0.jpg",
    model: "Glif creative agent",
  },
  {
    id: "rU9XiOY2",
    slug: "1980s-school-textbook-infographic",
    title: "1980s School Textbook Infographic",
    description:
      "把任意主题转成 1980 年代科学教科书式信息图，强调图解、标签、时间线和有限色板。",
    prompt:
      "Create a detailed 1980s school textbook style infographic about: [TOPIC]. Use aged off-white paper, cobalt blue, brick red, goldenrod yellow and forest green, zero gradients, halftone shading, hand-drafted technical diagrams, serif section headers, a hero diagram, anatomy breakdown, process strip, and key facts footer.",
    mediaUrl:
      "https://res.cloudinary.com/dzkwltgyd/image/upload/v1775142321/glif-run-outputs/h0fdjo69fmaiqprbqetg.jpg",
    model: "Glif creative agent",
  },
  {
    id: "Bdu6l3Dy",
    slug: "pixel-art-sprite-sheet-generator",
    title: "Pixel Art Sprite Sheet Generator",
    description:
      "为游戏角色生成包含待机、奔跑和攻击动作的像素动画 Sprite Sheet。",
    prompt: "Generate a pixel art sprite sheet for a game character.",
    mediaUrl:
      "https://res.cloudinary.com/dzkwltgyd/image/upload/v1778504723/glif-run-outputs/qtrjctdff5datf2eugc3.gif",
    model: "Glif creative agent",
  },
  {
    id: "d4d38812-eee7-4c4c-8d50-d6cfff9f2a0b",
    slug: "virtually-stage-real-estate-photos",
    title: "Virtually stage real estate photos",
    description:
      "上传空房照片，指定家具、风格和光线，为房产展示生成虚拟软装效果。",
    prompt:
      "Virtually stage this empty room with modern furniture and warm lighting for a real estate listing.",
    mediaUrl:
      "https://res.cloudinary.com/dzkwltgyd/image/upload/v1767733492/glif-run-outputs/e11hymflyauyrubjuuvt.png",
    model: "Glif creative agent",
  },
];

const LEXICA_SEARCHES = [
  { query: "product poster", limit: 2 },
  { query: "packaging design", limit: 2 },
  { query: "interior design", limit: 1 },
];

const RUNCOMFY_SEEDS = [
  "consistent-character-creator-4-0-comfyui-flux-2-dataset",
  "krea-2-muse-text-to-image-comfyui-workflow-turbo-fp8-portrait-concept-art",
  "ideogram-4-comfyui-workflow-structured-text-to-image-generator",
];

const YOUML_SEEDS = [
  {
    id: "5817-ai-sticker-maker",
    creator: "tom",
    method: "Generate cute stickers with a transparent background.",
    prompt: "a cute cat",
  },
  {
    id: "12009-poster-copy",
    creator: "leon34",
    method: "",
    prompt: "",
  },
];

const PROMPTDEN_SEEDS = [
  "elegant-kintsugi-bowl-artistry-in-repair",
  "premium-baby-food-broccoli-zucchini-delight",
  "whimsical-black-cat-starry-night-artwork",
];

const DISCOVERY_ONLY_SOURCES = [
  {
    id: "motionsites",
    label: "MotionSites",
    note: "有可复制 Prompt，但缺少清晰作者与稳定案例详情，只作网页动效选题源。",
  },
  {
    id: "superdesign",
    label: "Superdesign",
    note: "适合 UI、动画和落地页 Prompt 富化，不作为创作者 Case 主源。",
  },
  {
    id: "ui-prompt-explorer",
    label: "UI Prompt Explorer",
    note: "适合风格标签与检索词富化，缺少创作者证据。",
  },
  {
    id: "ai-design-guide",
    label: "AI Design Guide",
    note: "单一作者知识库，适合 LearnPrompt 外链与方法富化。",
  },
  {
    id: "prompting-pixels",
    label: "Prompting Pixels",
    note: "有可下载工作流，但多数归属站点编辑部，先作工作流线索。",
  },
];

function getArg(name, fallback = "") {
  const prefix = `${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function fetchText(url, timeoutMs = 30_000) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      return response.text();
    }
    if (
      attempt === 3 ||
      (response.status !== 429 && response.status < 500)
    ) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw new Error(`无法获取: ${url}`);
}

function firstString(...values) {
  return (
    values.find((value) => typeof value === "string" && value.trim())?.trim() ||
    ""
  );
}

function titleFromText(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 88 ? `${normalized.slice(0, 85)}…` : normalized;
}

function firstRemoteMedia(html, hostPattern, excludedUrls = []) {
  const exclusions = new Set(
    excludedUrls.filter(Boolean).map((url) => decodeHtml(url).split("?")[0])
  );
  const matches = html.matchAll(
    new RegExp(
      `https://${hostPattern}/[^"'<>\\\\s]+?\\.(?:png|jpe?g|webp|gif|mp4)(?:\\?[^"'<>\\\\s]*)?`,
      "gi"
    )
  );
  for (const match of matches) {
    const url = decodeHtml(match[0]);
    if (
      !url.includes("avatar") &&
      !url.includes("logo") &&
      !exclusions.has(url.split("?")[0])
    ) {
      return url;
    }
  }
  return "";
}

function extractSection(text, startLabels, endLabels, fallback = "") {
  const lower = text.toLowerCase();
  const starts = startLabels
    .map((label) => lower.indexOf(label.toLowerCase()))
    .filter((index) => index >= 0);
  if (starts.length === 0) {
    return fallback;
  }
  const start = Math.min(...starts);
  const ends = endLabels
    .map((label) => lower.indexOf(label.toLowerCase(), start + 1))
    .filter((index) => index > start);
  const end = ends.length > 0 ? Math.min(...ends) : Math.min(text.length, start + 4_000);
  return text.slice(start, end).trim();
}

function parseJsonLd(html, expectedType) {
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const payload = JSON.parse(match[1]);
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const node = nodes.find((item) => {
        const types = Array.isArray(item?.["@type"])
          ? item["@type"]
          : [item?.["@type"]];
        return types.includes(expectedType);
      });
      if (node) {
        return node;
      }
    } catch {
      // Ignore unrelated structured data.
    }
  }
  return null;
}

function extractJsonString(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`"${escapedKey}":"((?:\\\\.|[^"\\\\])*)"`)
  );
  if (!match) {
    return "";
  }
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function licenseFromText(text) {
  const normalized = text.toLowerCase();
  if (
    normalized.includes("non-commercial") ||
    normalized.includes("non commercial") ||
    text.includes("非商用") ||
    text.includes("禁止商用")
  ) {
    return "仅限非商用";
  }
  if (
    text.includes("会员可商用") ||
    text.includes("允许商用") ||
    normalized.includes("commercial use allowed")
  ) {
    return "原页声明可商用；仍需核对模型与素材许可";
  }
  return "原页未明确，待人工复核";
}

async function collectRunningHub() {
  const rows = await Promise.all(
    RUNNINGHUB_SEEDS.map(async (seed) => {
      const html = await fetchText(seed.url);
      const body = stripHtml(html);
      const description = firstString(
        extractMeta(html, "description"),
        extractMeta(html, "og:description", { property: true })
      );
      const method = extractSection(
        body,
        ["Workflow Introduction", "Workflow introduction", "How to Use"],
        ["Nodes Information", "Comments"],
        description
      );
      const title = firstString(
        extractMeta(html, "og:title", { property: true }).replace(
          /\s*-\s*RunningHub.*$/i,
          ""
        ),
        description
      );
      const mediaUrl = firstRemoteMedia(
        html,
        "(?:rh-hk-images|rh-images)\\.xiaoyaoyou\\.com"
      );

      return classifySample({
        id: `runninghub-${seed.url.split("/").pop()}`,
        sourceId: "runninghub",
        sourceLabel: "RunningHub",
        sourceUrl: seed.url,
        title,
        creator: body.includes(seed.author) ? seed.author : seed.author,
        creatorUrl: "",
        mediaUrl,
        mediaKind: mediaUrl.includes(".mp4") ? "video" : "image",
        promptText: "",
        method: method.slice(0, 4_000),
        model: body.match(/Model(?: name)?:\s*([^\n]+)/i)?.[1]?.trim() || "ComfyUI",
        license: licenseFromText(body),
        notes: "工作流详情页；尚未由 GoodCase 实际复跑。",
      });
    })
  );

  return rows;
}

async function collectLiblib() {
  const rows = await Promise.all(
    LIBLIB_SEEDS.map(async (url) => {
      const html = await fetchText(url);
      const payload = extractJsonScript(html, "__NEXT_DATA__");
      const pageProps = payload?.props?.pageProps || {};
      const modelInfo = pageProps.modelInfo || {};
      const author = pageProps.data1?.userDetail || {};
      const description = stripHtml(modelInfo.versionDesc || "");
      const pageText = stripHtml(html);
      const canonicalUrl = url.split("?")[0];
      const sourceId = canonicalUrl.split("/").pop();
      const mediaUrl = LIBLIB_MEDIA_BY_ID[sourceId] || "";

      return classifySample({
        id: `liblib-${sourceId}`,
        sourceId: "liblib",
        sourceLabel: "LiblibAI",
        sourceUrl: canonicalUrl,
        title: firstString(modelInfo.name, extractMeta(html, "og:title", { property: true })),
        creator: firstString(author.nickname, "未知作者"),
        creatorUrl: author.uuid
          ? `https://www.liblib.art/userpage/${author.uuid}/publish/workflow`
          : "",
        mediaUrl,
        mediaKind: modelInfo.isVideoModel ? "video" : "image",
        promptText: "",
        method: description.slice(0, 4_000),
        model: modelInfo.modelType === 18 ? "ComfyUI 工作流" : "模型/应用",
        license: licenseFromText(pageText),
        notes:
          modelInfo.modelType === 18
            ? "工作流页面；商用需同时核对底模、LoRA、节点和输入素材。"
            : "可能是模型展示页，审核时应优先降级为线索。",
      });
    })
  );

  return rows;
}

async function collectPromptHero() {
  const rows = [];
  for (const url of PROMPTHERO_SEEDS) {
    const html = await fetchText(url);
    const work = parseJsonLd(html, "CreativeWork") || {};
    const flightText = extractNextFlightText(html);
    const promptText = extractJsonString(flightText, "promptText");
    const title = firstString(
      work.name,
      extractMeta(html, "og:title", { property: true }),
      promptText
    );
    if (hasBlockedTerms(`${title}\n${promptText}`)) {
      continue;
    }
    const mediaUrl = firstString(
      extractMeta(html, "og:image", { property: true }),
      typeof work.image === "string" ? work.image : work.image?.url
    );
    rows.push(
      classifySample({
        id: `prompthero-${url.split("/prompt/")[1].split("-")[0]}`,
        sourceId: "prompthero",
        sourceLabel: "PromptHero",
        sourceUrl: url,
        title: titleFromText(title, "PromptHero prompt"),
        creator: firstString(work.author?.name, extractMeta(html, "article:author")),
        creatorUrl: work.author?.["@id"]
          ? `https://prompthero.com/user/${work.author["@id"]}`
          : "",
        mediaUrl,
        mediaKind: "image",
        promptText,
        method: "",
        model: extractJsonString(flightText, "modelVersion") || "FLUX",
        license: "原页未明确，待人工复核",
        notes: "作者、作品和 Prompt 可回溯；缺少明确转载与商用许可。",
      })
    );
  }
  return rows;
}

async function collectCivitai() {
  const apiUrl =
    "https://civitai.com/api/v1/images?limit=40&nsfw=None&sort=Most%20Reactions&period=Week";
  const payload = JSON.parse(await fetchText(apiUrl));
  const rows = [];
  for (const item of payload.items || []) {
    if (rows.length >= 5) {
      break;
    }
    const promptText = firstString(item.meta?.prompt);
    const title = titleFromText(promptText, `Civitai 图片 #${item.id}`);
    if (hasBlockedTerms(`${title}\n${promptText}`)) {
      continue;
    }
    rows.push(
      classifySample({
        id: `civitai-${item.id}`,
        sourceId: "civitai",
        sourceLabel: "Civitai",
        sourceUrl: `https://civitai.com/images/${item.id}`,
        title,
        creator: firstString(item.username, "未知作者"),
        creatorUrl: item.username
          ? `https://civitai.com/user/${encodeURIComponent(item.username)}`
          : "",
        mediaUrl: firstString(item.url),
        mediaKind: "image",
        promptText,
        method: "",
        model: firstString(item.meta?.Model, item.meta?.model),
        license: "原页未明确，待人工复核",
        notes: promptText
          ? "API 本次返回了 Prompt，仍需核对模型和许可。"
          : "API 有作者与作品，但本次 meta 为空，只能作为线索。",
        metrics: {
          likes: item.stats?.likeCount ?? null,
          comments: item.stats?.commentCount ?? null,
          hearts: item.stats?.heartCount ?? null,
        },
      })
    );
  }
  return rows;
}

async function collectOpenArt() {
  const html = await fetchText("https://openart.ai/discovery");
  const payload = extractJsonScript(html, "__NEXT_DATA__");
  const items = payload?.props?.pageProps?.initialLoadFeedData?.items || [];
  const rows = [];
  for (const item of items) {
    if (rows.length >= 5) {
      break;
    }
    const promptText = firstString(item.prompt);
    const creator = firstString(
      item.userProfile?.displayName,
      item.userProfile?.username,
      item.userProfile?.name
    );
    const mediaUrl = firstString(
      item.type === 1 ? item.thumbnail_url : "",
      item.image?.raw,
      item.image?.url,
      item.image_url
    );
    if (
      item.is_prompt_private ||
      !promptText ||
      !creator ||
      !mediaUrl ||
      hasBlockedTerms(promptText)
    ) {
      continue;
    }
    rows.push(
      classifySample({
        id: `openart-${item.id}`,
        sourceId: "openart",
        sourceLabel: "OpenArt",
        sourceUrl: `https://openart.ai/community/${item.id}`,
        title: titleFromText(firstString(item.title, promptText), "OpenArt creation"),
        creator,
        creatorUrl: item.userProfile?.username
          ? `https://openart.ai/profile/${item.userProfile.username}`
          : "",
        mediaUrl,
        mediaKind: item.type === 1 || mediaUrl.includes(".mp4") ? "video" : "image",
        promptText,
        method: "",
        model: firstString(item.ai_model, item.sd_version),
        license: "原页未明确，待人工复核",
        notes:
          "当前社区条目含用户资料与公开 Prompt；仍需确认是否为原创上传及转载许可。",
        metrics: {
          likes: item.stats?.like_count ?? null,
          comments: item.stats?.comment_count ?? null,
          bookmarks: item.stats?.bookmark_count ?? null,
        },
      })
    );
  }
  return rows;
}

async function collectGlif() {
  const html = await fetchText(
    "https://glif.app/chat/cards?category=branding-and-design"
  );
  const rows = [];
  for (const seed of GLIF_SEEDS) {
    if (!html.includes(seed.id) && !html.includes(seed.title)) {
      continue;
    }
    rows.push(
      classifySample({
        id: `glif-${seed.id}`,
        sourceId: "glif",
        sourceLabel: "Glif",
        sourceUrl: `https://glif.app/chat/cards/${seed.slug}--${seed.id}`,
        title: seed.title,
        creator: "Glif editorial",
        creatorUrl: "https://glif.app/",
        mediaUrl: seed.mediaUrl,
        mediaKind: seed.mediaUrl.includes(".mp4") ? "video" : "image",
        promptText: seed.prompt,
        method: seed.description,
        model: seed.model,
        license: "平台策展案例；转载与衍生许可待复核",
        notes: "当前为公开创作卡，不依赖已停用的旧 Glif API。",
      })
    );
  }
  return rows;
}

async function collectLexica() {
  const rows = [];
  const seen = new Set();
  for (const search of LEXICA_SEARCHES) {
    const searchUrl = `https://lexica.art/?q=${encodeURIComponent(search.query)}`;
    const html = await fetchText(searchUrl);
    const flightText = extractNextFlightText(html);
    const marker = '"prompts":[';
    const markerIndex = flightText.indexOf(marker);
    if (markerIndex < 0) {
      continue;
    }
    const arrayStart = markerIndex + marker.length - 1;
    const json = extractBalancedJsonValue(flightText, arrayStart);
    const prompts = json ? JSON.parse(json) : [];
    let acceptedForSearch = 0;
    for (const item of prompts) {
      if (acceptedForSearch >= search.limit) {
        break;
      }
      const promptText = firstString(item.cleanedPrompt, item.prompt);
      const image = item.images?.[0];
      if (
        item.is_private ||
        !promptText ||
        !image?.id ||
        seen.has(item.id) ||
        hasBlockedTerms(promptText)
      ) {
        continue;
      }
      seen.add(item.id);
      acceptedForSearch += 1;
      rows.push(
        classifySample({
          id: `lexica-${item.id}`,
          sourceId: "lexica",
          sourceLabel: "Lexica",
          sourceUrl: searchUrl,
          title: titleFromText(promptText, "Lexica prompt"),
          creator: "未知作者",
          creatorUrl: "",
          mediaUrl: `https://image.lexica.art/full_jpg/${image.id}`,
          mediaKind: "image",
          promptText,
          method: "",
          model: firstString(item.model, image.model_mode),
          license: "原页未明确，待人工复核",
          notes:
            "定向搜索页给出 Prompt 与结果，但没有稳定可读的 Creator 身份，因此只能作线索。",
        })
      );
    }
  }
  return rows;
}

async function collectIdeogram() {
  const guideUrl = "https://ideogram.ai/blog/claude-mcp/";
  const html = await fetchText(guideUrl);
  const rows = [];
  for (const item of extractIdeogramGalleryItems(html)) {
    if (
      rows.length >= 5 ||
      hasBlockedTerms(item.prompt) ||
      !/(poster|infographic|logo|packaging|print|graphic)/i.test(item.prompt)
    ) {
      continue;
    }
    const id = item.sourceUrl.split("/g/")[1]?.split("/")[0] || String(rows.length + 1);
    rows.push(
      classifySample({
        id: `ideogram-${id}`,
        sourceId: "ideogram",
        sourceLabel: "Ideogram",
        sourceUrl: item.sourceUrl,
        title: titleFromText(item.prompt, "Ideogram guide example"),
        creator: "Ideogram · Nik",
        creatorUrl: guideUrl,
        mediaUrl: item.mediaUrl,
        mediaKind: "image",
        promptText: item.prompt,
        method:
          "来自 Ideogram 官方 Prompt Guide 的公开示例；可用于比较结构化提示与风格配方。",
        model: "Ideogram 4.0",
        license: "官方指南示例；转载与衍生许可待复核",
        notes: "不是社区批量接口样本，而是官方指南中可回溯的案例。",
      })
    );
  }
  return rows;
}

async function collectComfy() {
  const html = await fetchText("https://comfy.org/workflows/");
  const rows = [];
  const creatorCounts = new Map();

  for (const card of extractComfyWorkflowCards(html)) {
    if (rows.length >= 12) {
      break;
    }
    if (
      card.username === "comfyui" ||
      hasBlockedTerms(`${card.title}\n${card.description}`)
    ) {
      continue;
    }

    const creatorCount = creatorCounts.get(card.username) || 0;
    if (creatorCount >= 2) {
      continue;
    }
    creatorCounts.set(card.username, creatorCount + 1);

    rows.push(
      classifySample({
        id: `comfy-${card.shareId}`,
        sourceId: "comfy",
        sourceLabel: "Comfy Workflows",
        sourceUrl: `https://comfy.org/workflows/${card.shareId}-${card.shareId}/`,
        title: card.title,
        creator: card.creator || card.username,
        creatorUrl: `https://comfy.org/workflows/creators/${card.username}/`,
        mediaUrl: card.mediaUrl,
        mediaKind:
          card.mediaType === "video" || card.mediaUrl.includes(".mp4")
            ? "video"
            : "image",
        promptText: "",
        method: card.description,
        model: card.model || "ComfyUI",
        license: "原页未明确，待人工复核",
        notes:
          "公开社区工作流，可在原页查看或下载；尚未由 GoodCase 实际复跑。",
      })
    );
  }

  return rows;
}

async function collectRunComfy() {
  const rows = [];
  for (const slug of RUNCOMFY_SEEDS) {
    const sourceUrl = `https://www.runcomfy.com/comfyui-workflows/${slug}`;
    const html = await fetchText(sourceUrl);
    const body = stripHtml(html);
    const description = firstString(
      extractMeta(html, "og:description", { property: true }),
      extractMeta(html, "description")
    );
    const method = extractSection(
      body,
      ["Workflow Name:"],
      ["Examples", "Get started for Free"],
      description
    );
    const mediaUrl = extractMeta(html, "og:image", { property: true });

    rows.push(
      classifySample({
        id: `runcomfy-${slug}`,
        sourceId: "runcomfy",
        sourceLabel: "RunComfy",
        sourceUrl,
        title: firstString(
          extractMeta(html, "og:title", { property: true }),
          slug.replaceAll("-", " ")
        ),
        creator: "未知作者",
        creatorUrl: "",
        mediaUrl,
        mediaKind: mediaUrl.includes(".mp4") ? "video" : "image",
        promptText: "",
        method: method.slice(0, 4_000),
        model: "ComfyUI",
        license: "原页未明确，待人工复核",
        notes:
          "工作流与结果可运行，但当前公开详情未提供可核验的原始创作者，因此只作线索。",
      })
    );
  }
  return rows;
}

async function collectYouMl() {
  const rows = [];
  for (const seed of YOUML_SEEDS) {
    const sourceUrl = `https://youml.com/recipes/${seed.id}`;
    const html = await fetchText(sourceUrl);
    const mediaUrl = extractMeta(html, "og:image", { property: true });
    rows.push(
      classifySample({
        id: `youml-${seed.id.split("-")[0]}`,
        sourceId: "youml",
        sourceLabel: "YouML",
        sourceUrl,
        title: firstString(
          extractMeta(html, "og:title", { property: true }),
          seed.id.replaceAll("-", " ")
        ),
        creator: seed.creator,
        creatorUrl: `https://youml.com/users/${seed.creator}`,
        mediaUrl,
        mediaKind: mediaUrl.includes(".mp4") ? "video" : "image",
        promptText: seed.prompt,
        method: seed.method,
        model: "YouML Recipe",
        license: "原页未明确，待人工复核",
        notes:
          "有稳定 Recipe、作者和运行入口；底层 Prompt/工作流未完整公开时只作线索。",
      })
    );
  }
  return rows;
}

async function collectPromptDen() {
  const rows = [];
  for (const slug of PROMPTDEN_SEEDS) {
    const sourceUrl = `https://promptden.com/post/${slug}`;
    const html = await fetchText(sourceUrl);
    const body = stripHtml(html);
    const creatorRaw = body.match(/\nBy\s+@([^\s•]+)/)?.[1] || "";
    const creator =
      creatorRaw === "prompts" || creatorRaw === "mjart"
        ? "未知作者"
        : creatorRaw;
    const promptText =
      body
        .match(
          /Prompt Used\s+(?:Please login to view the prompt\.\s*)?([\s\S]*?)(?:\n(?:MidJourney|DALL-E|Stable Diffusion|Firefly|Veo|Flux)\b)/i
        )?.[1]
        ?.trim() || "";
    const title = extractMeta(html, "og:title", { property: true });
    if (hasBlockedTerms(`${title}\n${promptText}`)) {
      continue;
    }
    const mediaUrl = extractMeta(html, "og:image", { property: true });

    rows.push(
      classifySample({
        id: `promptden-${slug}`,
        sourceId: "promptden",
        sourceLabel: "PromptDen",
        sourceUrl,
        title,
        creator: creator || "未知作者",
        creatorUrl: creator
          ? `https://promptden.com/profile/${encodeURIComponent(creator)}`
          : "",
        mediaUrl,
        mediaKind: mediaUrl.includes(".mp4") ? "video" : "image",
        promptText,
        method: "",
        model: body.includes("\nMidJourney\n") ? "MidJourney" : "",
        license: "原页未明确，待人工复核",
        notes:
          creator === "未知作者"
            ? "当前条目来自站点聚合账号，不能当作原始创作者 Case。"
            : "有详情、结果与 Prompt；仍需核对原创身份和转载许可。",
      })
    );
  }
  return rows;
}

async function collectFireflyStatus() {
  const html = await fetchText("https://firefly.adobe.com/community");
  const text = stripHtml(html);
  if (/JavaScript required/i.test(text)) {
    throw new Error("公开画廊在当前采集环境只返回 JavaScript required");
  }
  throw new Error("未发现可稳定读取的公开作品详情");
}

const COLLECTORS = [
  ["runninghub", "RunningHub", collectRunningHub],
  ["liblib", "LiblibAI", collectLiblib],
  ["comfy", "Comfy Workflows", collectComfy],
  ["runcomfy", "RunComfy", collectRunComfy],
  ["youml", "YouML", collectYouMl],
  ["promptden", "PromptDen", collectPromptDen],
  ["prompthero", "PromptHero", collectPromptHero],
  ["civitai", "Civitai", collectCivitai],
  ["openart", "OpenArt", collectOpenArt],
  ["glif", "Glif", collectGlif],
  ["lexica", "Lexica", collectLexica],
  ["ideogram", "Ideogram", collectIdeogram],
  ["firefly", "Adobe Firefly Community", collectFireflyStatus],
];

function renderMarkdown(report) {
  const lines = [
    `# GoodCase 多来源影子样本 · ${report.runDate}`,
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 总样本：${report.stats.total}`,
    `- 完整 Case 候选：${report.stats.cases}`,
    `- 线索：${report.stats.topicSeeds}`,
    `- 仅本地审核：是`,
    "",
    "## 来源状态",
    "",
    "| 来源 | 结果 | 样本 | Case | 线索 |",
    "|---|---|---:|---:|---:|",
  ];
  for (const source of report.sources) {
    const result = source.role === "discovery_only"
      ? `仅发现：${source.note}`
      : source.error
        ? `失败：${source.error}`
        : "成功";
    lines.push(
      `| ${source.label} | ${result} | ${source.collected} | ${source.cases} | ${source.topicSeeds} |`
    );
  }
  lines.push(
    "",
    "## 样本",
    "",
    "| # | 来源 | 类型 | 完整度 | 作者 | 标题 |",
    "|---:|---|---|---:|---|---|"
  );
  report.items.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${item.sourceLabel} | ${item.candidateType} | ${Math.round(item.completeness * 100)}% | ${item.creator || "—"} | [${item.title.replaceAll("|", "\\|")}](${item.sourceUrl}) |`
    );
  });
  lines.push(
    "",
    "> 本批次不写 Supabase、不下载媒体、不自动发布；审核页的选择只保存在本机浏览器。",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const runDate = getArg("--date", tokyoDate());
  const outputDir = path.resolve(
    APP_DIR,
    getArg("--output-dir", "tmp/supply-reports")
  );
  const outputStem = getArg(
    "--output-stem",
    `${runDate}-alternative-source-samples`
  );
  const items = [];
  const sources = [];

  for (const [id, label, collector] of COLLECTORS) {
    try {
      const collected = await collector();
      const rows = Array.isArray(collected) ? collected : [];
      items.push(...rows);
      sources.push({
        id,
        label,
        collected: rows.length,
        cases: rows.filter((item) => item.candidateType === "case").length,
        topicSeeds: rows.filter((item) => item.candidateType === "topic_seed")
          .length,
        error: "",
      });
    } catch (error) {
      sources.push({
        id,
        label,
        collected: 0,
        cases: 0,
        topicSeeds: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  sources.push(
    ...DISCOVERY_ONLY_SOURCES.map((source) => ({
      ...source,
      role: "discovery_only",
      collected: 0,
      cases: 0,
      topicSeeds: 0,
      error: "",
    }))
  );

  const report = {
    schemaVersion: 1,
    mode: "shadow",
    runDate,
    generatedAt: new Date().toISOString(),
    stats: {
      total: items.length,
      cases: items.filter((item) => item.candidateType === "case").length,
      topicSeeds: items.filter((item) => item.candidateType === "topic_seed").length,
    },
    sources,
    items,
  };
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${outputStem}.json`);
  const markdownPath = path.join(outputDir, `${outputStem}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        jsonPath,
        markdownPath,
        stats: report.stats,
        sources,
      },
      null,
      2
    )
  );
}

await main();
