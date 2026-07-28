#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import {
  buildCreatorAvatarPlan,
  normalizeXAvatarUrl,
} from "./lib/creator-avatar-backfill.mjs";

function getArg(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少 ${name}。`);
  }
  return value;
}

async function loadPublishedCases(supabase) {
  const withAvatar = await supabase
    .from("cases")
    .select("id,creator_name,creator_avatar_url,source_url")
    .eq("is_published", true)
    .order("creator_name", { ascending: true });

  if (!withAvatar.error) {
    return { rows: withAvatar.data || [], schemaReady: true };
  }

  if (
    withAvatar.error.code !== "42703" &&
    withAvatar.error.code !== "PGRST204"
  ) {
    throw new Error(`读取公开 Case 失败：${withAvatar.error.message}`);
  }

  const withoutAvatar = await supabase
    .from("cases")
    .select("id,creator_name,source_url")
    .eq("is_published", true)
    .order("creator_name", { ascending: true });
  if (withoutAvatar.error) {
    throw new Error(`读取公开 Case 失败：${withoutAvatar.error.message}`);
  }
  return {
    rows: (withoutAvatar.data || []).map((item) => ({
      ...item,
      creator_avatar_url: null,
    })),
    schemaReady: false,
  };
}

async function fetchAvatarBatch(targets, apiKey) {
  const ids = targets.map((item) => item.tweetIds[0]);
  const response = await fetch(
    "https://api.socialdata.tools/twitter/tweets-by-ids",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!response.ok) {
    throw new Error(`SocialData 批量原帖回查失败：HTTP ${response.status}`);
  }
  const payload = await response.json();
  const tweets = Array.isArray(payload)
    ? payload
    : payload.tweets || payload.data || [];
  const byId = new Map(
    tweets.map((tweet) => [String(tweet.id_str || tweet.id), tweet])
  );
  return targets.map((target) => {
    const tweetId = target.tweetIds[0];
    const tweet = byId.get(tweetId);
    const avatarUrl = normalizeXAvatarUrl(
      tweet?.user?.profile_image_url_https
    );
    return {
      target,
      tweetId,
      avatarUrl,
      handle: String(
        tweet?.user?.screen_name || tweet?.user?.username || ""
      ),
    };
  });
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const apply = hasFlag("--apply");
  const confirmed = hasFlag("--confirm-public-profile-backfill");
  const creatorFilter = getArg("--creator")?.trim().toLowerCase() || null;
  const requestedLimit = Number(getArg("--limit") || "1000");
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.round(requestedLimit), 1_000)
      : 1_000;

  if (apply && !confirmed) {
    throw new Error(
      "写入前必须同时提供 --apply --confirm-public-profile-backfill。"
    );
  }

  const supabase = createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { rows, schemaReady } = await loadPublishedCases(supabase);
  const plan = buildCreatorAvatarPlan(rows);
  let targets = plan.groups.filter((item) => item.status === "resolvable");
  if (creatorFilter) {
    targets = targets.filter(
      (item) =>
        item.creatorKey === creatorFilter ||
        item.handles.includes(creatorFilter.replace(/^@/, ""))
    );
  }
  targets = targets.slice(0, limit);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        schemaReady,
        publishedCases: rows.length,
        ...plan.counts,
        selectedForBackfill: targets.length,
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log(
      "未调用 SocialData、未写数据库。应用迁移后，再显式加入 --apply --confirm-public-profile-backfill。"
    );
    return;
  }
  if (!schemaReady) {
    throw new Error("creator_avatar_url 迁移尚未应用，拒绝写入。");
  }

  const apiKey = requireEnvironment("SOCIALDATA_API_KEY");
  const result = { updatedCreators: 0, updatedCases: 0, failed: [] };
  const resolvedTargets = [];
  for (const targetBatch of chunk(targets, 100)) {
    resolvedTargets.push(...(await fetchAvatarBatch(targetBatch, apiKey)));
  }

  for (const resolved of resolvedTargets) {
    const { target, avatarUrl, handle, tweetId } = resolved;
    if (!avatarUrl) {
      result.failed.push({
        creator: target.creatorName,
        tweetId,
        reason: "原帖未返回可验证的 X 公开头像",
      });
      continue;
    }

    const { data, error } = await supabase
      .from("cases")
      .update({ creator_avatar_url: avatarUrl })
      .in("id", target.caseIds)
      .is("creator_avatar_url", null)
      .select("id");
    if (error) {
      result.failed.push({
        creator: target.creatorName,
        handle,
        reason: error.message,
      });
      continue;
    }
    result.updatedCreators += 1;
    result.updatedCases += data?.length || 0;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
