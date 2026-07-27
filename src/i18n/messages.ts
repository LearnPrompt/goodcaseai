import type { Locale } from "@/i18n/config";

export const zhCNMessages = {
  site: {
    description: "中文 AI Case 证据库：看真实作品、作者、方法、原始来源与复测证据。",
    tagline: "中文 AI Case 证据库",
    footerBrand: "GoodCase.ai · 中文 AI Case 证据库",
  },
  nav: {
    ariaLabel: "主导航",
    cases: "案例",
    creators: "创作者",
    favorites: "收藏",
    submit: "投稿",
    changelog: "更新日志",
    feedback: "反馈",
    connect: "Agent 接入",
  },
  language: {
    label: "界面语言",
    chinese: "中文",
    english: "EN",
    switchToChinese: "切换到中文",
    switchToEnglish: "Switch to English",
  },
} as const;

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? WidenStrings<T[K]>
      : T[K];
};

export type Messages = WidenStrings<typeof zhCNMessages>;

export const enMessages = {
  site: {
    description:
      "A public evidence library for real AI work, creators, methods, original sources, and reproducibility.",
    tagline: "AI Case Evidence Library",
    footerBrand: "GoodCase.ai · AI Case Evidence Library",
  },
  nav: {
    ariaLabel: "Primary navigation",
    cases: "Cases",
    creators: "Creators",
    favorites: "Favorites",
    submit: "Submit",
    changelog: "Changelog",
    feedback: "Feedback",
    connect: "Agent Access",
  },
  language: {
    label: "Interface language",
    chinese: "中文",
    english: "EN",
    switchToChinese: "切换到中文",
    switchToEnglish: "Switch to English",
  },
} satisfies Messages;

export function getMessages(locale: Locale): Messages {
  return locale === "en" ? enMessages : zhCNMessages;
}
