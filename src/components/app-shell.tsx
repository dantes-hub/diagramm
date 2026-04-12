import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import type { Locale, Translations } from "@/lib/i18n";
import type { AppViewer } from "@/lib/auth";

export function AppShell({
  children,
  locale,
  t,
  mainClassName,
  viewer
}: {
  children: ReactNode;
  locale: Locale;
  t: Translations;
  mainClassName?: string;
  viewer?: AppViewer | null;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <AppSidebar locale={locale} t={t} viewer={viewer} />
      <main className={mainClassName ?? "flex-1 overflow-y-auto"}>{children}</main>
    </div>
  );
}
