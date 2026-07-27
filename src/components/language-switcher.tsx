"use client";

import { useLocale, useMessages } from "@/i18n/client";
import { persistLocale } from "@/i18n/browser";
import {
  localizeHref,
  type Locale,
} from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const messages = useMessages();

  const switchLanguage = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return;
    }

    persistLocale(nextLocale);
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(localizeHref(nextLocale, currentHref));
  };

  return (
    <div
      aria-label={messages.language.label}
      className="flex min-h-11 shrink-0 border border-[var(--hair)] bg-white font-mono text-[10px] uppercase tracking-[0.08em]"
    >
      {[
        ["zh-CN", messages.language.chinese, messages.language.switchToChinese],
        ["en", messages.language.english, messages.language.switchToEnglish],
      ].map(([value, label, ariaLabel]) => (
        <button
          key={value}
          type="button"
          aria-label={ariaLabel}
          aria-pressed={locale === value}
          onClick={() => switchLanguage(value as Locale)}
          className={`border-r border-[var(--hair)] px-3 last:border-r-0 ${
            locale === value
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "text-[var(--muted)] transition hover:bg-[var(--paper-2)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
