import { calculateQuoteTotals } from "@/lib/quote-cost-utils";
import type { Company } from "@/types";

/**
 * Facture autonome : ni soumission, ni travail, ni feuille de facturation.
 *
 * Le seul chemin de création passait par `generateInvoiceFromBillingAction`,
 * qui exige un travail au bon statut, une feuille et au moins une ligne. Un
 * entrepreneur qui veut simplement facturer une réparation d'une heure devait
 * donc inventer un travail au calendrier. Le bouton « Nouvelle facture », lui,
 * n'était branché sur rien.
 *
 * Le schéma le permettait déjà : `quote_id`, `scheduled_job_id` et
 * `customer_id` sont tous nullables. Le rattachement à un travail reste
 * possible plus tard ; il n'est simplement plus exigé à la création.
 */

export interface LigneFactureRapide {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface LigneCalculee extends LigneFactureRapide {
  lineTotal: number;
}

export interface TotauxFactureRapide {
  lignes: LigneCalculee[];
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Ne garde que les lignes qui portent une description ET un montant. */
export function lignesRetenues(lignes: readonly LigneFactureRapide[]): LigneCalculee[] {
  return lignes
    .filter((l) => l.description.trim().length > 0)
    .map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      lineTotal: cents((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)),
    }));
}

/**
 * Totaux d'une facture rapide, taxes du Québec comprises.
 *
 * Passe par `calculateQuoteTotals` plutôt que de recalculer : c'est la seule
 * façon d'être certain qu'une facture rapide dit la même chose qu'une
 * soumission ou qu'une facture issue d'un travail.
 */
export function totauxFactureRapide(
  lignes: readonly LigneFactureRapide[],
  company: Pick<Company, "gstRate" | "qstRate"> | undefined,
): TotauxFactureRapide {
  const retenues = lignesRetenues(lignes);
  const subtotal = cents(retenues.reduce((s, l) => s + l.lineTotal, 0));
  const t = calculateQuoteTotals(subtotal, company ?? {});
  return { lignes: retenues, subtotal, gst: t.gst, qst: t.qst, total: t.total };
}

/** Ce qui empêche d'enregistrer, ou `null`. Nomme la cause. */
export function refusDeFactureRapide(
  nomClient: string,
  lignes: readonly LigneFactureRapide[],
): string | null {
  if (!nomClient.trim()) return "Choisissez un client, ou entrez un nom.";

  const retenues = lignesRetenues(lignes);
  if (retenues.length === 0) return "Ajoutez au moins une ligne avec une description.";

  // La ligne fautive se nomme AVANT qu'on parle du total : « le total est de
  // 0 $ » envoie chercher partout, « la ligne Rabais est négative » envoie au
  // bon endroit. Une somme négative vient presque toujours d'un signe de trop.
  const negative = retenues.find((l) => l.quantity < 0 || l.unitPrice < 0);
  if (negative) {
    return `La ligne « ${negative.description} » porte une quantité ou un prix négatif.`;
  }

  const total = retenues.reduce((s, l) => s + l.lineTotal, 0);
  if (total <= 0) {
    return "Le total est de 0 $. Vérifiez les quantités et les prix.";
  }

  return null;
}
