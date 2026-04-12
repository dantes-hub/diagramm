import { AppShell } from "@/components/app-shell";
import { NewProcessForm } from "@/components/new-process-form";
import { requirePageViewer } from "@/lib/auth";
import { getLocaleFromCookies, getTranslations } from "@/lib/i18n";

export default async function NewProcessPage() {
  const locale = await getLocaleFromCookies();
  const t = getTranslations(locale);
  const viewer = await requirePageViewer("/processes/new");

  return (
    <AppShell
      locale={locale}
      t={t}
      viewer={viewer}
    >
      <NewProcessForm t={t} />
    </AppShell>
  );
}
