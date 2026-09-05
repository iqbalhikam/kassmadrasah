import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kas Madrasah Universal - Keuangan Kas Berbasis Google Drive",
  description: "Sistem Manajemen Kas Madrasah Gratis & Privat. Data tersimpan aman di Google Drive & Sheets milik sendiri.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className={`${inter.className} min-h-full bg-slate-900 text-slate-100 flex flex-col`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
