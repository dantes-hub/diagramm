import Link from "next/link";
import type { Route } from "next";
import {
  Clock,
  FileText,
  GitBranch,
  Plus,
  Users
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProcessRowActions } from "@/components/process-row-actions";
import { StatusPill } from "@/components/status-pill";
import { requirePageViewer } from "@/lib/auth";
import { getLocaleFromCookies, getTranslations } from "@/lib/i18n";
import { getDashboardProcesses } from "@/lib/process-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locale = await getLocaleFromCookies();
  const t = getTranslations(locale);
  const viewer = await requirePageViewer("/dashboard");
  const processes = await getDashboardProcesses();
  const reviewCount = processes.filter((process) => process.status === "review").length;
  const readyCount = processes.filter((process) => process.status === "ready").length;
  const documentCount = new Set(processes.map((process) => process.documentName)).size;

  const stats = [
    {
      label: t.totalProcesses,
      value: String(processes.length),
      icon: GitBranch
    },
    {
      label: t.readyForReview,
      value: String(reviewCount),
      icon: FileText
    },
    {
      label: t.documentsProcessed,
      value: String(documentCount),
      icon: Users
    }
  ];

  return (
    <AppShell
      locale={locale}
      t={t}
      viewer={viewer}
    >
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-6">
            <h1 className="text-lg font-semibold text-[var(--ink)]">{t.navDashboard}</h1>
            <Link
              href="/processes/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {t.newDiagram}
            </Link>
          </div>
        </header>

        <div className="p-6">
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--panel-strong)]">
                      <Icon className="h-5 w-5 text-[var(--muted)]" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-[var(--ink)]">{stat.value}</p>
                      <p className="text-sm text-[var(--muted)]">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--ink)]">{t.recentProcesses}</h2>
              <span className="text-sm text-[var(--muted)]">{processes.length} items</span>
            </div>

            {processes.length === 0 ? (
              <EmptyState t={t} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
                <div className="divide-y divide-[var(--line)]">
                  {processes.map((process) => {
                    const href = (
                      process.status === "ready"
                        ? `/processes/${process.id}/editor`
                        : `/processes/${process.id}/review`
                    ) as Route;

                    return (
                      <div
                        key={process.id}
                        className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--panel-strong)]/70"
                      >
                        <Link href={href} className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-6">
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--panel-strong)]">
                                <GitBranch className="h-5 w-5 text-[var(--muted)]" strokeWidth={2} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate font-medium text-[var(--ink)] group-hover:text-[var(--accent)]">
                                    {process.title}
                                  </h3>
                                  <StatusPill status={process.status} t={t} />
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted)]">
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" strokeWidth={2} />
                                    {process.documentName}
                                  </span>
                                  <span className="capitalize">{process.diagramKind}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="hidden text-right text-xs text-[var(--muted)] md:block">
                                <p>
                                  {process.extraction?.actors.length ?? 0} {t.actorsCount},{" "}
                                  {process.extraction?.steps.length ?? 0} {t.stepsCount}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                                <Clock className="h-3 w-3" strokeWidth={2} />
                                {formatDate(process.updatedAt, locale)}
                              </div>
                            </div>
                          </div>
                        </Link>

                        <div className="ml-4 shrink-0 opacity-0 transition group-hover:opacity-100">
                          <ProcessRowActions
                            processId={process.id}
                            processTitle={process.title}
                            label={t.deleteProcess}
                            cancelLabel={t.cancel}
                            processLabel={t.processTitle}
                            deletingLabel={t.deletingProcess}
                            description={t.deleteProcessDescription}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
