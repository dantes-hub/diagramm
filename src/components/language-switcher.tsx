"use client";

import { useRouter } from "next/navigation";

import type { Locale, Translations } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  t
}: {
  locale: Locale;
  t: Translations;
}) {
  const router = useRouter();

  async function setLocale(nextLocale: Locale) {
    await fetch("/api/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale })
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        {t.language}
      </span>
      <div className="inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--panel)] p-0.5">
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition ${
            locale === "en"
              ? "bg-[var(--panel-strong)] text-[var(--ink)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("mn")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition ${
            locale === "mn"
              ? "bg-[var(--panel-strong)] text-[var(--ink)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          MN
        </button>
      </div>
    </div>
  );
}
