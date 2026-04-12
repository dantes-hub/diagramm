"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GitBranch,
  LayoutDashboard,
  LogOut,
  Upload
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppViewer } from "@/lib/auth";
import type { Locale, Translations } from "@/lib/i18n";

export function AppSidebar({
  locale,
  t,
  viewer
}: {
  locale: Locale;
  t: Translations;
  viewer?: AppViewer | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navigation = [
    { name: t.navDashboard, href: "/dashboard" as const, icon: LayoutDashboard },
    { name: t.navNewDiagram, href: "/processes/new" as const, icon: Upload }
  ];

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex h-14 items-center border-b border-[var(--line)] px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--deep)]">
            <GitBranch className="h-4 w-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">{t.appName}</span>
        </Link>
      </div>


<nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.name}
              </Link>
            );
          })}
        </div>

      </nav>

      <div className="border-t border-[var(--line)] p-3">
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/70 px-3 py-2">
          <LanguageSwitcher locale={locale} t={t} />
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/70 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel)] text-xs font-semibold text-[var(--ink)]">
            {viewer?.email
              ? viewer.email.slice(0, 1).toUpperCase()
              : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              {viewer?.email ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            aria-label={t.signOut}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
