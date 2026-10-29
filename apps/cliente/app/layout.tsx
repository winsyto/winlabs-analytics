import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { DEFAULT_PALETTE, paletteCss } from "./(dashboard)/_dashboard-kit/palette";

export const metadata: Metadata = {
  title: "WinLabs Analytics",
  description: "People Analytics para LATAM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-palette={DEFAULT_PALETTE} className={`${GeistSans.variable} h-full antialiased`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: paletteCss() }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
