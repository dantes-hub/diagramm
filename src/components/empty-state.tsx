import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import type { Translations } from "@/lib/i18n";

export function EmptyState({ t }: { t: Translations }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--panel-strong)]">
          <FileText className="h-7 w-7 text-[var(--muted)]" strokeWidth={2} />
        </div>
        <h3 className="mb-2 text-lg font-medium text-[var(--ink)]">{t.noProcessesYet}</h3>
        <p className="mb-6 max-w-sm text-sm leading-6 text-[var(--muted)]">{t.emptyStateText}</p>
        <Link
          href="/processes/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t.createFirstProcess}
        </Link>
      </div>
    </div>
  );
}
