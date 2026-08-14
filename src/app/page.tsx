import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Construction iOS — Gestion d'entreprise de construction",
  description:
    "Clients, soumissions, planification, facturation et paiements — réunis dans une seule application pour les entrepreneurs en construction.",
};

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
