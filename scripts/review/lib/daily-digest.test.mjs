import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_DIGEST_EPOCH,
  DAILY_DIGEST_FRESH_WINDOW_DAYS,
  getDigestDateKey,
  getIssueNumber,
  listRecentIssueDates,
  selectDailyDigest,
} from "../../../src/lib/daily-digest.ts";

/** 相对某一天造一条案例，days 是「早于该天多少天发布」。 */
function makeCase(slug, daysAgo, extra = {}) {
  const base = Date.UTC(2026, 7, 7) - daysAgo * 86_400_000;
  return {
    slug,
    // 北京时间当天中午，避开跨时区把日期算歪的边界
    createdAt: new Date(base + 4 * 3_600_000).toISOString(),
    sourceHeatScore: null,
    stabilityScore: 0,
    ...extra,
  };
}

test("早报日期按北京时间跨日，不跟 UTC 走", () => {
  // 2026-08-07 15:59Z 是北京时间 8 月 7 日 23:59，仍属 8 月 7 日那一期
  assert.equal(getDigestDateKey("2026-08-07T15:59:00.000Z"), "2026-08-07");
  // 再过两分钟越过北京时间午夜，翻到下一期
  assert.equal(getDigestDateKey("2026-08-07T16:01:00.000Z"), "2026-08-08");
});

test("期数从固定起始日推算，起始日当天是第 1 期", () => {
  assert.equal(getIssueNumber(DAILY_DIGEST_EPOCH), 1);
  assert.equal(getIssueNumber("2026-05-18"), 2);
  assert.equal(getIssueNumber("2026-08-07"), 83);
});

test("最近期数列表由新到旧，且不会倒推到起始日之前", () => {
  assert.deepEqual(listRecentIssueDates("2026-08-07", 3), [
    "2026-08-07",
    "2026-08-06",
    "2026-08-05",
  ]);
  assert.deepEqual(listRecentIssueDates("2026-05-18", 5), [
    "2026-05-18",
    DAILY_DIGEST_EPOCH,
  ]);
});

test("同一天算多少次都是同一对，换一天才换人", () => {
  const items = [
    makeCase("fresh-a", 1, { sourceHeatScore: 90 }),
    makeCase("fresh-b", 2, { sourceHeatScore: 88 }),
    makeCase("fresh-c", 3, { sourceHeatScore: 86 }),
    makeCase("old-a", 40, { stabilityScore: 95 }),
    makeCase("old-b", 50, { stabilityScore: 92 }),
    makeCase("old-c", 60, { stabilityScore: 90 }),
  ];

  const first = selectDailyDigest(items, "2026-08-07");
  const again = selectDailyDigest([...items].reverse(), "2026-08-07");

  assert.equal(first.fresh.item.slug, again.fresh.item.slug);
  assert.equal(first.review.item.slug, again.review.item.slug);
  assert.equal(first.issueNumber, 83);

  const nextDay = selectDailyDigest(items, "2026-08-08");
  assert.notEqual(nextDay.fresh.item.slug, first.fresh.item.slug);
  assert.notEqual(nextDay.review.item.slug, first.review.item.slug);
});

test("新案例只从来源热度靠前的最近发布里出，且始终是候选池里的高热条目", () => {
  const items = [
    makeCase("hot", 1, { sourceHeatScore: 99 }),
    makeCase("warm", 2, { sourceHeatScore: 70 }),
    makeCase("cold", 3, { sourceHeatScore: 10 }),
    makeCase("veteran", 30, { stabilityScore: 88 }),
  ];

  const picks = new Set(
    ["2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"].map(
      (dateKey) => selectDailyDigest(items, dateKey).fresh.item.slug
    )
  );

  // 轮换只在最近发布的三条里进行，从没发布满 14 天的老案例绝不会占新案例位
  assert.ok(!picks.has("veteran"));
  assert.ok(picks.has("hot"));
});

test("14 天边界：正好满 14 天的案例算复习，差一天的还算新", () => {
  const boundary = makeCase("boundary", DAILY_DIGEST_FRESH_WINDOW_DAYS, {
    sourceHeatScore: 99,
    stabilityScore: 99,
  });
  const justInside = makeCase("just-inside", DAILY_DIGEST_FRESH_WINDOW_DAYS - 1, {
    sourceHeatScore: 1,
    stabilityScore: 99,
  });

  const digest = selectDailyDigest([boundary, justInside], "2026-08-07");
  assert.equal(digest.fresh.item.slug, "just-inside");
  assert.equal(digest.review.item.slug, "boundary");
});

