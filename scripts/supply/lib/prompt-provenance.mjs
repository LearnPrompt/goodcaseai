/**
 * Prompt 溯源校验。
 *
 * 背景（2026-08-05 溯源审计）：youmind 的 image 类 prompt 有相当比例不是作者原文，
 * 而是 youmind 自己拿产出图逆向重构出来的。它照样把 `isBasedOn` 指向原推，所以
 * 从我们这边看是「出处链接有效、prompt 是编的」——链接检查完全挡不住。
 *
 * 这里提供两道独立的闸门：
 *
 * 1. **锚点闸门**（零成本、判别力接近完美）。youmind 会在 `isBasedOn` 末尾挂一个
 *    `#reversed-N` 锚点，字面意思就是「这段 prompt 是 reverse-engineered 出来的」。
 *    审计里带锚点的 6 条全部对不上、不带锚点的 30 条全部对得上。
 *    这个锚点以前被 `stripSourceFragment()` 在入库前抹掉了，等于把唯一的自动信号销毁。
 *
 * 2. **正文比对闸门**（需要抓原帖，成本高但不依赖 youmind 的自曝）。把候选 prompt
 *    切成定长窗口，逐窗在原帖正文里找逐字命中，算命中率。真出自原帖的 prompt 命中率
 *    很高（审计 24 条样本里最低 0.50），逆向重构出来的一个窗口都命中不了（全部 0.00）。
 *
 * 阈值标定见 `prompt-provenance.test.mjs` 顶部注释与审计报告。
 */

/** `#reversed-N` / `#reversed`：youmind 标记「这段 prompt 是逆向重构的」。 */
export const REVERSED_ANCHOR_PATTERN = /^reversed(?:-\d+)?$/i;

/**
 * 窗口命中率阈值。24 条人工核对样本上的实际分布：
 * 「对不上」5 条全部是 0.00，「一致」11 条最低 0.68，「部分一致」8 条最低 0.50。
 * 0 和 0.50 之间是空的，取 0.5 落在安全带里，同时把命中率本身留给人工当分级参考。
 */
export const PROMPT_MATCH_THRESHOLD = 0.5;

/** 比对窗口长度（归一化后的字符数）。 */
export const PROMPT_MATCH_WINDOW = 40;

/** 最多比对多少个窗口，避免超长 prompt 把比对拖成 O(n²)。 */
export const PROMPT_MATCH_MAX_WINDOWS = 20;

/**
 * 原帖里的 prompt 引导词。只当辅助信号用，不做判据：
 * 审计里 5 条「对不上」中有 1 条原帖是带引导词的，单靠它会漏。
 */
const PROMPT_CUE_PATTERN =
  /(prompts?\s*[:：]|prompts?\s*👇|提示词|提示語|プロンプト|프롬프트|完整\s*prompt)/i;

/** youmind 把原文里的可变部分替换成 `{argument name="…" default="…"}` 模板。 */
const ARGUMENT_WITH_DEFAULT = /\{argument[^}]*default="([^"]*)"[^}]*\}/gi;
const ARGUMENT_ANY = /\{argument[^}]*\}/gi;

const PUNCTUATION_MAP = new Map([
  ["：", ":"],
  ["，", ","],
  ["。", "."],
  ["、", ","],
  ["（", "("],
  ["）", ")"],
  ["“", '"'],
  ["”", '"'],
  ["‘", "'"],
  ["’", "'"],
  ["！", "!"],
  ["？", "?"],
  ["；", ";"],
  ["—", "-"],
  ["–", "-"],
]);

/**
 * 归一化：先把 `{argument …}` 模板还原成 default 值，再去掉全部空白、统一大小写和
 * 全角标点。原帖正文是从渲染后的页面抓下来的，换行和空格跟 JSON-LD 里的原文对不齐，
 * 不去空白就几乎不可能逐字命中。
 */
export function normalizeProvenanceText(value) {
  return String(value ?? "")
    .replace(ARGUMENT_WITH_DEFAULT, "$1")
    .replace(ARGUMENT_ANY, "")
    .toLowerCase()
    .replace(/[：，。、（）“”‘’！？；—–]/g, (char) => PUNCTUATION_MAP.get(char) ?? char)
    .replace(/\s+/g, "");
}

/** 取 URL 的 fragment（不含 `#`）。取不到或 URL 非法时返回 ""。 */
export function extractUrlFragment(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).hash.replace(/^#/, "");
  } catch {
    const index = raw.indexOf("#");
    return index >= 0 ? raw.slice(index + 1) : "";
  }
}

/** 去掉 fragment 的 URL，用于展示和去重。 */
export function stripUrlFragment(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    const index = raw.indexOf("#");
    return index >= 0 ? raw.slice(0, index) : raw;
  }
}

/** fragment 是不是 youmind 的「逆向重构」标记。 */
export function isReversedAnchor(fragment) {
  return REVERSED_ANCHOR_PATTERN.test(String(fragment ?? "").trim());
}

