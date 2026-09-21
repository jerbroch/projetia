import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BaseViseeBanner } from "@/components/shared/base-visee-banner";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * LA POLICE DE LA RÉFÉRENCE.
 *
 * Plus Jakarta Sans : titres nets et compacts, chiffres larges et bien
 * alignés — c'est ce qui donne à la maquette ses compteurs lisibles d'un
 * coup d'œil. Seules les graisses réellement employées sont chargées ;
 * chacune en plus est un fichier de plus à télécharger avant le premier
 * rendu du texte.
 */
const police = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--police-interface",
});

export const metadata: Metadata = {
  title: "ConstructionIOS - Construction Management SaaS",
  description: "All-in-one platform for construction companies to manage customers, quotes, invoices, scheduling, and payments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className={`${police.variable} ${police.className}`}>
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