test("催复测票数并列时按稳定分、再按发布时间、最后按 slug 稳定排序", () => {
  const items = [
    makeCase("vote-tie-z", 30, { retestVoteCount: 7, stabilityScore: 80 }),
    makeCase("vote-tie-a", 30, { retestVoteCount: 7, stabilityScore: 80 }),
    makeCase("vote-tie-older", 40, { retestVoteCount: 7, stabilityScore: 80 }),
    makeCase("vote-tie-better", 30, { retestVoteCount: 7, stabilityScore: 91 }),
    makeCase("vote-low", 30, { retestVoteCount: 1, stabilityScore: 100 }),
    makeCase("fresh-one", 1, { sourceHeatScore: 50 }),
  ];

  // 名次固定：票数并列 → 稳定分高的在前 → 同分看发布时间 → 再同看 slug 码位序
  // 复习池正好 5 条，连着 5 天轮换一遍即可把整个名次表读出来
  const order = [
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
    "2026-08-10",
    "2026-08-11",
  ].map((dateKey) => {
    const digest = selectDailyDigest(items, dateKey, { reviewShortlist: 5 });
    return { slug: digest.review.item.slug, rank: digest.review.rank };
  });
  const byRank = new Map(order.map(({ slug, rank }) => [rank, slug]));

  assert.equal(byRank.size, 5);
  assert.equal(byRank.get(1), "vote-tie-better");
  assert.equal(byRank.get(2), "vote-tie-a");
  assert.equal(byRank.get(3), "vote-tie-z");
  assert.equal(byRank.get(4), "vote-tie-older");
  assert.equal(byRank.get(5), "vote-low");

  // 打乱输入顺序不影响名次
  const shuffled = selectDailyDigest([...items].reverse(), "2026-08-07", {
    reviewShortlist: 5,
  });
  assert.equal(
    shuffled.review.item.slug,
    selectDailyDigest(items, "2026-08-07", { reviewShortlist: 5 }).review.item
      .slug
  );
});

test("没有票数时复习榜退化成纯稳定分排序，未复测的 0 分不冒充高分", () => {
  const items = [
    makeCase("measured-high", 30, { stabilityScore: 93 }),
    makeCase("measured-low", 30, { stabilityScore: 61 }),
    makeCase("unmeasured", 30, { stabilityScore: 0 }),
    makeCase("fresh-one", 1, { sourceHeatScore: 50 }),
  ];

  const ranked = ["2026-08-07", "2026-08-08", "2026-08-09"].map((dateKey) => {
    const digest = selectDailyDigest(items, dateKey, { reviewShortlist: 3 });
    return [digest.review.rank, digest.review.item.slug];
  });

  assert.deepEqual(new Map(ranked).get(1), "measured-high");
  assert.deepEqual(new Map(ranked).get(2), "measured-low");
  assert.deepEqual(new Map(ranked).get(3), "unmeasured");
});

test("回放历史期数时，那天还没发布的案例不参与", () => {
  const items = [
    // 2026-08-07 发布，回放 07-31 那期时还不存在
    makeCase("published-later", 0, { sourceHeatScore: 99 }),
    // 2026-07-28 发布，在 07-31 那期是三天新案例
    makeCase("published-earlier", 10, { sourceHeatScore: 40 }),
    makeCase("veteran", 30, { stabilityScore: 88 }),
  ];

  const replay = selectDailyDigest(items, "2026-07-31");
  assert.equal(replay.fresh.item.slug, "published-earlier");

  // 同一份数据算今天这期，最新那条就该回到新案例位
  const today = selectDailyDigest(items, "2026-08-07");
  assert.equal(today.fresh.item.slug, "published-later");
});

test("最近两周没有新发布时退回全库最新几条，并标记 fallback", () => {
  const items = [
    makeCase("old-hot", 20, { sourceHeatScore: 95, stabilityScore: 90 }),
    makeCase("old-cold", 30, { sourceHeatScore: 10, stabilityScore: 88 }),
  ];

  const digest = selectDailyDigest(items, "2026-08-07");
  assert.equal(digest.fresh.fallback, true);
  assert.ok(digest.fresh.item.slug);
  // 兜底挑走的那条不会在复习位重复出现
  assert.notEqual(digest.review?.item.slug, digest.fresh.item.slug);
});

test("发布时间缺失或不可解析的案例不进新案例位", () => {
  const items = [
    { slug: "no-date", createdAt: null, sourceHeatScore: 99, stabilityScore: 90 },
    { slug: "bad-date", createdAt: "not-a-date", sourceHeatScore: 98 },
    makeCase("real-fresh", 2, { sourceHeatScore: 20 }),
  ];

  const digest = selectDailyDigest(items, "2026-08-07");
  assert.equal(digest.fresh.item.slug, "real-fresh");
  assert.ok(["no-date", "bad-date"].includes(digest.review.item.slug));
});

test("空列表不抛错，两个位置都留空", () => {
  const digest = selectDailyDigest([], "2026-08-07");
  assert.equal(digest.fresh, null);
  assert.equal(digest.review, null);
  assert.equal(digest.dateKey, "2026-08-07");
});
