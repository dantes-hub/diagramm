import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getOptionalViewer } from "@/lib/auth";
import { getLocaleFromCookies, getTranslations } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage() {
  const locale = await getLocaleFromCookies();
  const t = getTranslations(locale);
  const viewer = await getOptionalViewer();

  if (viewer) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(244,241,233,0.72),_rgba(244,241,233,0.98))]" />
      {isSupabaseConfigured() ? (
        <LoginForm t={t} />
      ) : (
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[var(--ink)]">{t.loginTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Supabase auth is not configured. Add `NEXT_PUBLIC_SUPABASE_URL` and
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` to continue.
          </p>
        </div>
      )}
    </main>
  );
}
