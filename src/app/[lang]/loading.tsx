export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="size-3 animate-pulse bg-[var(--orange)]" />
          <span className="text-sm font-semibold tracking-[-0.01em] text-[var(--ink)]">
            GoodCase.ai
          </span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
          加载中…
        </p>
      </div>
    </div>
  );
}
