import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { LikeButton } from "@/components/like-button";
import { PromptPanel } from "@/components/prompt-panel";
import { CaseMedia } from "@/components/case-media";
import { getCaseDetailData } from "@/lib/cases";

function modelCardTone(index: number) {
  if (index === 0) return "border-[rgba(203,92,47,0.38)] bg-[rgba(203,92,47,0.08)]";
  if (index === 1) return "border-[rgba(35,100,170,0.35)] bg-[rgba(35,100,170,0.08)]";
  return "border-[var(--line)] bg-white/60";
}

function modelEffectText(model: string, category: string) {
  if (category === "video") {
    return `${model}：动态连续性更稳，适合先出叙事主版本，再做节奏微调。`;
  }

  if (category === "web") {
    return `${model}：结构化产出更快，适合先搭UI骨架，再补业务细节。`;
  }

  if (category === "image") {
    return `${model}：画面质感与风格一致性更好，适合先确定主视觉方向。`;
  }

  return `${model}：文本约束执行更稳定，适合先定结构再优化表达。`;
}

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getCaseDetailData(slug);

  if (!item) {
    notFound();
  }

  return (
    <SiteShell footerNote="Case 详情页是点赞解锁、Prompt 展示和多模型对比最重要的承载页。">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
        <article className="flex min-w-0 flex-col gap-5 self-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(203,92,47,0.14)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {item.category}
            </span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs">{item.source}</span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs">
              作者 {item.creator}
            </span>
          </div>
          <h1 className="max-w-[12ch] font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {item.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{item.summary}</p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LikeButton caseSlug={item.slug} initialCount={item.likedCount} />
            <div className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-4 text-sm">
              复刻 {item.remakeCount}
            </div>
            <div className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white/60 px-4 text-sm">
              稳定 {item.stabilityScore}
            </div>
          </div>
        </article>

        <CaseMedia
          mediaType={item.mediaType}
          mediaUrl={item.mediaUrl}
          posterUrl={item.posterUrl}
          title={item.title}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:mt-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <PromptPanel
          caseSlug={item.slug}
          promptPreview={item.promptPreview}
          promptFull={item.promptFull}
        />

        <article
          id="model-effects"
          className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(43,28,18,0.12)] sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Model effects
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-[0.95] tracking-[-0.04em] sm:text-4xl">
            稳定榜直达区：快速看推荐模型与预期效果。
          </h2>
          <div className="mt-5 grid gap-3">
            {item.recommendedModels.map((model, index) => (
              <article
                key={model}
                className={`rounded-[16px] border px-4 py-4 ${modelCardTone(index)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-[var(--ink)]">{model}</h3>
                  <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs">
                    稳定参考 {Math.max(60, item.stabilityScore - index)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {modelEffectText(model, item.category)}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
            成本档位：
            <strong className="ml-2 text-[var(--ink)]">
              {item.costBand === "low"
                ? "低"
                : item.costBand === "medium"
                  ? "中"
                  : "高"}
            </strong>
          </p>
        </article>
      </section>
    </SiteShell>
  );
}
