"use client";

import { useMessages } from "@/i18n/client";

export function SiteFooter({ note }: { note?: string }) {
  const messages = useMessages();

  return (
    <footer className="grid gap-3 border-t border-[var(--hair)] bg-[var(--paper-2)] px-4 py-5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] md:grid-cols-[auto_1fr] md:items-center md:px-6">
      <span className="text-[var(--ink)]">{messages.site.footerBrand}</span>
      {note ? <span className="md:text-right">{note}</span> : null}
    </footer>
  );
}
