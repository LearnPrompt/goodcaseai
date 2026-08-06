/**
 * 复测实验室的排队逻辑。
 *
 * 这个模块是纯函数：进来一批已经算好来源热度的案例 + 催复测票数，出来一份
 * 「这轮该测哪几条」的有序清单。不碰网络、不碰数据库、不碰文件系统，
 * 所以能被单测直接钉住。取数、调模型、落盘都在 run-retest.mjs 里。
 *
 * 排序依据（按优先级从高到低）：
 *   1. 催复测票数降序  —— 用户明确说「这条我怀疑」，这是最强的信号
 *   2. 来源热度降序    —— 没人投票时，先测传播最广的，错得起的人最多
 *   3. slug 字典序     —— 前两项都并列时的确定性兜底，保证同样输入永远同样输出
 *
 * 现实提醒：截至 v1 上线，全站 case_reactions 里只有个位数的 retest_vote，
 * 也就是说第 1 档几乎全是 0，实际起作用的是第 2 档。这不是 bug，是冷启动状态；
 * 票数一旦起来，排序会自动倾斜过去，不需要改代码。
 */

/** v1 只测这两类。video 单次成本太高，先不进队列。 */
export const RETEST_CATEGORIES = ["image", "web"];

/**
 * 低于这个长度的 prompt 不值得复测：不是被截断了就是根本没写 prompt。
 * 挑 40 是看了库里的实际分布——最短的可执行 prompt（一句话生成 threejs 场景）
 * 是 118 字符，40 以下清一色是链接或空串。
 */
export const MIN_EXECUTABLE_PROMPT_LENGTH = 40;

/** youmind 把原文的可变片段换成 `{argument name="…" default="…"}` 模板。 */
const ARGUMENT_WITH_DEFAULT = /\{argument[^}]*default="([^"]*)"[^}]*\}/gi;
const ARGUMENT_WITHOUT_DEFAULT = /\{argument(?![^}]*default=")[^}]*\}/gi;

/** URL 匹配。故意宽松：这里只是为了「把链接抠掉看还剩多少人话」。 */
const URL_PATTERN = /https?:\/\/\S+/gi;

/**
 * 「查看方法」型引导语。这类条目正文只有一句指路的话，真正的 prompt 在站外，
 * 喂给模型等于让它去猜，复测结果没有任何证据价值。
 */
const RESOURCE_POINTER_PATTERN =
  /(查看方法|查看教程|详见原文|见原文|原文链接|完整教程|教程见|链接在|link\s+in\s+bio|see\s+(the\s+)?(original|thread|repo)|full\s+(tutorial|guide)\s+(at|here))/i;

/**
 * 把 `{argument …}` 模板还原成可以直接喂给模型的文本。
 *
 * 和 scripts/supply/lib/prompt-provenance.mjs 里的 normalizeProvenanceText 用的是
 * 同一组正则，但目的相反：那边是为了比对，会把结果压成无空白小写串；
 * 这边是为了执行，必须保留原样的排版和大小写。所以不复用那个函数，只复用规则。
 *
 * 没写 default 的模板没法还原——把占位符原样留着，同时把 name 报出来，
 * 由人在报告里看到「这条需要手工填参数」，而不是让模型对着 `{argument}` 硬猜。
 *
 * @returns {{text: string, restoredDefaults: string[], unresolved: string[]}}
 */
export function restorePromptArguments(promptFull) {
  const source = String(promptFull ?? "");
  const restoredDefaults = [];
  const unresolved = [];

  const text = source
    .replace(ARGUMENT_WITH_DEFAULT, (_match, defaultValue) => {
      restoredDefaults.push(defaultValue);
      return defaultValue;
    })
    .replace(ARGUMENT_WITHOUT_DEFAULT, (match) => {
      const name = /name="([^"]*)"/i.exec(match)?.[1] ?? "";
      unresolved.push(name);
      return match;
    });

  return { text, restoredDefaults, unresolved };
}

/**
 * 判断一条 prompt 是不是「纯资源链接 / 查看方法」型。
 *
 * 判定顺序刻意是：先还原参数 → 再抠掉 URL → 看剩下的实义文本够不够长。
 * 只看「是否包含 URL」会误杀——很多正经 prompt 里带一条参考图链接。
 * 只看长度也会漏——一段 60 字的「完整教程见原文，链接在评论区」有长度没内容。
 */
