import clsx from "clsx";

import type { Translations } from "@/lib/i18n";

export function StatusPill({
  status,
  t
}: {
  status: "draft" | "review" | "ready";
  t: Translations;
}) {
  const label = status === "draft" ? t.draft : status === "review" ? t.review : t.ready;

  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-[0.01em]",
        status === "draft" && "bg-stone-100 text-stone-600",
        status === "review" && "border border-amber-200 bg-amber-50 text-amber-700",
        status === "ready" && "border border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {label}
    </span>
  );
}
