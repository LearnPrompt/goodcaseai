// 每日早报的选择逻辑。
//
// 这个模块被 scripts/review/lib/daily-digest.test.mjs 和 scripts/daily/build-digest.mjs
// 用纯 node 直接加载，所以不能引入任何运行时依赖：带 "@/" 别名的导入在 node 下解析不了，
// 带扩展名的相对导入又会被 Next 的打包链拒绝。同 src/lib/stability.ts 的约束。
//
// 核心约束是「按日期确定性」：同一个日期 + 同一份案例列表，任何人任何时候算出来的
// 都是同一对案例。所有随机性都由日期序号提供，不读 Math.random，也不读 Date.now
// （now 只在调用方传入）。这条约束同时让 RSS 可以回放历史期数。

const DAY_MS = 86_400_000;

/**
 * 早报期数的起算日，也是「第 1 期」。取站点公开的第一天（见 src/lib/changelog.ts
 * 最早的一条）。期数因此读作「站点开张后的第几天」；因为选择逻辑完全确定，
 * 起算日之后的任何一天都能被重新算出来，历史期数不是编的。
 */
export const DAILY_DIGEST_EPOCH = "2026-05-17";

/** 早报按北京时间跨日。用固定偏移而不是 Intl 时区，保证服务端和脚本算出同一天。 */
export const DAILY_DIGEST_OFFSET_MINUTES = 8 * 60;

/** 发布满这么多天的案例归入「今日复习」，不满的留在「今日新案例」。 */
export const DAILY_DIGEST_FRESH_WINDOW_DAYS = 14;

/**
 * 新案例只在「最近发布里来源热度最高的前几名」中选，再按日期在这几名之间轮换。
 * 不轮换的话，没有新发布的日子里早报会连着几天一模一样，每天回来就没有理由了；
 * 名单压到 5 是为了让轮到的那一条仍然是货真价实的高热度新案例。
 */
export const DAILY_DIGEST_FRESH_SHORTLIST = 5;

/** 复习候选同理，池子更大所以名单放宽到 7。 */
export const DAILY_DIGEST_REVIEW_SHORTLIST = 7;

/** RSS 回放的期数。 */
export const DAILY_DIGEST_FEED_ISSUES = 14;

export type DailyDigestCandidate = {
  slug: string;
  /** 站内发布时间。缺失或不可解析的一律不进新案例池。 */
  createdAt?: string | null;
  sourceHeatScore?: number | null;
  stabilityScore?: number | null;
  /** 催复测票数。取不到时按 0 处理，复习榜自动退化成纯稳定分排序。 */
  retestVoteCount?: number | null;
};

/**
 * 一条复测证据。字段名故意和 scripts/retest/retest-manifest.json 里
 * records[] 的字段同名（slug / testedAt / retestVotes），读 manifest 时
 * 不需要额外做字段映射。model / verdict 只用来在早报里说一句
 * 「复测了什么、结果怎样」，不参与选择排序。
 */
export type DailyDigestRetestRecord = {
  slug: string;
  testedAt: string | number | Date;
  retestVotes?: number | null;
  model?: string | null;
  /** 人审结论；脚本产出的记录目前一律是 null（还没人看过），据实展示即可。 */
  verdict?: string | null;
};

export type DailyDigestSlot = "fresh" | "review" | "retest";

export type DailyDigestPick<T extends DailyDigestCandidate> = {
  item: T;
  slot: DailyDigestSlot;
  /** 在本期候选名单里的名次，1 起。 */
  rank: number;
  /** 参与排名的候选总数。 */
  poolSize: number;
  /** 新案例池为空时退回「全库最新几条」，此时为 true。 */
  fallback: boolean;
  /** 仅 slot === "retest" 时存在：这一条是靠哪条复测记录选出来的。 */
  retest?: DailyDigestRetestRecord;
};

export type DailyDigest<T extends DailyDigestCandidate> = {
  /** YYYY-MM-DD，早报时区下的日期。 */
  dateKey: string;
  issueNumber: number;
  fresh: DailyDigestPick<T> | null;
  review: DailyDigestPick<T> | null;
};

function toTimestamp(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const ms =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);

  return Number.isFinite(ms) ? ms : null;
}

/** 把时间戳折算成早报时区下的日序号（1970-01-01 记为 0）。 */
function toDayNumber(
  value: Date | string | number | null | undefined,
  offsetMinutes = DAILY_DIGEST_OFFSET_MINUTES
) {
  const ms = toTimestamp(value);
  return ms === null ? null : Math.floor((ms + offsetMinutes * 60_000) / DAY_MS);
}

