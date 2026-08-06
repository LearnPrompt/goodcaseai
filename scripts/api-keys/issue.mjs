#!/usr/bin/env node

// Agent API key 的运营工具：签发 / 吊销 / 列出。
//
// v1 刻意不做自助申请：先手动发几十把，看清楚调用方到底是谁、怎么用、
// 什么配额才合理，再决定要不要做注册流。过早自动化一个还没定型的流程，
// 得到的是一个要维护的表单外加一堆僵尸 key。
//
// 用法（都要 .env.local 里的 SUPABASE_SERVICE_ROLE_KEY）：
//   npm run api-keys  -- --name="某公司 Agent" [--daily-limit=5000] [--note="联系人邮箱"]
//   npm run api-keys  -- revoke --id=3
//   npm run api-keys  -- revoke --key=gc_xxxxx
//   npm run api-keys  -- list [--all]
//
// 明文 key 只在 issue 那一刻打印一次，库里、日志里、这个脚本的任何输出文件里
// 都不会再有它。丢了就吊销重发。

import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_DAILY_LIMIT,
  cleanDailyLimit,
  cleanKeyName,
  generateApiKey,
  hashApiKey,
  isApiKeyShaped,
} from "../../src/lib/api-keys.ts";

function getFlag(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    fail(
      "缺少 Supabase 服务端环境变量。用 node --env-file=.env.local 跑，或走 npm run api-keys。"
    );
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function reportRelationMissing(error) {
  const message = String(error?.message || "");
  if (
    /api_keys|api_usage|consume_api_quota/i.test(message) &&
    /(does not exist|schema cache)/i.test(message)
  ) {
    fail(
      "api_keys 相关对象还不存在。先跑 supabase/migrations/20260807000000_agent_api_keys.sql 再签发。"
    );
  }
}

async function issue(supabase) {
  const name = cleanKeyName(getFlag("name"));
  if (!name) {
    fail("--name 必填，1-80 字符。没有名字的 key 事后没法认领和吊销。");
  }

  const rawLimit = getFlag("daily-limit");
  const dailyLimit = rawLimit ? cleanDailyLimit(rawLimit) : DEFAULT_DAILY_LIMIT;
  if (dailyLimit === null) {
    fail("--daily-limit 必须是 1 到 1000000 之间的整数。");
  }

  const note = getFlag("note") || null;
  const { plaintext, hash } = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({ key_hash: hash, name, daily_limit: dailyLimit, note })
    .select("id, name, daily_limit, created_at")
    .single();

  if (error) {
    reportRelationMissing(error);
    fail(`写入失败：${error.message}`);
  }

  // 明文单独打到 stderr 之外的一块显眼区域，并明说它不会再出现第二次。
  console.log("");
  console.log("已签发。明文 key 只显示这一次，现在就交给调用方并从终端记录里清掉：");
  console.log("");
  console.log(`  ${plaintext}`);
  console.log("");
  console.log(
    JSON.stringify(
      {
        id: data.id,
        name: data.name,
        dailyLimit: data.daily_limit,
        createdAt: data.created_at,
        keyHashPrefix: `${hash.slice(0, 12)}…`,
      },
      null,
      2
    )
  );
  console.log("");
  console.log("调用方这样用：");
  console.log(
    `  curl -s -H "Authorization: Bearer ${plaintext}" "https://goodcase.ai/api/public/cases?take=3" -D -`
  );
}

async function revoke(supabase) {
  const rawId = getFlag("id");
  const rawKey = getFlag("key");

  if (!rawId && !rawKey) {
    fail("revoke 需要 --id=<数字> 或 --key=gc_xxx 之一。");
  }

  let query = supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() });

  if (rawId) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      fail("--id 必须是正整数。");
    }
    query = query.eq("id", id);
  } else {
    if (!isApiKeyShaped(rawKey)) {
      fail("--key 形状不对，应为 gc_ 加十六进制随机串。");
    }
    // 明文不入库也不进日志，这里只拿它算 hash 去定位行。
    query = query.eq("key_hash", hashApiKey(rawKey));
  }

  const { data, error } = await query.select("id, name, status, revoked_at");

  if (error) {
    reportRelationMissing(error);
    fail(`吊销失败：${error.message}`);
  }

  if (!data || data.length === 0) {
    fail("没有匹配的 key，什么都没改。");
  }

  console.log(JSON.stringify(data, null, 2));
  console.log("");
  console.log(
    "已吊销。下一次调用就会拿到 401；如果这把 key 在别处被硬编码了，记得同步通知。"
  );
}

async function list(supabase) {
  let query = supabase
    .from("api_keys")
    .select("id, name, status, daily_limit, created_at, last_used_at, note")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!hasFlag("all")) {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;
  if (error) {
    reportRelationMissing(error);
    fail(`读取失败：${error.message}`);
  }

  // 只读今天的用量，够回答"谁在用、用了多少"。历史趋势该走 SQL，不该走这个脚本。
  const today = new Date().toISOString().slice(0, 10);
  const ids = (data || []).map((row) => row.id);
  let usageByKey = {};
  if (ids.length > 0) {
    const usage = await supabase
      .from("api_usage")
      .select("api_key_id, request_count")
      .eq("usage_date", today)
      .in("api_key_id", ids);
    if (!usage.error) {
      usageByKey = Object.fromEntries(
        (usage.data || []).map((row) => [row.api_key_id, row.request_count])
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        usageDate: today,
        keys: (data || []).map((row) => ({
          ...row,
          usedToday: usageByKey[row.id] || 0,
        })),
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : "issue";

  const supabase = getClient();

  if (command === "issue") {
    await issue(supabase);
    return;
  }
  if (command === "revoke") {
    await revoke(supabase);
    return;
  }
  if (command === "list") {
    await list(supabase);
    return;
  }

  fail(`未知子命令 ${command}。支持 issue / revoke / list。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
