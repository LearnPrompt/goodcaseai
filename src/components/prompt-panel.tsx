import { PromptViewer } from "@/components/prompt-viewer";
import {
  formatStabilityScore,
  hasMeasuredStability,
} from "@/lib/stability";

export function PromptPanel({
  promptPreview,
  promptFull,
  promptTranslationZh,
  promptContributionNotes,
  recommendedModels,
  stabilityScore,
  costBand,
}: {
  promptPreview: string;
  promptFull: string;
  promptTranslationZh?: string;
  promptContributionNotes: string[];
  recommendedModels: string[];
  stabilityScore: number;
  costBand: "低" | "中" | "高";
}) {
  const prompt = promptFull.trim() || promptPreview.trim();

  return (
    <article id="prompt" className="gc-panel overflow-hidden">
      <section className="p-5 sm:p-7">
        <PromptViewer original={prompt} translationZh={promptTranslationZh} />
      </section>

      <section className="border-t border-[var(--orange)] bg-[rgba(194,65,12,0.055)] p-5 sm:p-7">
        <p className="gc-eyebrow">复用方法</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)]">
          <div className="grid border-l border-t border-[var(--hair)] md:grid-cols-2">
            {promptContributionNotes.slice(1, 3).map((note, index) => (
              <div key={note} className="border-b border-r border-[var(--hair)] bg-white p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--orange)]">
                  {["可复用结构", "复测标准"][index]}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{note}</p>
              </div>
            ))}
          </div>
          <div className="border border-[var(--hair)] bg-white p-4">
            <p className="gc-stat-label">建议模型</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendedModels.map((model) => (
                <span key={model} className="gc-chip">
                  {model}
                </span>
              ))}
            </div>
            <dl className="mt-4 grid gap-2 text-sm leading-6">
              <div className="flex justify-between gap-4 border-t border-[var(--concrete)] pt-2">
                <dt className="text-[var(--muted)]">稳定度</dt>
                <dd className="font-semibold">
                  {formatStabilityScore(stabilityScore)}
                  {hasMeasuredStability(stabilityScore) ? " / 100" : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--concrete)] pt-2">
                <dt className="text-[var(--muted)]">成本</dt>
                <dd className="font-semibold">{costBand}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </article>
  );
}
