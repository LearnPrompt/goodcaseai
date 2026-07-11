type SearchBoxProps = {
  defaultQuery?: string;
  filter?: string;
};

export function SearchBox({ defaultQuery = "", filter }: SearchBoxProps) {
  return (
    <form action="/cases" method="get" className="flex w-full max-w-xl gap-2">
      {filter && filter !== "all" ? (
        <input type="hidden" name="filter" value={filter} />
      ) : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder="搜索标题、摘要或创作者"
        aria-label="搜索案例"
        className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white/60 px-4 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[var(--ink)] bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--bg-strong)] transition hover:-translate-y-0.5"
      >
        搜索
      </button>
    </form>
  );
}
