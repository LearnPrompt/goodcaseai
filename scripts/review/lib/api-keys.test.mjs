import test from "node:test";
import assert from "node:assert/strict";
import {
  ANONYMOUS_HOURLY_LIMIT,
  API_KEY_PREFIX,
  DEFAULT_DAILY_LIMIT,
  cleanDailyLimit,
  cleanKeyName,
  clientIpFromHeaders,
  evaluateQuota,
  extractApiKeyAttempt,
  generateApiKey,
  hashApiKey,
  isApiKeyShaped,
  isKeyHashShaped,
  isMissingApiKeyRelationError,
  nextUsageResetAt,
  rateLimitHeaders,
  retryAfterSeconds,
  usageDayKey,
  verifyApiKeyHash,
  verifyStoredApiKey,
} from "../../../src/lib/api-keys.ts";

/** 测试里的假请求头：只需要 get(name)，大小写不敏感和真 Headers 保持一致。 */
function headers(map) {
  const lower = new Map(
    Object.entries(map).map(([key, value]) => [key.toLowerCase(), value])
  );
  return { get: (name) => lower.get(name.toLowerCase()) ?? null };
}

test("生成的 key 带命名空间前缀，且明文与哈希对得上", () => {
  const { plaintext, hash } = generateApiKey();
  assert.ok(plaintext.startsWith(API_KEY_PREFIX));
  assert.equal(isApiKeyShaped(plaintext), true);
  assert.equal(isKeyHashShaped(hash), true);
  assert.equal(hash, hashApiKey(plaintext));
  assert.equal(verifyApiKeyHash(plaintext, hash), true);

  // 两次生成不能撞。熵是 192 bit，撞了说明随机源坏了。
  assert.notEqual(generateApiKey().plaintext, plaintext);
});

test("哈希验证拒绝改一个字符的明文、坏形状的哈希和非字符串", () => {
  const { plaintext, hash } = generateApiKey();
  const tampered = `${plaintext.slice(0, -1)}${plaintext.endsWith("a") ? "b" : "a"}`;

  assert.equal(verifyApiKeyHash(tampered, hash), false);
  assert.equal(verifyApiKeyHash(plaintext, `${hash}00`), false);
  assert.equal(verifyApiKeyHash(plaintext, hash.toUpperCase()), false);
  assert.equal(verifyApiKeyHash(plaintext, null), false);
  assert.equal(verifyApiKeyHash("", hash), false);
  // 前缀对但随机段太短，形状先挡掉，不进哈希比对。
  assert.equal(isApiKeyShaped("gc_abc"), false);
  assert.equal(isApiKeyShaped("gc_ZZZZ1111222233334444555566667777"), false);
  assert.equal(isApiKeyShaped("sk_11112222333344445555666677778888"), false);
});

test("只有 gc_ 开头的凭据才算带 key 调用，别的 Authorization 一律当匿名", () => {
  const { plaintext } = generateApiKey();

  assert.deepEqual(extractApiKeyAttempt(headers({})), { present: false });

  assert.deepEqual(
    extractApiKeyAttempt(headers({ Authorization: `Bearer ${plaintext}` })),
    { present: true, shaped: true, plaintext }
  );
  assert.deepEqual(
    extractApiKeyAttempt(headers({ authorization: `bearer ${plaintext}` })),
    { present: true, shaped: true, plaintext }
  );
  assert.deepEqual(extractApiKeyAttempt(headers({ "X-API-Key": plaintext })), {
    present: true,
    shaped: true,
    plaintext,
  });
  // 不带 Bearer 前缀的裸值也认。
  assert.deepEqual(
    extractApiKeyAttempt(headers({ Authorization: `  ${plaintext}  ` })),
    { present: true, shaped: true, plaintext }
  );

  // 向后兼容的核心断言：这些请求以前能通，现在必须还能通（走匿名档），
  // 而不是因为"有 Authorization 头"被打成 401。
  assert.deepEqual(
    extractApiKeyAttempt(headers({ Authorization: "Basic dXNlcjpwYXNz" })),
    { present: false }
  );
  assert.deepEqual(
    extractApiKeyAttempt(headers({ Authorization: "Bearer eyJhbGciOiJIUzI1" })),
    { present: false }
  );
  assert.deepEqual(extractApiKeyAttempt(headers({ Authorization: "" })), {
    present: false,
  });

  // 前缀对但形状不对 = 用户拿错 / 打错了 key，要给 401 而不是静默降级，
  // 否则他会以为自己的配额生效了。
  assert.deepEqual(extractApiKeyAttempt(headers({ "X-API-Key": "gc_oops" })), {
    present: true,
    shaped: false,
    plaintext: "gc_oops",
  });
});

