import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ProcessDiagram } from "@/components/process-diagram";
import { requirePageViewer } from "@/lib/auth";
import { getLocaleFromCookies, getTranslations } from "@/lib/i18n";
import { getProcessOrThrow } from "@/lib/process-service";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocaleFromCookies();
  const t = getTranslations(locale);
  const { id } = await params;
  const viewer = await requirePageViewer(`/processes/${id}/editor`);
  const process = await getProcessOrThrow(id).catch(() => null);

  if (!process || !process.diagram) {
    notFound();
  }

  const updatedLabel = new Intl.DateTimeFormat(locale === "mn" ? "mn-MN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(process.updatedAt));

  return (
    <AppShell
      locale={locale}
      t={t}
      viewer={viewer}
      mainClassName="flex-1 overflow-hidden"
    >
      <ProcessDiagram
        diagram={process.diagram}
        title={process.title}
        updatedLabel={updatedLabel}
        initialMode={process.diagramKind}
        processId={process.id}
        t={t}
      />
    </AppShell>
  );
}
