import type { Metadata } from "next";

import { getLocaleFromCookies } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "Diagramm",
  description: "Turn policies and SOPs into editable process diagrams."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocaleFromCookies();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
