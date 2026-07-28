"use client";

import { getCaseCardPrompt } from "@/lib/case-presentation";
import {
  type PromptLanguage,
  usePromptLanguage,
} from "@/lib/prompt-language";

export function CaseCardPrompt({
  promptPreview,
  promptTranslationZh,
}: {
  promptPreview?: string | null;
  promptTranslationZh?: string | null;
}) {
  const hasTranslation = Boolean(promptTranslationZh?.trim());
  const [language, setLanguage] = usePromptLanguage(hasTranslation);
  const prompt = getCaseCardPrompt(
    promptPreview,
    language === "zh" ? promptTranslationZh : null
  );

  if (!prompt.text && !prompt.resourceUrl) {
    return null;
  }

  if (prompt.resourceUrl) {
    return (
      <div className="mt-5 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--orange)]">
          方法 / Code
        </p>
        <a
          href={prompt.resourceUrl}
          target="_blank"
          rel="noreferrer"
          className="gc-action mt-3 inline-flex"
        >
          查看方法 / View code ↗
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--orange)]">
          提示语 / Prompt
        </p>
        {hasTranslation ? (
          <div className="flex border border-[var(--hair)] bg-white">
            {[
              ["zh", "中文"],
              ["original", "EN"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={language === value}
                onClick={() => setLanguage(value as PromptLanguage)}
                className={`min-h-7 border-r border-[var(--hair)] px-2 font-mono text-[9px] last:border-r-0 ${
                  language === value
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--muted)] hover:bg-[var(--paper)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-3 font-mono text-[11px] leading-5 text-[var(--ink)]">
        {prompt.text}
      </p>
    </div>
  );
}