export function isResourceOnlyPrompt(promptFull) {
  const { text } = restorePromptArguments(promptFull);
  const trimmed = text.trim();

  if (!trimmed) {
    return true;
  }

  const withoutUrls = trimmed.replace(URL_PATTERN, " ").replace(/\s+/g, " ").trim();

  // 抠掉链接后基本什么都不剩 = 这条就是一个链接。
  if (withoutUrls.length < MIN_EXECUTABLE_PROMPT_LENGTH) {
    return true;
  }

  // 有长度但整段都在指路，且没有别的实质内容。
  if (RESOURCE_POINTER_PATTERN.test(withoutUrls) && withoutUrls.length < 120) {
    return true;
  }

  return false;
}

/**
 * 「我给了你一张图」型 prompt。
 *
 * 库里有一批 prompt 的第一句就是 "I have provided an image..." / 「参考这张图」，
 * 原作者当时是带着一张输入图跑的。不把那张图一起喂进去，复测出来的东西和原作
 * 没有可比性——差异全来自缺输入，不是模型退步。识别出来之后，跑的时候把案例
 * 自己的原始媒体当参考图附上去（codex exec -i），报告里也标一句。
 */
const INPUT_IMAGE_PATTERN = new RegExp(
  [
    // 明说「我提供了一张图」
    "i\\s+have\\s+provided\\s+an?\\s+image",
    "provided\\s+image",
    "based\\s+on\\s+(the\\s+)?(attached|provided|this)\\s+(image|photo|picture)",
    "reference\\s+image",
    "uploaded\\s+image",
    // 图生图的动词句式：turn / convert / transform / redraw this photo…
    // real-case-09 就是靠这一条才认出来的——它整段没出现 "provided"，
    // 只说了 "Turn this photo into a funny ugly doodle drawing"。
    "(turn|convert|transform|redraw|restyle|recreate|edit)\\s+(this|the)\\s+(photo|image|picture|drawing|sketch|portrait)",
    "(this|the\\s+attached)\\s+(photo|image|picture)\\s+(into|to)",
    // 中文
    "参考(这张|该|上面这张)?图",
    "基于(这张|上传的)图",
    "把(这张)?(照片|图片|图)",
    "将(这张)?(照片|图片|图)",
    "附图",
    "输入图",
  ].join("|"),
  "i"
);

export function referencesInputImage(promptFull) {
  const { text } = restorePromptArguments(promptFull);
  return INPUT_IMAGE_PATTERN.test(text);
}

/** 票数表：把 case_reactions 的原始行压成 slug → retest_vote 计数。 */
export function countRetestVotes(reactionRows) {
  const counts = new Map();
  for (const row of reactionRows ?? []) {
    if (row?.kind !== "retest_vote") continue;
    const slug = String(row.case_slug ?? "");
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

/** 热度缺失（没有可核验的互动快照）排在所有有热度的条目之后，而不是当 0 分混进去。 */
function heatRank(score) {
  return typeof score === "number" && Number.isFinite(score) ? score : -1;
}

/**
 * 生成这一轮的复测队列。
 *
 * @param {object} options
 * @param {Array} options.cases        已发布案例，需带 slug / category / promptFull / sourceHeatScore
 * @param {Map|object} options.votes   slug → 催复测票数
 * @param {object} [options.limits]    每类取几条，默认 image 5 / web 5
 * @returns {{queue: Array, skipped: Array}}
 */
export function buildRetestQueue({ cases, votes, limits } = {}) {
  const perCategory = { image: 5, web: 5, ...(limits ?? {}) };
  const voteOf = (slug) =>
    (votes instanceof Map ? votes.get(slug) : votes?.[slug]) ?? 0;

  const skipped = [];
  const eligible = [];

  for (const item of cases ?? []) {
    const slug = String(item?.slug ?? "");
    if (!slug) continue;

    if (!RETEST_CATEGORIES.includes(item.category)) {
      skipped.push({ slug, reason: "category-out-of-scope", category: item.category });
      continue;
    }

    if (isResourceOnlyPrompt(item.promptFull)) {
      skipped.push({ slug, reason: "resource-link-prompt", category: item.category });
      continue;
    }

    const restored = restorePromptArguments(item.promptFull);
    eligible.push({
      ...item,
      slug,
      retestVotes: voteOf(slug),
      executablePrompt: restored.text,
      restoredDefaults: restored.restoredDefaults,
      unresolvedArguments: restored.unresolved,
      referencesInputImage: referencesInputImage(item.promptFull),
    });
  }

  eligible.sort(
    (a, b) =>
      b.retestVotes - a.retestVotes ||
      heatRank(b.sourceHeatScore) - heatRank(a.sourceHeatScore) ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  );

  const taken = { image: 0, web: 0 };
  const queue = [];
  for (const item of eligible) {
    const cap = perCategory[item.category] ?? 0;
    if (taken[item.category] >= cap) continue;
    taken[item.category] += 1;
    queue.push(item);
  }

  return { queue, skipped };
}
