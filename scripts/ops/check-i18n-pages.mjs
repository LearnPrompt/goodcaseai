const originArg = process.argv.find((value) => value.startsWith("--origin="));
const origin = new URL(
  originArg?.slice("--origin=".length) || "http://127.0.0.1:3000"
).origin;

function decodeHtml(value) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    );
}

function visibleText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function read(path, init) {
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    ...init,
  });
  return {
    response,
    body: await response.text(),
  };
}

const failures = [];

function check(name, condition, detail = "") {
  if (!condition) {
    failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

const apiResult = await read("/api/public/cases?take=50&locale=en");
check(
  "English API status",
  apiResult.response.status === 200,
  `HTTP ${apiResult.response.status}`
);
check(
  "English API Content-Language",
  apiResult.response.headers.get("content-language") === "en"
);

if (apiResult.response.status !== 200) {
  const location = apiResult.response.headers.get("location");
  console.error(
    `i18n smoke could not read the preview API: HTTP ${apiResult.response.status}${
      location ? ` → ${location}` : ""
    }`
  );
  process.exit(1);
}

const apiData = JSON.parse(apiResult.body);
const caseSlugs = apiData.items.map((item) => item.slug);
for (const item of apiData.items) {
  check(
    `${item.slug} API locale coverage`,
    item.availableLocales.includes("en") && item.isFallback === false
  );
}

const creatorIndex = await read("/en/creators");
const creatorSlugs = [
  ...creatorIndex.body.matchAll(/href="\/en\/creators\/([^"?#]+)"/g),
]
  .map((match) => match[1])
  .filter((value, index, values) => values.indexOf(value) === index);

const baseRoutes = [
  "/",
  "/cases",
  "/creators",
  "/favorites",
  "/submit",
  "/connect",
  "/changelog",
  "/operator/login",
];
const routes = [
  ...baseRoutes,
  ...caseSlugs.map((slug) => `/cases/${slug}`),
  ...creatorSlugs.map((slug) => `/creators/${slug}`),
];

for (const route of routes) {
  const path = route === "/" ? "/en" : `/en${route}`;
  const result = await read(path);
  const englishText = visibleText(result.body).replaceAll("中文", "");
  check(`${path} status`, result.response.status === 200, `HTTP ${result.response.status}`);
  check(
    `${path} English visible text`,
    !/[\u3400-\u9fff]/u.test(englishText),
    "unexpected Chinese text"
  );
}

const english404 = await read("/en/does-not-exist");
const chinese404 = await read("/does-not-exist");
check(
  "English 404",
  english404.response.status === 404 &&
    visibleText(english404.body).includes("This page does not exist")
);
check(
  "Chinese 404",
  chinese404.response.status === 404 &&
    visibleText(chinese404.body).includes("这个页面不存在")
);

const englishHome = await read("/en");
check(
  "English canonical",
  englishHome.body.includes('<link rel="canonical" href="https://goodcase.ai/en"')
);
check(
  "English page links back to Chinese",
  englishHome.body.includes('href="/"') &&
    englishHome.body.includes('aria-label="切换到中文"')
);
for (const locale of ["zh-CN", "en", "x-default"]) {
  check(
    `${locale} hreflang`,
    englishHome.body.includes(`hrefLang="${locale}"`)
  );
}

const chineseHome = await read("/");
check(
  "Chinese page links to English",
  chineseHome.body.includes('href="/en"') &&
    chineseHome.body.includes('aria-label="Switch to English"')
);

const englishFeed = await read("/en/feed.xml");
check(
  "English RSS",
  englishFeed.response.status === 200 &&
    englishFeed.body.includes("<language>en</language>")
);

const englishLlms = await read("/en/llms.txt");
check(
  "English llms.txt",
  englishLlms.response.status === 200 &&
    englishLlms.body.includes("A public AI case evidence library")
);

const sitemap = await read("/sitemap.xml");
check(
  "Sitemap English routes",
  sitemap.response.status === 200 &&
    sitemap.body.includes("https://goodcase.ai/en/cases")
);

const chinesePrefix = await read("/zh-CN/cases?q=test");
check(
  "Chinese canonical redirect",
  chinesePrefix.response.status === 308 &&
    chinesePrefix.response.headers.get("location") === "/cases?q=test"
);

const legacyPage = await read("/en/project-intro?from=test");
check(
  "Legacy page redirect",
  legacyPage.response.status === 301 &&
    legacyPage.response.headers
      .get("location")
      ?.endsWith("/en/connect#about")
);

const poster = await read(
  `/api/poster/${caseSlugs[0]}?locale=en`,
  { headers: { Accept: "image/png" } }
);
check(
  "English poster",
  poster.response.status === 200 &&
    poster.response.headers.get("content-type")?.startsWith("image/png")
);

if (failures.length) {
  console.error(`i18n smoke failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `i18n smoke passed: ${routes.length} English pages, ${caseSlugs.length} cases, ${creatorSlugs.length} creators`
);
