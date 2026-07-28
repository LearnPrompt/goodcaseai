import { canonicalizeUrl } from "./canonical.mjs";
import {
  extractBestMedia,
  extractThreadPrompt,
  mapTweetToReviewItem,
} from "./web-calibration.mjs";

export const WEB_DISCOVERY_QUERIES = [
  '"landing page" "Prompt:" filter:media -filter:replies -filter:retweets min_faves:3',
  '"website" "Prompt:" filter:media -filter:replies -filter:retweets min_faves:3',
  '"web app" "Prompt:" filter:media -filter:replies -filter:retweets min_faves:3',
  '"build a website" prompt filter:media -filter:replies -filter:retweets min_faves:3',
  '(Claude OR Gemini OR Fable OR Lovable OR v0) "Prompt:" filter:media -filter:replies -filter:retweets min_faves:3',
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

function isWebResult(text) {
  return /\b(website|landing page|web app|frontend|portfolio|dashboard|webpage|site|saas|three\.js|react|next\.js)\b|网页|网站|落地页/i.test(
    text
  );
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
    methodSignal: true,
    promptScope: "main",
    allowShortPrompt: true,
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
    const text = tweetText(tweet);
    if (!id || !creator || seenTweetIds.has(id) || !isWebResult(text)) {
      continue;
    }
    seenTweetIds.add(id);
    const sourceUrl = canonicalizeUrl(`https://x.com/${creator}/status/${id}`);
    if (!sourceUrl || seenUrls.has(sourceUrl)) {
      continue;
    }
    const media = extractBestMedia(tweet);
    const promptText = extractThreadPrompt(tweet, [tweet], {
      allowShortPrompt: true,
    });
    if (!media.mediaUrl || !promptText) {
      continue;
    }
    const item = mapTweetToReviewItem(
      tweet,
      buildWebDiscoverySeed(tweet),
      [tweet]
    );
    if (item.candidateType !== "case" || !item.promptText) {
      continue;
    }
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
