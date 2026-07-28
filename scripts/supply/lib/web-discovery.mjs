import { canonicalizeUrl } from "./canonical.mjs";
import {
  extractBestMedia,
  mapTweetToReviewItem,
} from "./web-calibration.mjs";

export const WEB_DISCOVERY_QUERIES = [
  '"exact prompt" "landing page" filter:media -filter:replies -filter:retweets min_faves:2',
  '"prompt I used" website filter:media -filter:replies -filter:retweets min_faves:2',
  '"website prompt:" hero responsive filter:media -filter:replies -filter:retweets min_faves:2',
  '"built this" "Prompt:" website filter:media -filter:replies -filter:retweets min_faves:2',
  '(built OR recreated OR generated) ("landing page" OR website OR portfolio) "Prompt:" filter:media -filter:replies -filter:retweets min_faves:2',
];

const PROMPT_MARKER =
  /(?:here(?:'s| is)\s+|my\s+)?(?:the\s+)?(?:(?:exact|full|website|landing page|web app)\s+)?prompt(?:\s+i\s+used|\s+used|\s+template(?:\s+was)?|\s+for\s+this)?\s*[:：]\s*|use this prompt\s*[:：]\s*/i;
const WEB_TARGET =
  /\b(website|landing page|web app|portfolio|dashboard|webpage|microsite|saas site|e-?commerce site)\b|网页|网站|落地页/i;
const WEB_BUILD_TARGET =
  /\b(build|create|design|develop|implement|recreate|redesign|generate|make)\b[\s\S]{0,160}\b(website|landing page|web app|portfolio|dashboard|webpage|microsite|saas site|e-?commerce site)\b/i;
const WEB_DECLARATIVE_TARGET =
  /^(?:(?:a|an|the)\s+)?(?:[\w-]+\s+){0,8}(website|landing page|web app|portfolio|dashboard|webpage|microsite)\b/i;
const REJECTED_POST_PATTERNS = [
  /\b(?:same prompt|one shot each|benchmark|head[- ]to[- ]head|compared? (?:with|to)|model comparison)\b/i,
  /\b(?:vs\.?|versus)\b.{0,80}\b(?:claude|gemini|gpt|kimi|qwen|fable|model)\b/i,
  /\b(?:how to build|how to use|quick (?:simple )?guide|step[- ]by[- ]step|ways to use)\b/i,
  /\b(?:prompt (?:is )?in (?:the )?(?:first )?comment|full prompt.{0,40}comments?|comment.{0,40}(?:get|send|prompt))\b/i,
  /\b(?:bonus credits|daily credits|sign up|affiliate|download (?:the )?app)\b/i,
  /\b\d{2,3}\+?\s+(?:free\s+)?(?:ai\s+)?(?:tools|websites|prompts|resources)\b/i,
];

function tweetText(tweet) {
  return String(tweet?.full_text || tweet?.text || "").trim();
}

function tweetId(tweet) {
  return String(tweet?.id_str || tweet?.id || "").trim();
}

function username(tweet) {
  return String(
    tweet?.user?.screen_name || tweet?.user?.username || ""
  ).trim();
}

function interactionScore(item) {
  return (
    Number(item.metrics?.likes || 0) +
    2 * Number(item.metrics?.comments || 0) +
    3 * Number(item.metrics?.reposts || 0) +
    4 * Number(item.metrics?.bookmarks || 0)
  );
}

function decodeTweetText(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function uniqueSignals(value, pattern) {
  return new Set(
    (value.match(pattern) || []).map((item) => item.toLocaleLowerCase())
  ).size;
}

function looksLikeListPost(text) {
  return (text.match(/^\s*\d{1,3}[.)]\s+\S+/gm) || []).length >= 5;
}

function hasSingleResultSignal(text, markerIndex) {
  if (markerIndex <= 12) return true;
  return /\b(?:(?:i|we|just)\s+)?(?:built|created|designed|generated|recreated|redesigned|shipped|made)\b.{0,100}\b(?:website|landing page|web app|portfolio|dashboard|site|this|it)\b|\b(?:result|output|recreation|redesign|clone|case study|live preview|demo)\b/i.test(
    text.slice(0, markerIndex)
  );
}

function isolatePromptBody(value) {
  const text = value.trim();
  const openingQuote = text.match(/^["“'`]/)?.[0];
  if (openingQuote) {
    const closingQuote = openingQuote === "“" ? "”" : openingQuote;
    const closingIndex = text.indexOf(closingQuote, openingQuote.length);
    if (closingIndex > 0) {
      return text.slice(openingQuote.length, closingIndex).trim();
    }
  }
  return text
    .replace(
      /\n{2,}(?:what (?:it|the model) generated|(?:the )?(?:final )?(?:result|output)|here(?:'s| is) (?:the )?(?:public |live )?(?:link|demo)|watch (?:the|this)|try it|like|bookmark|follow|comment|reply|share|full prompt|source file)\b[\s\S]*$/i,
      ""
    )
    .replace(/^["“'`]+|["”'`]+$/g, "")
    .trim();
}

export function extractStrictWebPrompt(value) {
  const text = decodeTweetText(value).trim();
  const marker = text.match(PROMPT_MARKER);
  if (!marker || marker.index == null) return "";
  if (
    looksLikeListPost(text) ||
    REJECTED_POST_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return "";
  }

  const markerEnd = marker.index + marker[0].length;
  const prompt = isolatePromptBody(text.slice(markerEnd));
  if (prompt.length < 100 || prompt.length > 12_000) return "";

  const targetWindow = prompt.slice(0, 420);
  if (
    !WEB_BUILD_TARGET.test(targetWindow) &&
    !WEB_DECLARATIVE_TARGET.test(targetWindow)
  ) {
    return "";
  }

  const sectionSignals = uniqueSignals(
    prompt,
    /\b(hero|features?|pricing|testimonials?|faq|navigation|navbar|footer|about|services?|contact|gallery|dashboard|forms?|cards?|sections?|pages?)\b/gi
  );
  const visualSignals = uniqueSignals(
    prompt,
    /\b(typography|fonts?|colors?|palette|backgrounds?|theme|gradients?|layout|spacing|visual style|dark|light|glassmorphism|brutalism|3d)\b/gi
  );
  const behaviorSignals = uniqueSignals(
    prompt,
    /\b(responsive|mobile|animations?|interactions?|hover|scroll|transitions?|menu|accordion|carousel|webgl|three\.js|react|next\.js|tailwind|html)\b/gi
  );
  if (
    sectionSignals < 2 ||
    visualSignals < 1 ||
    (behaviorSignals < 1 && sectionSignals < 3)
  ) {
    return "";
  }
  return prompt;
}

export function evaluateStrictWebPost(tweet) {
  const text = tweetText(tweet);
  const media = extractBestMedia(tweet);
  if (!media.mediaUrl) {
    return { eligible: false, reason: "missing_media", promptText: "" };
  }
  if (!WEB_TARGET.test(text)) {
    return { eligible: false, reason: "missing_web_target", promptText: "" };
  }
  const marker = decodeTweetText(text).match(PROMPT_MARKER);
  const promptText = extractStrictWebPrompt(text);
  if (!promptText) {
    return { eligible: false, reason: "missing_complete_prompt", promptText: "" };
  }
  if (!hasSingleResultSignal(text, marker?.index ?? Number.POSITIVE_INFINITY)) {
    return { eligible: false, reason: "missing_single_result", promptText: "" };
  }
  return { eligible: true, reason: "", promptText };
}

function compactTitle(text, model, creator) {
  const line = text
    .split(/\n+/)
    .map((value) => value.replace(/https:\/\/t\.co\/\w+/g, "").trim())
    .find(
      (value) =>
        value.length >= 12 &&
        !/^(?:website\s+)?prompt\s*:?\s*$/i.test(value)
    );
  const excerpt = (line || `@${creator} 的网页生成案例`)
    .replace(/\s+/g, " ")
    .slice(0, 72);
  return `${model}：${excerpt}`;
}

export function inferWebModel(text) {
  const models = [
    ["Claude", /claude|opus|sonnet/i],
    ["Fable", /\bfable\b/i],
    ["Gemini", /gemini|antigravity/i],
    ["Lovable", /\blovable\b/i],
    ["v0", /\bv0\b|vercel/i],
    ["Grok", /\bgrok\b/i],
    ["Kimi", /\bkimi\b/i],
    ["Qwen", /\bqwen\b/i],
    ["GLM", /\bglm\b/i],
    ["Replit", /\breplit\b/i],
  ];
  return models.find(([, pattern]) => pattern.test(text))?.[0] || "AI Web Builder";
}

export function buildWebDiscoverySeed(tweet) {
  const text = tweetText(tweet);
  const creator = username(tweet);
  const model = inferWebModel(text);
  const sourceId =
    model === "Claude"
      ? "x-claude"
      : model === "Lovable"
        ? "x-lovable"
        : model === "v0"
          ? "x-v0"
          : "x-mixed";
  return {
    id: tweetId(tweet),
    title: compactTitle(text, model, creator),
    sourceId,
    model,
    methodSignal: false,
    promptScope: "main",
    allowShortPrompt: false,
    notes: `SocialData 自动发现；检索式：${tweet._goodcase_query || "未记录"}`,
  };
}

export function selectWebDiscoveryItems(
  tweets,
  { existingUrls = [], limit = 50, maxPerCreator = 2 } = {}
) {
  if (!Array.isArray(tweets) || !Array.isArray(existingUrls)) {
    throw new Error("tweets 和 existingUrls 必须是数组。");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit 必须是正整数。");
  }
  if (!Number.isInteger(maxPerCreator) || maxPerCreator < 1) {
    throw new Error("maxPerCreator 必须是正整数。");
  }

  const existing = new Set(existingUrls.map(canonicalizeUrl).filter(Boolean));
  const seenTweetIds = new Set();
  const seenUrls = new Set(existing);
  const eligible = [];

  for (const tweet of tweets) {
    const id = tweetId(tweet);
    const creator = username(tweet);
    if (!id || !creator || seenTweetIds.has(id)) {
      continue;
    }
    seenTweetIds.add(id);
    const sourceUrl = canonicalizeUrl(`https://x.com/${creator}/status/${id}`);
    if (!sourceUrl || seenUrls.has(sourceUrl)) {
      continue;
    }
    const strict = evaluateStrictWebPost(tweet);
    if (!strict.eligible) {
      continue;
    }
    const item = mapTweetToReviewItem(
      tweet,
      buildWebDiscoverySeed(tweet),
      [tweet]
    );
    item.promptText = strict.promptText;
    item.checks.method = false;
    item.checks.prompt = true;
    item.candidateType = "case";
    item.completeness = 1;
    item.notes +=
      "\n严格门：显式完整 Prompt、单一网页成品、结构/视觉/交互规格齐全。";
    seenUrls.add(sourceUrl);
    eligible.push(item);
  }

  eligible.sort((left, right) => {
    const scoreDelta = interactionScore(right) - interactionScore(left);
    if (scoreDelta !== 0) return scoreDelta;
    return left.sourceUrl.localeCompare(right.sourceUrl);
  });

  const creatorCounts = new Map();
  const items = [];
  for (const item of eligible) {
    const key = item.creator.toLocaleLowerCase();
    const count = creatorCounts.get(key) || 0;
    if (count >= maxPerCreator) continue;
    items.push(item);
    creatorCounts.set(key, count + 1);
    if (items.length >= limit) break;
  }
  return items;
}
