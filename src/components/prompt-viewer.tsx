"use client";

import { useEffect, useRef, useState } from "react";
import {
  type PromptLanguage,
  usePromptLanguage,
} from "@/lib/prompt-language";

export function PromptViewer({
  original,
  translationZh,
}: {
  original: string;
  translationZh?: string;
}) {
  const [language, setLanguage] = usePromptLanguage(Boolean(translationZh));
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prompt = language === "zh" && translationZh ? translationZh : original;

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
      resetTimer.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="gc-eyebrow">Prompt · 中英双语</p>
        <div className="flex items-center">
          {translationZh ? (
            <div className="flex border border-r-0 border-[var(--hair)] bg-white">
              {[
                ["original", "英文原文"],
                ["zh", "中文翻译"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={language === value}
                  onClick={() => setLanguage(value as PromptLanguage)}
                  className={`min-h-10 border-r border-[var(--hair)] px-3 font-mono text-[10px] uppercase tracking-[0.08em] transition ${
                    language === value
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-white text-[var(--muted)] hover:bg-[var(--paper-2)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={copyPrompt}
            className="min-h-10 border border-[var(--hair)] bg-[var(--orange)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--ink)]"
          >
            <span aria-live="polite">{copied ? "已复制 ✓" : "复制"}</span>
          </button>
        </div>
      </div>
      <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap border border-[var(--hair)] bg-[var(--paper-2)] p-4 font-sans text-sm leading-8 text-[var(--ink)] sm:p-6">
        {prompt}
      </pre>
    </>
  );
}
