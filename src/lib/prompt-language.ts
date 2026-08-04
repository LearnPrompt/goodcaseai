"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

export type PromptLanguage = "original" | "zh" | "en";

const STORAGE_KEY_PREFIX = "goodcase:prompt-language";
const LANGUAGE_UPDATED_EVENT = "goodcase:prompt-language-updated";

type PromptPreference = "original" | "localized";

/**
 * 偏好按界面语言分桶存储。
 * 早期版本把偏好压成一个全局键，任何一处点过「原文」就会钉死全站，
 * 切界面语言也压不过它；分桶后中英文各记各的，切语言即进入新桶，
 * 默认重新跟随 preferredLanguage。旧的全局键直接忽略，不做迁移也不清理。
 */
export function getPromptLanguageStorageKey(locale: Locale) {
  return `${STORAGE_KEY_PREFIX}:${locale}`;
}

function getStoredPreference(storageKey: string): PromptPreference | null {
  try {
    const value = window.localStorage.getItem(storageKey);
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
  const locale = useLocale();
  const storageKey = getPromptLanguageStorageKey(locale);
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
      const preference = getStoredPreference(storageKey);
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
  }, [fallbackLanguage, storageKey]);

  const setLanguage = useCallback(
    (nextLanguage: PromptLanguage) => {
      const resolvedLanguage = isAvailable(nextLanguage)
        ? nextLanguage
        : fallbackLanguage;
      setLanguageState(resolvedLanguage);

      try {
        window.localStorage.setItem(
          storageKey,
          resolvedLanguage === "original" ? "original" : "localized"
        );
        window.dispatchEvent(new Event(LANGUAGE_UPDATED_EVENT));
      } catch {
        // localStorage 不可用时仍保留当前页面内的语言切换。
      }
    },
    [fallbackLanguage, isAvailable, storageKey]
  );

  return [language, setLanguage] as const;
}
