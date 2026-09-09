import { subscriptionPeriodEnd } from "@/lib/billing/stripe-payload";

/**
 * LE PRIX PAYÉ, ENREGISTRÉ AU PASSAGE DU WEBHOOK.
 *
 * `syncSubscriptionToCompany` n'écrivait que l'état d'accès sur `companies` :
 * palier, statut, fin de période. Le MONTANT n'était nulle part, si bien que le
 * tableau de revenus ne pouvait afficher que zéro.
 *
 * Un tableau de revenus qui affiche zéro pendant que des clients paient est le
 * même mensonge que « Stripe non connecté » — et il est pire, parce qu'on ne
 * doute pas d'un chiffre.
 *
 * La ligne va dans `company_subscriptions`, qui porte déjà les bonnes colonnes
 * et un index unique sur `stripe_subscription_id`. `companies` reste la source
 * de vérité pour l'ACCÈS ; cette table-ci est la trace de l'ARGENT.
 */

/** Ce qu'on lit d'un abonnement Stripe sans dépendre de sa forme exacte. */
interface Enregistrable {
  id?: unknown;
  status?: unknown;
  customer?: unknown;
  currency?: unknown;
  canceled_at?: unknown;
  start_date?: unknown;
  items?: unknown;
}

export interface LigneAbonnement {
  company_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  plan_name: string | null;
  plan_amount_cents: number;
  currency: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

function identifiant(valeur: unknown): string | null {
  if (typeof valeur === "string") return valeur;
  if (valeur && typeof valeur === "object" && "id" in valeur) {
    const id = (valeur as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function horodatage(valeur: unknown): string | null {
  if (typeof valeur !== "number" || !Number.isFinite(valeur) || valeur <= 0) return null;
  return new Date(valeur * 1000).toISOString();
}

/**
 * Le montant réellement facturé, en cents.
 *
 * Somme des lignes, quantité comprise : un abonnement à deux sièges coûte deux
 * fois le prix unitaire. Prendre `unit_amount` seul afficherait la moitié du
 * revenu réel, ce qui est pire qu'un zéro — on ne le remarquerait pas.
 */
export function montantEnCents(subscription: unknown): number {
  const sub = subscription as Enregistrable | null;
  const items = (sub?.items as { data?: unknown[] } | undefined)?.data;
  if (!Array.isArray(items)) return 0;

  let total = 0;
  for (const entree of items) {
    const item = entree as { quantity?: unknown; price?: { unit_amount?: unknown } } | null;
    const unitaire = item?.price?.unit_amount;
    if (typeof unitaire !== "number" || !Number.isFinite(unitaire)) continue;
    const quantite = typeof item?.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    total += unitaire * quantite;
  }
  return total;
}

/** La devise de l'abonnement, en minuscules. Le dollar canadien par défaut. */
export function deviseDe(subscription: unknown): string {
  const sub = subscription as Enregistrable | null;
  const items = (sub?.items as { data?: unknown[] } | undefined)?.data;
  const premiere = Array.isArray(items) ? (items[0] as { price?: { currency?: unknown } } | null) : null;
  const depuisLigne = premiere?.price?.currency;
  if (typeof depuisLigne === "string" && depuisLigne) return depuisLigne.toLowerCase();
  if (typeof sub?.currency === "string" && sub.currency) return sub.currency.toLowerCase();
  return "cad";
}

/**
 * Compose la rangée à enregistrer. Rend `null` quand l'abonnement n'a pas
 * d'identifiant : sans lui, l'insertion ne saurait pas quoi remplacer et
 * dupliquerait la ligne à chaque événement.
 */
export function ligneAbonnementDepuisStripe(
  subscription: unknown,
  companyId: string,
  planName: string | null,
  maintenant = new Date().toISOString(),
): LigneAbonnement | null {
  const sub = subscription as Enregistrable | null;
  const subscriptionId = identifiant(sub?.id);
  if (!subscriptionId) return null;

  const items = (sub?.items as { data?: unknown[] } | undefined)?.data;
  const premiere = Array.isArray(items)
    ? (items[0] as { current_period_start?: unknown } | null)
    : null;

  const finSecondes = subscriptionPeriodEnd(subscription);

  return {
    company_id: companyId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: identifiant(sub?.customer),
    plan_name: planName,
    plan_amount_cents: montantEnCents(subscription),
    currency: deviseDe(subscription),
    status: typeof sub?.status === "string" ? sub.status : "unknown",
    // Stripe a déplacé les périodes sur les lignes ; on regarde les deux
    // endroits, comme le fait déjà `subscriptionPeriodEnd`.
    current_period_start:
      horodatage(premiere?.current_period_start) ?? horodatage(sub?.start_date),
    current_period_end: horodatage(finSecondes),
    cancelled_at: horodatage(sub?.canceled_at),
    updated_at: maintenant,
  };
}