/** 原帖正文里有没有 prompt 引导词。辅助信号，不单独作判据。 */
export function hasPromptCue(sourceText) {
  return PROMPT_CUE_PATTERN.test(String(sourceText ?? ""));
}

/**
 * 把 prompt 切成定长窗口，统计有多少窗口能在原帖正文里逐字找到。
 *
 * 用窗口而不是「前 N 字符」是因为 youmind 会把原文里的可变片段换成自己的 default 值
 * （比如原推写「成人女性」，youmind 模板 default 写「20代女性」），这种替换只会打断
 * 一两个窗口，用前缀比对会被它一票否决，实测就有一条「一致」的样本被误判。
 */
export function promptMatchRatio(
  promptText,
  sourceText,
  { windowSize = PROMPT_MATCH_WINDOW, maxWindows = PROMPT_MATCH_MAX_WINDOWS } = {}
) {
  const prompt = normalizeProvenanceText(promptText);
  const source = normalizeProvenanceText(sourceText);

  if (!prompt || !source) {
    return { ratio: null, windows: 0, hits: 0 };
  }

  const windows = [];
  for (let index = 0; index + windowSize <= prompt.length; index += windowSize) {
    windows.push(prompt.slice(index, index + windowSize));
    if (windows.length >= maxWindows) {
      break;
    }
  }

  // 短 prompt 拼不出一个完整窗口时，整段直接比对，别当成「无法判断」放过去。
  if (windows.length === 0) {
    const hit = source.includes(prompt);
    return { ratio: hit ? 1 : 0, windows: 1, hits: hit ? 1 : 0 };
  }

  const hits = windows.filter((window) => source.includes(window)).length;
  return { ratio: hits / windows.length, windows: windows.length, hits };
}

/**
 * 单条候选的溯源判定。
 *
 * @param {object} input
 * @param {string} input.promptText   候选 prompt 正文
 * @param {string} [input.sourceUrl]  原始出处 URL（可带 `#reversed-N`）
 * @param {string} [input.anchor]     已经单独取出来的 fragment（优先于 sourceUrl）
 * @param {string} [input.sourceText] 原帖正文；抓不到就留空
 * @returns {{status: string, blocked: boolean, anchor: string, reversed: boolean,
 *            matchRatio: number|null, matchedWindows: number, totalWindows: number,
 *            hasPromptCue: boolean, reason: string}}
 */
export function checkPromptProvenance({
  promptText,
  sourceUrl,
  anchor,
  sourceText,
} = {}) {
  const fragment = String(
    anchor ?? extractUrlFragment(sourceUrl) ?? ""
  ).trim();
  const reversed = isReversedAnchor(fragment);
  const { ratio, windows, hits } = promptMatchRatio(promptText, sourceText);
  const cue = hasPromptCue(sourceText);

  const base = {
    anchor: fragment,
    reversed,
    matchRatio: ratio,
    matchedWindows: hits,
    totalWindows: windows,
    hasPromptCue: cue,
  };

  if (reversed) {
    return {
      ...base,
      status: "reversed-anchor",
      blocked: true,
      reason: `来源 URL 带 #${fragment} 锚点，youmind 自己标记这段 prompt 是逆向重构的，不是作者原文。`,
    };
  }

  if (ratio === null) {
    return {
      ...base,
      status: "unchecked",
      blocked: false,
      reason: "没有原帖正文可比对，溯源未经核实。",
    };
  }

  if (ratio < PROMPT_MATCH_THRESHOLD) {
    return {
      ...base,
      status: "prompt-not-in-source",
      blocked: true,
      reason: `prompt 在原帖正文里的窗口命中率只有 ${ratio.toFixed(2)}（${hits}/${windows}，阈值 ${PROMPT_MATCH_THRESHOLD}）${
        cue ? "" : "，且原帖没有 prompt 引导词"
      }。`,
    };
  }

  return {
    ...base,
    status: "verified",
    blocked: false,
    reason: `prompt 窗口命中率 ${ratio.toFixed(2)}（${hits}/${windows}），出自原帖。`,
  };
}

/**
 * 拿到判定结果后要打在候选上的标签。审核页直接渲染 tags，
 * 所以哪怕库里还没加 provenance 字段，这些标记也是人眼可见的。
 *
 * `unchecked` 故意不打标签：影子跑不抓原帖正文，所有候选都会是 unchecked，
 * 一个 100% 命中的标签不携带任何信息，只会把 tags 命名空间搞脏
 * （`tags` 还兼着「这条是不是 youmind 来的」这类判据）。未核实这件事
 * 由报告里的 provenance.status 和 stats 承载。
 */
export function provenanceTags(check) {
  if (check?.status === "reversed-anchor") {
    return ["provenance-reversed", "provenance-blocked"];
  }
  if (check?.status === "prompt-not-in-source") {
    return ["provenance-mismatch", "provenance-blocked"];
  }
  return [];
}
