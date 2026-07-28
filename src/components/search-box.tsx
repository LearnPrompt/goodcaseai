"use client";

import { trackEvent } from "@/lib/analytics";
import { useLocale, useMessages } from "@/i18n/client";
import { localizeHref } from "@/i18n/config";

type SearchBoxProps = {
  defaultQuery?: string;
  filter?: string;
};

export function SearchBox({ defaultQuery = "", filter }: SearchBoxProps) {
  const locale = useLocale();
  const messages = useMessages();

  return (
    <form
      action={localizeHref(locale, "/cases")}
      method="get"
      className="flex w-full max-w-2xl gap-2"
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const query = String(formData.get("q") || "").trim();
        trackEvent("case_search", {
          hasQuery: query.length > 0,
          queryLength: query.length,
          filter: filter || "all",
        });
      }}
    >
      {filter && filter !== "all" ? (
        <input type="hidden" name="filter" value={filter} />
      ) : null}
      <input
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder={messages.search.placeholder}
        aria-label={messages.search.ariaLabel}
        className="min-h-11 w-full border border-[var(--hair)] bg-white px-4 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--orange)] focus:outline-none"
      />
      <button
        type="submit"
        className="gc-action whitespace-nowrap border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
      >
        {messages.search.submit}
      </button>
    </form>
  );
}