test("库里查回来的行怎么判：活跃且哈希对上才放行，其余三种都拒", () => {
  // 这四条分支只有在迁移跑完之后才可能在线上走到（表不存在时整体降级成免 key），
  // 所以它们的正确性只能靠这个单测保证，不能靠手工请求验证。
  const { plaintext, hash } = generateApiKey();
  const active = { id: 1, key_hash: hash, daily_limit: 2000, status: "active" };

  assert.deepEqual(verifyStoredApiKey(plaintext, active), {
    ok: true,
    key: active,
  });

  // 查无此 key —— 线上最常见的 401，就是有人拿了一把不存在的 key。
  assert.deepEqual(verifyStoredApiKey(plaintext, null), {
    ok: false,
    reason: "not_found",
  });
  assert.deepEqual(verifyStoredApiKey(plaintext, undefined), {
    ok: false,
    reason: "not_found",
  });

  // 已吊销：行还在，但不该再放行。
  assert.deepEqual(
    verifyStoredApiKey(plaintext, { ...active, status: "revoked" }),
    { ok: false, reason: "revoked" }
  );
  // 未知 status 也当不可用处理，不做白名单之外的乐观解释。
  assert.deepEqual(
    verifyStoredApiKey(plaintext, { ...active, status: "suspended" }),
    { ok: false, reason: "revoked" }
  );

  // 哈希对不上：正常查询路径下不该发生（查询本来就按 hash 走），
  // 这一道是防止将来有人把查询条件改坏了还照样放行。
  const other = generateApiKey();
  assert.deepEqual(
    verifyStoredApiKey(plaintext, { ...active, key_hash: other.hash }),
    { ok: false, reason: "hash_mismatch" }
  );
  assert.deepEqual(
    verifyStoredApiKey(plaintext, { ...active, key_hash: "not-a-hash" }),
    { ok: false, reason: "hash_mismatch" }
  );
});

test("客户端 IP 取 x-forwarded-for 最左段，取不到时落进共享桶", () => {
  assert.equal(
    clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })),
    "1.2.3.4"
  );
  assert.equal(
    clientIpFromHeaders(headers({ "X-Forwarded-For": "  9.9.9.9  " })),
    "9.9.9.9"
  );
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  assert.equal(clientIpFromHeaders(headers({})), "unknown");
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": " , " })), "unknown");
});

test("日限额边界：第 limit 次放行且 remaining 归零，第 limit+1 次被拒", () => {
  // consume_api_quota 的返回口径：allowed 时 used 是计数之后的值。
  assert.deepEqual(evaluateQuota(99, 100, true), {
    allowed: true,
    limit: 100,
    used: 99,
    remaining: 1,
  });
  assert.deepEqual(evaluateQuota(100, 100, true), {
    allowed: true,
    limit: 100,
    used: 100,
    remaining: 0,
  });
  assert.deepEqual(evaluateQuota(100, 100, false), {
    allowed: false,
    limit: 100,
    used: 100,
    remaining: 0,
  });
  // 限额被人工调低之后，库里的 used 可能已经超过新 limit：remaining 报 0，不报负数。
  assert.deepEqual(evaluateQuota(500, 100, false), {
    allowed: false,
    limit: 100,
    used: 500,
    remaining: 0,
  });
  // 脏值不该炸，也不该变成负配额。
  assert.deepEqual(evaluateQuota(Number.NaN, 10, true), {
    allowed: true,
    limit: 10,
    used: 0,
    remaining: 10,
  });
  assert.deepEqual(evaluateQuota(3, Number.NaN, true), {
    allowed: true,
    limit: 0,
    used: 3,
    remaining: 0,
  });
});

