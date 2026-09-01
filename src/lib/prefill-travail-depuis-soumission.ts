import { buildQuoteEstimationSnapshot } from "@/lib/quote-cost-utils";
import type { Customer, Quote, QuoteEstimationSnapshot } from "@/types";

/**
 * Ce qu'une soumission peut remplir dans le formulaire « Nouveau travail ».
 *
 * Le chemin inverse existait déjà — planifier depuis une soumission acceptée —
 * mais pas celui-ci : un entrepreneur qui part du calendrier retapait le titre,
 * le client, l'adresse et la description qu'il venait d'écrire dans sa
 * soumission. Chaque champ retapé est une occasion de se tromper, et une raison
 * de plus de ne pas s'en servir.
 *
 * L'ADRESSE VIENT DU CLIENT, pas de la soumission : `quotes` n'en porte
 * aucune. C'est pourquoi cette fonction prend la liste des clients — sans elle,
 * l'adresse du chantier resterait vide alors qu'on la connaît.
 */
export interface PrefillTravail {
  title: string;
  description: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  jobSiteAddress: string;
  billingAddress: string;
  /** Heures de main-d'œuvre chiffrées, ou `undefined` si la soumission n'en a pas. */
  estimatedHours?: number;
  snapshot: QuoteEstimationSnapshot;
}

/** Soumissions qu'il est utile de proposer : ni refusées, ni expirées. */
export function soumissionsProposables(quotes: readonly Quote[]): Quote[] {
  const exclus = new Set(["rejected", "expired"]);
  return quotes
    .filter((q) => !exclus.has(q.status))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Libellé du choix : le numéro d'abord, c'est par lui qu'on cherche. */
export function libelleDeSoumission(q: Quote): string {
  const montant = (q.proposedAmount ?? q.amount ?? 0).toLocaleString("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${q.quoteNumber} — ${q.customerName} — ${montant} $`;
}

export function prefillDepuisSoumission(
  quote: Quote,
  customers: readonly Customer[],
): PrefillTravail {
  const client = quote.customerId
    ? customers.find((c) => c.id === quote.customerId)
    : customers.find((c) => c.name === quote.customerName);

  const snapshot = buildQuoteEstimationSnapshot(quote);

  return {
    title: quote.title ?? "",
    description: quote.description ?? "",
    customerId: quote.customerId || client?.id,
    customerName: quote.customerName ?? client?.name ?? "",
    // La soumission fait foi pour le courriel : c'est celui auquel elle a été
    // envoyée. La fiche client ne sert que de repli.
    customerEmail: quote.customerEmail || client?.email || "",
    customerPhone: client?.phone ?? "",
    jobSiteAddress: client?.address ?? "",
    billingAddress: client?.billingAddress ?? client?.address ?? "",
    estimatedHours: snapshot.estimatedHours,
    snapshot,
  };
}
