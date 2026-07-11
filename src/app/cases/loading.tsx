import { SiteShell } from "@/components/site-shell";

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

export default function CasesLoading() {
  return (
    <SiteShell footerNote="案例库加载中。">
      <section className="mb-7 grid gap-4 sm:mb-8">
        <div className="h-4 w-24 animate-pulse rounded-full bg-black/10" />
        <div className="h-12 w-full max-w-xl animate-pulse rounded-[12px] bg-black/10 sm:h-16" />
        <div className="h-5 w-full max-w-3xl animate-pulse rounded-full bg-black/5" />
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        {["f1", "f2", "f3", "f4"].map((key) => (
          <div key={key} className="h-10 w-24 animate-pulse rounded-full border border-[var(--line)] bg-white/60" />
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {SKELETON_KEYS.map((key) => (
          <article
            key={key}
            className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_20px_60px_rgba(43,28,18,0.12)]"
          >
            <div className="aspect-[4/3] animate-pulse bg-[#e9e1d5]" />
            <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-16 animate-pulse rounded-full bg-black/10" />
                <div className="h-6 w-14 animate-pulse rounded-full bg-black/5" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-black/5" />
              </div>
              <div className="space-y-3">
                <div className="h-9 w-4/5 animate-pulse rounded-[10px] bg-black/10" />
                <div className="h-4 w-full animate-pulse rounded-full bg-black/5" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-black/5" />
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                <div className="h-11 w-32 animate-pulse rounded-full border border-[var(--line)] bg-white/60" />
                <div className="h-11 w-24 animate-pulse rounded-full border border-[var(--line)] bg-white/60" />
              </div>
            </div>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
