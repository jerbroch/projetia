import type { Customer } from "@/types";

/**
 * Avertissements et refus sur les saisies courantes.
 *
 * La ligne de partage est simple : on REFUSE ce qui n'a aucun sens, on
 * AVERTIT quand la saisie est inhabituelle mais légitime. Bloquer une chose
 * qui arrive vraiment — deux clients du même nom, un extra offert — pousse
 * l'entrepreneur à contourner l'outil ; laisser passer une chose absurde le
 * lui fait découvrir chez son client.
 */

/** Libellé d'un client : « Entreprise — Nom », ou le nom seul. */
export function libelleClient(customer: Pick<Customer, "name" | "company">): string {
  const entreprise = (customer.company ?? "").trim();
  const nom = (customer.name ?? "").trim();
  // Sans ce garde, un client sans entreprise s'affichait « — Alpha
  // Construction », avec un tiret orphelin en tête de liste.
  if (!entreprise) return nom;
  if (!nom) return entreprise;
  if (entreprise === nom) return nom;
  return `${entreprise} — ${nom}`;
}

/**
 * Client existant portant le même nom, ou `null`.
 *
 * On avertit sans bloquer : deux « Construction Tremblay » différents, ça
 * arrive. Mais l'avertissement NOMME celui qui existe déjà, avec ce qui permet
 * de les distinguer — courriel, téléphone — sinon il ne sert à rien.
 */
export function clientDuMemeNom<T extends { id: string; name: string; email?: string; phone?: string }>(
  clients: readonly T[],
  nom: string,
  exclureId?: string,
): T | null {
  const cible = nom.trim().toLowerCase();
  if (!cible) return null;
  return clients.find((c) => c.id !== exclureId && c.name.trim().toLowerCase() === cible) ?? null;
}

export function avertissementDoublonClient(existant: {
  name: string;
  email?: string;
  phone?: string;
}): string {
  const signes = [existant.email, existant.phone].filter((x) => (x ?? "").trim()).join(" · ");
  const detail = signes ? ` (${signes})` : "";
  return `Vous avez déjà un client nommé « ${existant.name} »${detail}. Créez-le quand même s'il s'agit d'une autre personne.`;
}

/** Avertissement avant d'envoyer une soumission à 0 $, ou `null`. */
export function avertissementSoumissionAZero(montant: number): string | null {
  if (montant > 0) return null;
  return "Cette soumission est à 0 $. Le client recevra un document sans montant — c'est voulu pour un devis gratuit ou une reprise, sinon entrez le prix avant d'envoyer.";
}

/**
 * Refus d'une date de validité déjà passée.
 *
 * Ici on bloque : une soumission qui expire avant d'être lue n'a aucun sens,
 * et le client qui clique découvre un document périmé.
 */
export function refusDeValiditePassee(
  validUntil: string | null | undefined,
  maintenant: Date = new Date(),
): string | null {
  const brut = (validUntil ?? "").trim();
  if (!brut) return null;
  const d = new Date(`${brut}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= maintenant.getTime()) return null;
  return "La date de validité est déjà passée. Choisissez une date future — sinon la soumission arrive expirée chez le client.";
}

const UN_AN = 365 * 24 * 60 * 60 * 1000;

/**
 * Avertissement sur une date de call très éloignée, ou `null`.
 *
 * Un chantier planifié l'an prochain existe ; un chantier en 1999 est une
 * faute de frappe. On avertit au-delà d'un an, dans les deux sens, sans
 * bloquer — un contrat pluriannuel se planifie.
 */
export function avertissementDateEloignee(
  date: string | null | undefined,
  maintenant: Date = new Date(),
): string | null {
  const brut = (date ?? "").trim();
  if (!brut) return null;
  const d = new Date(`${brut}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const ecart = d.getTime() - maintenant.getTime();
  if (Math.abs(ecart) <= UN_AN) return null;

  // Math.floor et non round : la phrase dit « plus de X ans ». Un écart de
  // 1 an 8 mois est « plus d'un an », pas « plus de 2 ans » — qui serait faux.
  const annees = Math.max(1, Math.floor(Math.abs(ecart) / UN_AN));
  const quand = d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  return ecart < 0
    ? `Cette date est dans le passé de plus de ${annees === 1 ? "un an" : `${annees} ans`} (${quand}). Vérifiez l'année.`
    : `Cette date est dans plus de ${annees === 1 ? "un an" : `${annees} ans`} (${quand}). Vérifiez l'année.`;
}
