import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ReviewEditor } from "@/components/review-editor";
import { requirePageViewer } from "@/lib/auth";
import { getLocaleFromCookies, getTranslations } from "@/lib/i18n";
import { getProcessOrThrow } from "@/lib/process-service";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocaleFromCookies();
  const t = getTranslations(locale);
  const { id } = await params;
  const viewer = await requirePageViewer(`/processes/${id}/review`);
  const process = await getProcessOrThrow(id).catch(() => null);

  if (!process || !process.extraction) {
    notFound();
  }

  const extraction = process.extraction;

  return (
    <AppShell
      locale={locale}
      t={t}
      viewer={viewer}
    >
      <ReviewEditor processId={process.id} initialExtraction={extraction} t={t} />
    </AppShell>
  );
}
