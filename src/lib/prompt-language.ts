"use client";

import { useCallback, useEffect, useState } from "react";

export type PromptLanguage = "original" | "zh" | "en";

const STORAGE_KEY = "goodcase:prompt-language";
const LANGUAGE_UPDATED_EVENT = "goodcase:prompt-language-updated";

type PromptPreference = "original" | "localized";

function getStoredPreference(): PromptPreference | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "original") return "original";
    if (value === "localized" || value === "zh" || value === "en") {
      return "localized";
    }
    return null;
  } catch {
    return null;
  }
}

export function usePromptLanguage(
  hasTranslationZh: boolean,
  hasTranslationEn: boolean,
  preferredLanguage: PromptLanguage = "original"
) {
  const isAvailable = useCallback(
    (language: PromptLanguage) =>
      language === "original" ||
      (language === "zh" && hasTranslationZh) ||
      (language === "en" && hasTranslationEn),
    [hasTranslationEn, hasTranslationZh]
  );
  const fallbackLanguage: PromptLanguage = isAvailable(preferredLanguage)
    ? preferredLanguage
    : "original";
  const [language, setLanguageState] =
    useState<PromptLanguage>(fallbackLanguage);

  useEffect(() => {
    const syncLanguage = () => {
      const preference = getStoredPreference();
      setLanguageState(
        preference === "original" ? "original" : fallbackLanguage
      );
    };

    syncLanguage();
    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_UPDATED_EVENT, syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_UPDATED_EVENT, syncLanguage);
    };
  }, [fallbackLanguage, isAvailable]);

  const setLanguage = useCallback(
    (nextLanguage: PromptLanguage) => {
      const resolvedLanguage = isAvailable(nextLanguage)
        ? nextLanguage
        : fallbackLanguage;
      setLanguageState(resolvedLanguage);

      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          resolvedLanguage === "original" ? "original" : "localized"
        );
        window.dispatchEvent(new Event(LANGUAGE_UPDATED_EVENT));
      } catch {
        // localStorage 不可用时仍保留当前页面内的语言切换。
      }
    },
    [fallbackLanguage, isAvailable]
  );

  return [language, setLanguage] as const;
}