function dayNumberToDateKey(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dateKeyToDayNumber(dateKey: string) {
  const ms = Date.parse(`${dateKey}T00:00:00.000Z`);
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : null;
}

/** 当前时刻属于哪一期（YYYY-MM-DD）。now 必须由调用方传入，方便测试和回放。 */
export function getDigestDateKey(
  now: Date | string | number,
  offsetMinutes = DAILY_DIGEST_OFFSET_MINUTES
) {
  const day = toDayNumber(now, offsetMinutes);
  return day === null ? null : dayNumberToDateKey(day);
}

/** 第几期。起算日当天是第 1 期。 */
export function getIssueNumber(dateKey: string) {
  const day = dateKeyToDayNumber(dateKey);
  const epoch = dateKeyToDayNumber(DAILY_DIGEST_EPOCH);
  if (day === null || epoch === null) {
    return null;
  }

  return day - epoch + 1;
}

/** 从 dateKey 往前数 count 期，含 dateKey 本身，由新到旧。 */
export function listRecentIssueDates(
  dateKey: string,
  count = DAILY_DIGEST_FEED_ISSUES
) {
  const day = dateKeyToDayNumber(dateKey);
  const epoch = dateKeyToDayNumber(DAILY_DIGEST_EPOCH);
  if (day === null || epoch === null) {
    return [];
  }

  const dates: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const current = day - offset;
    if (current < epoch) {
      break;
    }
    dates.push(dayNumberToDateKey(current));
  }

  return dates;
}

function toScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function toVotes(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * 稳定分口径与 src/lib/stability.ts 的 hasMeasuredStability 一致：
 * 0 表示「还没复测过」，不是「稳定度为 0」，不能拿去和真实分数比大小。
 */
function toStability(value: number | null | undefined) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100
    ? value
    : -1;
}