test("用量日期键和重置时刻都按 UTC 切分", () => {
  // 北京时间 2026-08-07 07:30 = UTC 2026-08-06 23:30，仍然算 8/6 这一天。
  assert.equal(usageDayKey(new Date("2026-08-06T23:30:00Z")), "2026-08-06");
  assert.equal(usageDayKey(new Date("2026-08-07T00:00:00Z")), "2026-08-07");

  const reset = nextUsageResetAt(new Date("2026-08-06T23:30:00Z"));
  assert.equal(new Date(reset).toISOString(), "2026-08-07T00:00:00.000Z");
  // 刚好在零点时，下一个重置点是再下一天，不是当下。
  assert.equal(
    new Date(nextUsageResetAt(new Date("2026-08-07T00:00:00Z"))).toISOString(),
    "2026-08-08T00:00:00.000Z"
  );
});

test("降级判定认全 Postgres 与 PostgREST 两套码，且不误伤别的表", () => {
  assert.equal(isMissingApiKeyRelationError({ code: "42P01" }), true);
  assert.equal(isMissingApiKeyRelationError({ code: "42883" }), true);
  assert.equal(isMissingApiKeyRelationError({ code: "PGRST205" }), true);
  assert.equal(isMissingApiKeyRelationError({ code: "PGRST202" }), true);
  assert.equal(
    isMissingApiKeyRelationError({
      message: "Could not find the table 'public.api_keys' in the schema cache",
    }),
    true
  );
  assert.equal(
    isMissingApiKeyRelationError({
      message: 'function public.consume_api_quota(bigint, date, integer) does not exist',
    }),
    true
  );

  // 真错误不能被当成"表不存在"降级掉，否则会把故障静默成免 key 模式。
  assert.equal(isMissingApiKeyRelationError({ code: "23505" }), false);
  assert.equal(
    isMissingApiKeyRelationError({ message: "permission denied for table api_keys" }),
    false
  );
  assert.equal(
    isMissingApiKeyRelationError({ message: "relation cases does not exist" }),
    false
  );
  assert.equal(isMissingApiKeyRelationError(null), false);
  assert.equal(isMissingApiKeyRelationError("api_keys does not exist"), false);
});

test("签发脚本的输入清洗挡住空名字和越界限额", () => {
  assert.equal(cleanKeyName("  某公司  Agent  "), "某公司 Agent");
  assert.equal(cleanKeyName(""), "");
  assert.equal(cleanKeyName("   "), "");
  assert.equal(cleanKeyName("x".repeat(81)), "");
  assert.equal(cleanKeyName(123), "");

  assert.equal(cleanDailyLimit("5000"), 5000);
  assert.equal(cleanDailyLimit(1), 1);
  assert.equal(cleanDailyLimit(1_000_000), 1_000_000);
  assert.equal(cleanDailyLimit(0), null);
  assert.equal(cleanDailyLimit(-5), null);
  assert.equal(cleanDailyLimit(1_000_001), null);
  assert.equal(cleanDailyLimit("2.5"), null);
  assert.equal(cleanDailyLimit("abc"), null);
  assert.equal(cleanDailyLimit(""), null);
  assert.equal(DEFAULT_DAILY_LIMIT > ANONYMOUS_HOURLY_LIMIT, true);
});

test("限额响应头用 epoch 秒，Retry-After 至少 1 秒", () => {
  const built = rateLimitHeaders({
    limit: 60,
    remaining: 0,
    resetAt: 1_800_000_500,
    scope: "anonymous",
  });
  assert.deepEqual(built, {
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "1800001",
    "X-RateLimit-Scope": "anonymous",
  });
  // 负 remaining 不该漏出去。
  assert.equal(
    rateLimitHeaders({ limit: 1, remaining: -3, resetAt: 0, scope: "key" })[
      "X-RateLimit-Remaining"
    ],
    "0"
  );
  assert.equal(retryAfterSeconds(1_000_000, 999_000), 1);
  assert.equal(retryAfterSeconds(1_000_000, 1_000_000), 1);
  assert.equal(retryAfterSeconds(1_060_000, 1_000_000), 60);
});
