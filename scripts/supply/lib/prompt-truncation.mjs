/**
 * 上游 Prompt 截断检测。
 *
 * 背景（2026-08-06 `reviewed-web-video-20260728-v1` 批次复盘）：
 * 该批次 121 条 youmind 来源的 `prompt_full` 长度在 2739–2952 之间密集堆了 14 条，
 * 然后直接跳到 5310，3000–5300 之间一条没有。同批 74 条非 youmind 来源在
 * 2961/2996/3032/3106/3391/3675/… 上分布均匀，说明这堵墙只在 youmind 这条线上。
 *
 * 排查结论：**墙不在我们的代码里**。
 *
 * 1. `adapters/youmind.mjs` 全程没有对 `work.text` 做任何 slice/substring，
 *    库里的值和 youmind 详情页 JSON-LD 的 `text` 逐字节相同（2026-08-06 复抓
 *    `seedance-cola-commercial-video-prompt-7753` 等 4 页逐条比对，完整的 7613 字那条
 *    也一字不差）。
 * 2. youmind 页面上也没有更完整的版本。同一页里 JSON-LD、可见 DOM、Next.js flight
 *    分片（`32:` `39:` `3a:` `45:` `46:` `6e:`）里的 prompt 全是同一个 `Tb98` = 2968 字节，
 *    截在同一个半词上（"…red bottle cap float a"）。换来源抽取救不回来。
 * 3. 真正的判据：把被截的 prompt 拿去和原推正文对齐，**截断点落在原推第 3000 个字符上**。
 *    原推里被剥掉的引导语长度 + 库里 prompt 长度 =
 *    2998 / 2998 / 2999 / 2990 / 3005 / 3000 / 3028 / 2997（差几个字符是空白归一化造成的）。
 *    这个 3000 是相对**原推**的偏移量，而我们的管线只读 youmind 页面、从来拿不到原推正文，
 *    根本没有能力在那个位置下刀。所以截断发生在 youmind 自己的入库环节。
 *
 * 既然改不了上游，这里做的就是**把这类损坏检出来**，别再让它悄悄流进 pending：
 * 可见的 prompt 长度 = 3000 − 被剥掉的引导语，实测引导语 45–143 字符，
 * 所以嫌疑区间取 [2700, 3000]；再叠一道「结尾是不是句末」的判据压误报。
 *
 * 标定（上面那批 55 条人工判定过的样本，全部落在同一批次里）：
 * - 落在区间内被判 `truncated` 的 11 条，命中 10 条（唯一漏网的 case-30f9477f562c
 *   正好截在一个句号上，任何形态学判据都救不了它，只能靠人工比对原推）；
 * - 落在区间内被判 `complete` 的 2 条（case-e53b614b0f42 / case-a9ab0266f96a）
 *   全部没被误报。
 *
 * 这是**告警不是拦截**：结尾没标点的完整 prompt 真实存在（样本里 100/107/1140 字的
 * 三条都是），只是它们不在 3000 附近，所以长度闸门先把它们挡在外面。真要拦，
 * 得像 prompt-provenance 那样有独立的第二道闸门，这里不做。
 *
 * 同类问题的另一处先例见 `web-curated-sources.mjs` 的 `isCompleteV0Prompt()`：
 * v0 公共分享页把 prompt 截在 1000 字符上，那里直接 `>= 990` 就退货。两处处理不同是
 * 因为 v0 的截断不可逆（原始 prompt 只存在于 v0 内部），而 youmind 这批的完整原文
 * 就在原推里躺着，退货等于白扔一条能补全的 case，所以这里只打标签交给人工。
 */

/** youmind 入库时对**原推正文**下刀的字符位置。 */
export const UPSTREAM_PROMPT_CAP = 3000;

/**
 * 原推里那段被剥掉的引导语（「Seedance 2.0 商业广告级 prompt 👇」之类）的长度上限。
 * 实测 45–143 字符，留一倍余量取 300，嫌疑区间因此是 [2700, 3000]。
 */
export const CAP_LEAD_IN_ALLOWANCE = 300;

/**
 * 句末标点。命中就认为这段话是自然收尾的，不算截断嫌疑。
 * 收了中英日三套，外加成对符号的右半边（引号、括号、书名号）。
 */
const SENTENCE_END_PATTERN = /[.。．!！?？…、）)】\]}」』"”'’]$/u;

/** 去掉尾部空白和字面量 `\n`（库里有把换行存成两个字符的脏数据）。 */
function trimTail(value) {
  return String(value ?? "").replace(/(?:\s|\\n|\\t)+$/u, "");
}

/** 这段话是不是在一个句末标点上收尾的。 */
export function endsAtSentenceBoundary(promptText) {
  const trimmed = trimTail(promptText);
  return trimmed !== "" && SENTENCE_END_PATTERN.test(trimmed);
}

/**
 * 单条 prompt 的上游截断判定。
 *
 * @param {string} promptText
 * @param {object} [options]
 * @param {number} [options.cap]          上游下刀位置，默认 {@link UPSTREAM_PROMPT_CAP}
 * @param {number} [options.leadInAllowance] 引导语长度余量，默认 {@link CAP_LEAD_IN_ALLOWANCE}
 * @returns {{suspected: boolean, length: number, nearCap: boolean,
 *            endsAtSentenceBoundary: boolean, reason: string}}
 */
export function detectPromptCapTruncation(
  promptText,
  { cap = UPSTREAM_PROMPT_CAP, leadInAllowance = CAP_LEAD_IN_ALLOWANCE } = {}
) {
  const text = String(promptText ?? "");
  const length = text.length;
  const nearCap = length >= cap - leadInAllowance && length <= cap;
  const clean = endsAtSentenceBoundary(text);

  if (!nearCap) {
    return {
      suspected: false,
      length,
      nearCap,
      endsAtSentenceBoundary: clean,
      reason: "",
    };
  }
  if (clean) {
    return {
      suspected: false,
      length,
      nearCap,
      endsAtSentenceBoundary: clean,
      reason: "",
    };
  }

  return {
    suspected: true,
    length,
    nearCap,
    endsAtSentenceBoundary: clean,
    reason: `prompt 长 ${length} 字符，落在上游 ${cap} 字符截断带内且没有收尾标点，疑似被来源站截断，需人工对照原帖补全。`,
  };
}

/**
 * 判定结果要打在候选上的标签。审核页直接渲染 tags，人眼能看见。
 * 没嫌疑就不打标签——一个 100% 命中的标签不携带信息，只会污染 tags 命名空间
 * （`tags` 还兼着「这条是不是 youmind 来的」这类判据）。
 */
export function truncationTags(check) {
  return check?.suspected ? ["prompt-maybe-truncated"] : [];
}
