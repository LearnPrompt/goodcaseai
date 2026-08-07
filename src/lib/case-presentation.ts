import type { Locale } from "@/i18n/config";
import type { CaseCategory } from "@/lib/mock-data";

export const MISSING_PROMPT_PREVIEW = "该案例暂未提供 Prompt 预览。";
const GENERIC_CASE_SUMMARY_MARKER =
  "适合观察 Prompt 结构、素材组织和可复用的创作模式。";

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程(UI)",
  copy: "AI 文案",
  hardware: "AI 硬件",
};

export function formatPublishedDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * 案例时效性：AI 模型更新很快，卡片/详情页需要来源发布日期。为空时不显示占位符。
 * 日期格式跟随 locale；不复用 formatPublishedDate（那个固定输出 ISO 日期，
 * 不区分语言）。原来只在 case-card.tsx 里定义，creator / skill 的「作者侧时间」
 * 展示也要用同一套格式，所以挪到这个中立模块，两边都能 import。
 */
export function formatCardPublishedDate(
  value: string | null | undefined,
  locale: Locale
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

/**
 * creator / skill 的「作者侧时间」——只展示作者的时间，绝不展示我们的编辑时间。
 * 作者时间是关于生态的事实（这个创作者还活跃吗、这套方法还流行吗）；
 * 编辑时间（createdAt 在库里代表的其实是「我们收录时间」）不参与判断，
 * 只在 sourcePublishedAt 缺失时才退它当占位，保证仍能排出一个先后顺序。
 *
 * 输入一批案例，取 sourcePublishedAt ?? createdAt 里最新的一条，格式化成
 * 站内既有的 YYYY/MM/DD 绝对日期 chip 风格；一条可用日期都没有时返回 null，
 * 调用方应该整行不渲染，不留占位空行。
 */
export function pickLatestAuthorDate(
  items: Array<{ sourcePublishedAt?: string; createdAt?: string }>,
  locale: Locale
): string | null {
  let latestRaw: string | null = null;
  let latestTime = -Infinity;

  for (const item of items) {
    const raw = item.sourcePublishedAt || item.createdAt;
    if (!raw) {
      continue;
    }

    const time = new Date(raw).getTime();
    if (Number.isNaN(time) || time <= latestTime) {
      continue;
    }

    latestRaw = raw;
    latestTime = time;
  }

  return latestRaw ? formatCardPublishedDate(latestRaw, locale) : null;
}

export function getCaseCardSummary(value: string) {
  const summary = value.trim();
  if (
    !summary ||
    (summary.startsWith("来自 ") &&
      summary.includes(GENERIC_CASE_SUMMARY_MARKER))
  ) {
    return null;
  }

  return summary;
}

/** 取第一句作为兜底推荐理由，过长时截断，避免把整段方法塞进渲染点。 */
function firstSentence(text?: string) {
  const normalized = (text || "").trim();
  if (!normalized) return null;
  const [first] = normalized.split(/(?<=[。！？])/);
  const picked = (first || normalized).trim();
  return picked.length > 90 ? `${picked.slice(0, 89)}…` : picked;
}

/**
 * 案例摘要展示前统一过滤 + 兜底，所有对外渲染点（列表卡片、创作者卡片、详情页、
 * 首页、RSS）都应该走这一个函数，不要各自裸取 `item.summary`。
 *
 * 1. 自动生成的套话摘要（「来自 X 的真实…适合观察 Prompt 结构…」）被
 *    `getCaseCardSummary` 判为无效，不展示原文；
 * 2. 退而求其次，用三段式复用方法（`promptContributionNotes`）的第一句顶上；
 * 3. 两者都没有时返回 null——调用方按各自布局决定怎么处理空值（通常是不渲染
 *    对应的段落，而不是渲染一个空 `<p>`）。
 */
export function getPresentableCaseSummary(
  summary: string,
  promptContributionNotes?: string[]
): string | null {
  return (
    getCaseCardSummary(summary) || firstSentence(promptContributionNotes?.[0])
  );
}

function getStandaloneResourceUrl(value: string) {
  const markdownLink = value.match(
    /^\[\s*(https?:\/\/[^\]\s]+)\s*\]\(\s*(https?:\/\/[^\)\s]+)\s*\)$/i
  );
  const candidate =
    markdownLink?.[2] ||
    value.match(/^<\s*(https?:\/\/[^>\s]+)\s*>$/i)?.[1] ||
    value.match(/^(https?:\/\/\S+)$/i)?.[1];

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * 列表卡片（compact）里提示语的可见长度上限。
 *
 * 依据：`case-card-prompt.tsx` 的 compact 提示框是
 * `min-h-[104px] px-4 py-3`，文字段是
 * `font-mono text-[11px] leading-5 line-clamp-2`——只露 2 行，104px 高度里
 * 剩下的空间是留给上面的「PROMPT」标签行和间距的，不会多显示第 3 行。
 *
 * 实测方法：在真实渲染的 /cases 页面上找到这个 `<p>`，往里灌不同长度的填充
 * 文本，用二分法找 `scrollHeight <= clientHeight` 成立的最大字符数（即 2 行
 * 内不触发裁切的临界点）。测了三档窗口宽度（卡片会跟着断点变宽变窄）：
 *
 *   窗口宽度   卡片布局        提示框内容宽度   中文上限   英文上限
 *   320px      单栏（旧机型）   239px           36 字      63 字
 *   360px      单栏（常见安卓） 279px           44 字      75 字
 *   375px      单栏（iPhone）   294px           46 字      77 字
 *   1280px     三栏（桌面）     328px           58 字      100 字
 *
 * 桌面三栏反而比手机单栏更宽（1440px 容器分 3 份还是比手机整屏宽），所以
 * 手机单栏才是最窄的常见场景。以 360px（比 375px 更紧、又比 320px 旧机型
 * 更有代表性）测到的上限定阈值，字符预算已经含省略号本身，取 44 / 75。
 * 按这个上限截，桌面上不会被 CSS 二次裁切（框更宽，顶多第二行没填满，
 * 不算裁切出问题）；手机上也不会因为超出而被 CSS 强行砍断。
 */
