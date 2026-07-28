"use client";

import { useCallback, useEffect, useState } from "react";

export type PromptLanguage = "original" | "zh";

const STORAGE_KEY = "goodcase:prompt-language";
const LANGUAGE_UPDATED_EVENT = "goodcase:prompt-language-updated";

function getStoredLanguage(): PromptLanguage | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "original" || value === "zh" ? value : null;
  } catch {
    return null;
  }
}

export function usePromptLanguage(hasTranslation: boolean) {
  const fallbackLanguage: PromptLanguage = hasTranslation ? "zh" : "original";
  const [language, setLanguageState] =
    useState<PromptLanguage>(fallbackLanguage);

  useEffect(() => {
    const syncLanguage = () => {
      const storedLanguage = getStoredLanguage() || fallbackLanguage;
      setLanguageState(
        storedLanguage === "zh" && !hasTranslation
          ? "original"
          : storedLanguage
      );
    };

    syncLanguage();
    window.addEventListener("storage", syncLanguage);
    window.addEventListener(LANGUAGE_UPDATED_EVENT, syncLanguage);

    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(LANGUAGE_UPDATED_EVENT, syncLanguage);
    };
  }, [fallbackLanguage, hasTranslation]);

  const setLanguage = useCallback(
    (nextLanguage: PromptLanguage) => {
      const resolvedLanguage =
        nextLanguage === "zh" && !hasTranslation ? "original" : nextLanguage;
      setLanguageState(resolvedLanguage);

      try {
        window.localStorage.setItem(STORAGE_KEY, resolvedLanguage);
        window.dispatchEvent(new Event(LANGUAGE_UPDATED_EVENT));
      } catch {
        // localStorage 不可用时仍保留当前页面内的语言切换。
      }
    },
    [hasTranslation]
  );

  return [language, setLanguage] as const;
}
