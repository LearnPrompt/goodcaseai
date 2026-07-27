import type { CaseCategory } from "@/lib/mock-data";

export const MISSING_PROMPT_PREVIEW = "该案例暂未提供 Prompt 预览。";

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