/** 最后一道并列裁决用 slug 的码位序，不用 localeCompare——后者依赖 ICU，跨环境不稳。 */
function compareSlug(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

type Aged<T extends DailyDigestCandidate> = { item: T; day: number | null };

function withAge<T extends DailyDigestCandidate>(
  items: readonly T[],
  offsetMinutes: number
): Array<Aged<T>> {
  return items.map((item) => ({
    item,
    day: toDayNumber(item.createdAt, offsetMinutes),
  }));
}

function compareFresh<T extends DailyDigestCandidate>(
  a: Aged<T>,
  b: Aged<T>
) {
  return (
    toScore(b.item.sourceHeatScore) - toScore(a.item.sourceHeatScore) ||
    (b.day ?? -Infinity) - (a.day ?? -Infinity) ||
    compareSlug(a.item.slug, b.item.slug)
  );
}

function compareReview<T extends DailyDigestCandidate>(
  a: Aged<T>,
  b: Aged<T>
) {
  return (
    toVotes(b.item.retestVoteCount) - toVotes(a.item.retestVoteCount) ||
    toStability(b.item.stabilityScore) - toStability(a.item.stabilityScore) ||
    (b.day ?? -Infinity) - (a.day ?? -Infinity) ||
    compareSlug(a.item.slug, b.item.slug)
  );
}

/** 日期决定在名单里取第几个。名单长度会随发布情况变，但给定日期结果唯一。 */
function rotate<T>(list: readonly T[], day: number) {
  if (list.length === 0) {
    return null;
  }

  const index = ((day % list.length) + list.length) % list.length;
  return { value: list[index], index };
}

function pickFrom<T extends DailyDigestCandidate>(
  ranked: Array<Aged<T>>,
  shortlistSize: number,
  day: number,
  slot: DailyDigestSlot,
  fallback: boolean
): DailyDigestPick<T> | null {
  const shortlist = ranked.slice(0, shortlistSize);
  const picked = rotate(shortlist, day);
  if (!picked) {
    return null;
  }

  return {
    item: picked.value.item,
    slot,
    rank: picked.index + 1,
    poolSize: ranked.length,
    fallback,
  };
}

/**
 * 复测记录按「哪一天测的」分组，取最新那一天；同一天有多条时按催复测票数
 * 高的优先，再按测试时刻新的优先，最后按 slug 兜底，保证结果唯一确定。
 *
 * day 参数是这一期早报所在的日序号：测试时刻晚于这一期的记录不参与
 * （避免用未来数据回放历史期数，虽然目前调用方只在算「今天」这期时才传
 * retestRecords，这里的过滤是防御性的，不是当前唯一防线）。
 */
function pickLatestRetestRecord(
  records: readonly DailyDigestRetestRecord[],
  day: number,
  offsetMinutes: number
): DailyDigestRetestRecord | null {
  const withDay = records
    .map((record) => ({
      record,
      day: toDayNumber(record.testedAt, offsetMinutes),
    }))
    .filter(
      (entry): entry is { record: DailyDigestRetestRecord; day: number } =>
        entry.day !== null && entry.day <= day
    );

  if (withDay.length === 0) {
    return null;
  }

  const latestDay = Math.max(...withDay.map((entry) => entry.day));
  const sameDay = withDay.filter((entry) => entry.day === latestDay);

  sameDay.sort(
    (a, b) =>
      toVotes(b.record.retestVotes) - toVotes(a.record.retestVotes) ||
      (toTimestamp(b.record.testedAt) ?? -Infinity) -
        (toTimestamp(a.record.testedAt) ?? -Infinity) ||
      compareSlug(a.record.slug, b.record.slug)
  );

  return sameDay[0].record;
}

/**
 * 选出某一期早报的两条案例。
 *
 * - 今日新案例：发布不满 14 天的案例里，来源热度最高的前几名，按日期轮换取一条。
 *   这一档没有候选时（比如两周没发新案例）退回「全库最新几条」，并标记 fallback。
 * - 今日新复测：传了 retestRecords 时，取其中「测试时刻最新的一天」里票数最高
 *   的一条，映射回对应案例；案例不在这一期可见范围（比如已下架）或
 *   retestRecords 为空/没有任何一条能匹配到案例时，退回旧的「今日复习」逻辑——
 *   发布满 14 天的案例里，先看催复测票数，再看稳定分，同样按日期轮换。
 *
 * 新案例池和「今日复习」兜底池按 14 天严格互斥；复测命中的那条不受 14 天限制
 * （复测本来就是冲着「发布过一阵子的案例还立不立得住」去的，不该被新案例窗口卡住）。
 * 两个槽位最终不会展示同一条案例：撞车时复测/复习槽位让位，宁可留空。
 */
export function selectDailyDigest<T extends DailyDigestCandidate>(
  items: readonly T[],
  dateKey: string,
  options: {
    freshWindowDays?: number;
    freshShortlist?: number;
    reviewShortlist?: number;
    offsetMinutes?: number;
    /** 复测证据源：page.tsx 和 build-digest.mjs 都从 retest-manifest.json 读出后传入。 */
    retestRecords?: readonly DailyDigestRetestRecord[];
  } = {}
): DailyDigest<T> {
  const {
    freshWindowDays = DAILY_DIGEST_FRESH_WINDOW_DAYS,
    freshShortlist = DAILY_DIGEST_FRESH_SHORTLIST,
    reviewShortlist = DAILY_DIGEST_REVIEW_SHORTLIST,
    offsetMinutes = DAILY_DIGEST_OFFSET_MINUTES,
    retestRecords = [],
  } = options;

  const day = dateKeyToDayNumber(dateKey);
  const issueNumber = getIssueNumber(dateKey);
  if (day === null) {
    return { dateKey, issueNumber: 0, fresh: null, review: null };
  }

  const aged = withAge(items, offsetMinutes);

  // 期数当天之后才发布的案例不参与这一期，历史期数才能正确回放。
  const visible = aged.filter(({ day: created }) =>
    created === null ? true : created <= day
  );

  const freshPool = visible
    .filter(
      ({ day: created }) =>
        created !== null && day - created < freshWindowDays
    )
    .sort(compareFresh);

  const reviewPool = visible
    .filter(
      ({ day: created }) =>
        created === null || day - created >= freshWindowDays
    )
    .sort(compareReview);

  const fresh =
    freshPool.length > 0
      ? pickFrom(freshPool, freshShortlist, day, "fresh", false)
      : pickFrom(
          [...visible].sort(compareFresh),
          freshShortlist,
          day,
          "fresh",
          true
        );

  const latestRetest = pickLatestRetestRecord(retestRecords, day, offsetMinutes);
  const retestMatch = latestRetest
    ? visible.find(({ item }) => item.slug === latestRetest.slug)
    : undefined;
  const retestSameDay = latestRetest
    ? retestRecords.filter(
        (record) =>
          toDayNumber(record.testedAt, offsetMinutes) ===
          toDayNumber(latestRetest.testedAt, offsetMinutes)
      ).length
    : 0;

  const review = retestMatch
    ? {
        item: retestMatch.item,
        slot: "retest" as const,
        rank: 1,
        poolSize: retestSameDay,
        fallback: false,
        retest: latestRetest ?? undefined,
      }
    : pickFrom(reviewPool, reviewShortlist, day, "review", false);

  return {
    dateKey,
    issueNumber: issueNumber ?? 0,
    // 池子退化到只剩一条时两个位置可能撞上；宁可留空也不重复展示同一条。
    fresh,
    review: review && review.item.slug === fresh?.item.slug ? null : review,
  };
}
