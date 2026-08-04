"use client";

import { PromptViewer } from "@/components/prompt-viewer";
import { useMessages } from "@/i18n/client";
import {
  formatStabilityScore,
  hasMeasuredStability,
} from "@/lib/stability";

export function PromptPanel({
  promptPreview,
  promptFull,
  contentLocale,
  promptTranslationZh,
  promptTranslationEn,
  promptContributionNotes,
  recommendedModels,
  stabilityScore,
  costBand,
}: {
  promptPreview: string;
  promptFull: string;
  contentLocale?: "zh-CN" | "en";
  promptTranslationZh?: string;
  promptTranslationEn?: string;
  promptContributionNotes: string[];
  recommendedModels: string[];
  stabilityScore: number;
  costBand: string;
}) {
  const messages = useMessages();
  const prompt = promptFull.trim() || promptPreview.trim();

  return (
    <article id="prompt" className="gc-panel overflow-hidden">
      <section className="p-5 sm:p-7">
        <PromptViewer
          original={prompt}
          originalLocale={contentLocale}
          translationZh={promptTranslationZh}
          translationEn={promptTranslationEn}
        />
      </section>

      <section className="border-t border-[var(--orange)] bg-[rgba(194,65,12,0.055)] p-5 sm:p-7">
        <p className="gc-eyebrow">{messages.prompt.reusableMethod}</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]">
          {/* 三段式：关键决定 / 换到你的题材 / 容易翻车。
              取代原来按类目拼的两段模板，内容按每条 Case 单独撰写。 */}
          <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-3">
            {promptContributionNotes.slice(0, 3).map((note, index) => (
              <div key={note} className="border-b border-r border-[var(--hair)] bg-white p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--orange)]">
                  {[
                    messages.prompt.keyDecisions,
                    messages.prompt.adaptToYours,
                    messages.prompt.failureModes,
                  ][index]}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--muted)]">
                  {note}
                </p>
              </div>
            ))}
          </div>
          <div className="border border-[var(--hair)] bg-white p-4">
            <p className="gc-stat-label">{messages.prompt.recommendedModels}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendedModels.map((model) => (
                <span key={model} className="gc-chip">
                  {model}
                </span>
              ))}
            </div>
            <dl className="mt-4 grid gap-2 text-sm leading-6">
              <div className="flex justify-between gap-4 border-t border-[var(--concrete)] pt-2">
                <dt className="text-[var(--muted)]">
                  {messages.common.stability}
                </dt>
                <dd className="font-semibold">
                  {hasMeasuredStability(stabilityScore)
                    ? `${formatStabilityScore(stabilityScore)} / 100`
                    : messages.stability.pending}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--concrete)] pt-2">
                <dt className="text-[var(--muted)]">{messages.cost.label}</dt>
                <dd className="font-semibold">{costBand}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </article>
  );
}
