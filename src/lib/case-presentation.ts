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

export function getCaseCardPrompt(
  promptPreview?: string | null,
  promptTranslationZh?: string | null
) {
  const original = promptPreview?.trim() || "";
  const resourceUrl = getStandaloneResourceUrl(original);

  if (resourceUrl) {
    return { text: null, resourceUrl };
  }

  const translation = promptTranslationZh?.trim() || "";
  const text = translation || original;

  if (!text || text === MISSING_PROMPT_PREVIEW) {
    return { text: null, resourceUrl: null };
  }

  return { text, resourceUrl: null };
}
