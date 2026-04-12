"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  GitBranch,
  Lock,
  Mail,
  User
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Translations } from "@/lib/i18n";

type AuthView = "sign-in" | "sign-up" | "forgot" | "confirm";
type ConfirmMode = "signup" | "reset";

function spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
  );
}

export function LoginForm({ t }: { t: Translations }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const initialView: AuthView = requestedView === "signup" ? "sign-up" : "sign-in";

  const [view, setView] = useState<AuthView>(initialView);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextRoute = useMemo(
    () => ((searchParams.get("next") || "/dashboard") as Route),
    [searchParams]
  );

  function resetError() {
    setError(null);
  }

  function switchView(nextView: AuthView) {
    resetError();
    setView(nextView);
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      router.replace(nextRoute);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data.session) {
        router.replace(nextRoute);
        router.refresh();
        return;
      }

      setConfirmMode("signup");
      setView("confirm");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/login`
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setConfirmMode("reset");
      setView("confirm");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Password reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--deep)]">
            <GitBranch className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-xl font-semibold text-[var(--ink)]">Diagramm</span>
        </Link>
        <p className="mt-3 text-sm text-[var(--muted)]">{t.loginDescription}</p>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
        {view === "sign-in" ? (
          <form onSubmit={handleSignIn}>
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-[var(--ink)]">{t.signInTitle}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.signInText}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                  {t.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--ink)]">{t.passwordLabel}</label>
                  <button
                    type="button"
                    onClick={() => switchView("forgot")}
                    className="text-xs text-[var(--muted)] transition hover:text-[var(--ink)]"
                  >
                    {t.forgotPassword}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--deep)] px-4 text-sm font-semibold text-white transition disabled:opacity-60"
              >
                {submitting ? spinner() : t.signIn}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-[var(--muted)]">
              {t.needAccount}{" "}
              <button
                type="button"
                onClick={() => switchView("sign-up")}
                className="font-medium text-[var(--ink)] transition hover:text-[var(--accent)]"
              >
                {t.createAccount}
              </button>
            </div>
          </form>
        ) : null}

        {view === "sign-up" ? (
          <form onSubmit={handleSignUp}>
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-[var(--ink)]">{t.signUpTitle}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.signUpText}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                  {t.fullNameLabel}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                  {t.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                  {t.passwordLabel}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{t.passwordHint}</p>
              </div>

              {error ? (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--deep)] px-4 text-sm font-semibold text-white transition disabled:opacity-60"
              >
                {submitting ? spinner() : t.createAccount}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-[var(--muted)]">
              {t.haveAccount}{" "}
              <button
                type="button"
                onClick={() => switchView("sign-in")}
                className="font-medium text-[var(--ink)] transition hover:text-[var(--accent)]"
              >
                {t.signIn}
              </button>
            </div>
          </form>
        ) : null}

        {view === "forgot" ? (
          <form onSubmit={handleForgot}>
            <div className="mb-6">
              <button
                type="button"
                onClick={() => switchView("sign-in")}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.backToSignIn}
              </button>
              <h1 className="text-lg font-semibold text-[var(--ink)]">{t.forgotPasswordTitle}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{t.forgotPasswordText}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                  {t.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--deep)] px-4 text-sm font-semibold text-white transition disabled:opacity-60"
              >
                {submitting ? spinner() : t.forgotPasswordSubmit}
              </button>
            </div>
          </form>
        ) : null}

        {view === "confirm" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-6 w-6 text-emerald-600" strokeWidth={2.4} />
            </div>
            <h1 className="text-lg font-semibold text-[var(--ink)]">{t.confirmTitle}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {confirmMode === "signup" ? t.confirmText : t.confirmResetText}{" "}
              <span className="font-medium text-[var(--ink)]">{email}</span>
            </p>
            <button
              type="button"
              onClick={() => switchView("sign-in")}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--deep)] px-4 text-sm font-semibold text-white"
            >
              {t.backToSignIn}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">{t.authTerms}</p>
    </div>
  );
}
