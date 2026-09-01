import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BaseViseeBanner } from "@/components/shared/base-visee-banner";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ConstructionIOS - Construction Management SaaS",
  description: "All-in-one platform for construction companies to manage customers, quotes, invoices, scheduling, and payments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className={inter.className}>
        {/*
          Avant tout le reste : si le serveur local écrit dans une base qui
          n'est pas celle de test, il faut le voir AVANT de cliquer.
        */}
        <BaseViseeBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