export const CARD_PROMPT_ZH_CHAR_LIMIT = 44;
export const CARD_PROMPT_EN_CHAR_LIMIT = 75;
const CARD_PROMPT_ELLIPSIS = "…";

const CJK_PATTERN = /[㐀-鿿豈-﫿＀-￯]/g;

function isPrimarilyCjk(text: string) {
  const cjkCount = text.match(CJK_PATTERN)?.length ?? 0;
  return cjkCount / text.length > 0.4;
}

/**
 * 把提示语截到列表卡片实际可见的长度，阈值依据见上面的注释。
 * 中文按字符预算截断（每个汉字本身就是语义单元）；但不少 Prompt 里混着
 * `{argument name="..." default="..."}` 这类英文模板片段，所以不管整段
 * 判定成中文还是英文，只要截断点附近有空格，都尽量退到最近的空格处收尾，
 * 避免把一个英文单词或模板片段从中间砍断。
 */
export function truncateCardPrompt(text: string) {
  const limit = isPrimarilyCjk(text)
    ? CARD_PROMPT_ZH_CHAR_LIMIT
    : CARD_PROMPT_EN_CHAR_LIMIT;

  if (text.length <= limit) {
    return text;
  }

  const sliceLength = Math.max(0, limit - CARD_PROMPT_ELLIPSIS.length);
  let truncated = text.slice(0, sliceLength);

  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > sliceLength * 0.6) {
    truncated = truncated.slice(0, lastSpace);
  }

  return `${truncated.trimEnd()}${CARD_PROMPT_ELLIPSIS}`;
}

export function getCaseCardPrompt(
  promptValue?: string | null,
  /** 只有列表卡片（compact）需要截断；详情页要看完整提示语，不能传 true。 */
  compact = false
) {
  const prompt = promptValue?.trim() || "";
  const resourceUrl = getStandaloneResourceUrl(prompt);

  if (resourceUrl) {
    return { text: null, resourceUrl };
  }

  if (!prompt || prompt === MISSING_PROMPT_PREVIEW) {
    return { text: null, resourceUrl: null };
  }

  return {
    text: compact ? truncateCardPrompt(prompt) : prompt,
    resourceUrl: null,
  };
}
