import test from "node:test";
import assert from "node:assert/strict";
import { createSlidingWindowLimiter } from "../../../src/lib/rate-limit.ts";

const HOUR = 60 * 60 * 1000;

test("窗口边界：第 limit 次放行，第 limit+1 次被拒", () => {
  const limiter = createSlidingWindowLimiter({ limit: 3, windowMs: HOUR });
  const t0 = 1_000_000;

  assert.deepEqual(limiter.hit("ip:1.2.3.4", t0), {
    allowed: true,
    limit: 3,
    remaining: 2,
    resetAt: t0 + HOUR,
  });
  assert.equal(limiter.hit("ip:1.2.3.4", t0 + 10).remaining, 1);

  const third = limiter.hit("ip:1.2.3.4", t0 + 20);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const fourth = limiter.hit("ip:1.2.3.4", t0 + 30);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);
  // resetAt 指向窗口内最早那次调用滑出去的时刻，即配额开始回补的时刻。
  assert.equal(fourth.resetAt, t0 + HOUR);
});

test("被拒的请求不进窗口，否则持打的客户端永远等不到放行", () => {
  const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: HOUR });
  const t0 = 0;

  limiter.hit("k", t0);
  limiter.hit("k", t0 + 1);

  // 窗口打满之后连打三次，resetAt 必须一直是"第一次调用 + 窗口"，不能被推后。
  for (const offset of [10, 20, 30]) {
    const denied = limiter.hit("k", t0 + offset);
    assert.equal(denied.allowed, false);
    assert.equal(denied.resetAt, t0 + HOUR);
  }

  // t0 那次刚好滑出窗口，t0+1 那次还在：只回补一个名额。
  const after = limiter.hit("k", t0 + HOUR);
  assert.equal(after.allowed, true);
  assert.equal(after.remaining, 0, "只回补了一个名额，因为第二次调用还在窗口里");

  // 再往后两次调用都过期了，配额整个回满。
  const later = limiter.hit("k", t0 + 2 * HOUR + 1);
  assert.equal(later.allowed, true);
  assert.equal(later.remaining, 1);
});

test("滑动而不是固定窗口：过期的调用逐个释放名额", () => {
  const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 1000 });

  limiter.hit("k", 0);
  limiter.hit("k", 500);
  assert.equal(limiter.hit("k", 900).allowed, false);

  // t=1001：t=0 那次过期，释放一个。
  assert.equal(limiter.hit("k", 1001).allowed, true);
  assert.equal(limiter.hit("k", 1002).allowed, false);
  // t=1501：t=500 那次也过期。
  assert.equal(limiter.hit("k", 1501).allowed, true);
});

test("不同 key 之间互不影响", () => {
  const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: HOUR });
  assert.equal(limiter.hit("ip:a", 0).allowed, true);
  assert.equal(limiter.hit("ip:b", 0).allowed, true);
  assert.equal(limiter.hit("ip:a", 1).allowed, false);
  assert.equal(limiter.hit("ip:b", 1).allowed, false);
  assert.equal(limiter.size(), 2);
});

test("peek 只看不记", () => {
  const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: HOUR });
  assert.deepEqual(limiter.peek("k", 0), {
    allowed: true,
    limit: 2,
    remaining: 2,
    resetAt: HOUR,
  });
  assert.equal(limiter.size(), 0, "peek 不该建 key");

  limiter.hit("k", 0);
  assert.equal(limiter.peek("k", 0).remaining, 1);
  assert.equal(limiter.peek("k", 0).remaining, 1, "peek 幂等");
});

test("key 数量上限：伪造来源的洪水打不爆内存", () => {
  const limiter = createSlidingWindowLimiter({
    limit: 5,
    windowMs: HOUR,
    maxKeys: 10,
  });

  for (let index = 0; index < 500; index += 1) {
    limiter.hit(`ip:10.0.0.${index}`, index);
  }

  assert.equal(limiter.size(), 10);
  // 最久没动过的被驱逐（相当于窗口重置）——限流器本身绝不能成为故障源。
  assert.equal(limiter.hit("ip:10.0.0.0", 600).remaining, 4);
  // 最近用过的还在窗口里。
  assert.equal(limiter.hit("ip:10.0.0.499", 600).remaining, 3);
});

test("参数被规范化：小数和零不会产生无限或负配额", () => {
  const limiter = createSlidingWindowLimiter({ limit: 0, windowMs: 0 });
  const first = limiter.hit("k", 0);
  assert.equal(first.limit, 1, "limit 至少为 1");
  assert.equal(first.allowed, true);
  assert.equal(limiter.hit("k", 0).allowed, false);
});

test("reset 清空全部窗口", () => {
  const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: HOUR });
  limiter.hit("k", 0);
  assert.equal(limiter.hit("k", 1).allowed, false);
  limiter.reset();
  assert.equal(limiter.size(), 0);
  assert.equal(limiter.hit("k", 2).allowed, true);
});
