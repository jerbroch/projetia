/**
 * Source unique de vérité des paliers d'abonnement ConstructionIOS.
 *
 * Les montants servent UNIQUEMENT à l'affichage : c'est le Stripe Price ID qui
 * détermine ce qui est réellement facturé. Si les deux divergent, la page
 * affiche un prix et le client en paie un autre — garder les deux alignés.
 *
 * Les Price IDs sont lus depuis process.env à chaque appel (jamais en dur, et
 * jamais figés au chargement du module : Vercel injecte l'environnement au
 * démarrage du serveur).
 */

export type SubscriptionTier = "solo" | "entreprise" | "entrepreneur" | "croissance";
export type BillingCycle = "monthly" | "annual";

/** Devise de facturation — doit correspondre à celle des Price IDs Stripe. */
export const BILLING_CURRENCY = "cad";

/** Facturation annuelle : 10 mois payés pour 12 mois d'accès. */
export const ANNUAL_MONTHS_BILLED = 10;
export const ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_BILLED;

export interface TierDefinition {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  /** Montants en cents, pour l'affichage */
  monthlyPriceCents: number;
  annualPriceCents: number;
  /** Nombre d'utilisateurs inclus — null = illimité */
  userLimit: number | null;
  features: string[];
  /** Noms des variables d'environnement portant les Stripe Price IDs */
  priceIdEnv: Record<BillingCycle, string>;
  /** Palier mis en avant sur la page de tarification */
  highlighted?: boolean;
}

export const SUBSCRIPTION_TIERS: readonly TierDefinition[] = [
  {
    id: "solo",
    name: "Solo",
    tagline: "Pour l'entrepreneur qui travaille seul",
    monthlyPriceCents: 3999,
    annualPriceCents: 39990,
    userLimit: 1,
    features: [
      "1 utilisateur",
      "Projets et chantiers illimités",
      "Soumissions et facturation illimitées",
      "Paiement en ligne des factures",
    ],
    priceIdEnv: {
      monthly: "STRIPE_PRICE_SOLO_MONTHLY",
      annual: "STRIPE_PRICE_SOLO_ANNUAL",
    },
  },
  {
    id: "entreprise",
    name: "Entreprise",
    tagline: "Pour une petite équipe sur le terrain",
    monthlyPriceCents: 8999,
    annualPriceCents: 89990,
    userLimit: 5,
    features: [
      "Jusqu'à 5 utilisateurs",
      "Projets et chantiers illimités",
      "Horaire et planification d'équipe",
      "Feuilles de facturation par chantier",
    ],
    priceIdEnv: {
      monthly: "STRIPE_PRICE_ENTREPRISE_MONTHLY",
      annual: "STRIPE_PRICE_ENTREPRISE_ANNUAL",
    },
    highlighted: true,
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    tagline: "Pour l'entrepreneur général avec plusieurs équipes",
    monthlyPriceCents: 14999,
    annualPriceCents: 149990,
    userLimit: 15,
    features: [
      "Jusqu'à 15 utilisateurs",
      "Projets et chantiers illimités",
      "Catalogue de prix et taux de main-d'œuvre",
      "Suivi des coûts et estimation",
    ],
    priceIdEnv: {
      monthly: "STRIPE_PRICE_ENTREPRENEUR_MONTHLY",
      annual: "STRIPE_PRICE_ENTREPRENEUR_ANNUAL",
    },
  },
  {
    id: "croissance",
    name: "Croissance",
    tagline: "Sans limite d'utilisateurs",
    monthlyPriceCents: 24999,
    annualPriceCents: 249990,
    userLimit: null,
    features: [
      "Utilisateurs illimités",
      "Projets et chantiers illimités",
      "Toutes les fonctionnalités incluses",
      "Support prioritaire",
    ],
    priceIdEnv: {
      monthly: "STRIPE_PRICE_CROISSANCE_MONTHLY",
      annual: "STRIPE_PRICE_CROISSANCE_ANNUAL",
    },
  },
] as const;

const TIER_IDS: ReadonlySet<string> = new Set(SUBSCRIPTION_TIERS.map((t) => t.id));

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === "string" && TIER_IDS.has(value);
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function getTier(id: string | null | undefined): TierDefinition | null {
  if (!isSubscriptionTier(id)) return null;
  return SUBSCRIPTION_TIERS.find((tier) => tier.id === id) ?? null;
}

export function priceCentsForTier(tier: TierDefinition, cycle: BillingCycle): number {
  return cycle === "annual" ? tier.annualPriceCents : tier.monthlyPriceCents;
}

/** Stripe Price ID configuré pour ce palier, ou null si absent de l'environnement. */
export function priceIdForTier(
  tier: SubscriptionTier,
  cycle: BillingCycle,
): string | null {
  const definition = getTier(tier);
  if (!definition) return null;
  return process.env[definition.priceIdEnv[cycle]]?.trim() || null;
}

export function isTierPurchasable(tier: SubscriptionTier, cycle: BillingCycle): boolean {
  return Boolean(priceIdForTier(tier, cycle));
}

export interface TierMatch {
  tier: SubscriptionTier;
  cycle: BillingCycle;
}

/** Retrouve le palier et le cycle correspondant à un Stripe Price ID. */
export function tierForPriceId(priceId: string | null | undefined): TierMatch | null {
  const target = priceId?.trim();
  if (!target) return null;

  for (const tier of SUBSCRIPTION_TIERS) {
    for (const cycle of ["monthly", "annual"] as const) {
      if (process.env[tier.priceIdEnv[cycle]]?.trim() === target) {
        return { tier: tier.id, cycle };
      }
    }
  }

  return null;
}

/** Nombre d'utilisateurs inclus — null = illimité. Palier inconnu → 1 (le plus strict). */
export function userLimitForTier(tier: string | null | undefined): number | null {
  const definition = getTier(tier);
  if (!definition) return 1;
  return definition.userLimit;
}

/** Essai gratuit appliqué au Checkout (0 = aucun essai). */
export function getTrialDays(): number {
  const raw = process.env.SUBSCRIPTION_TRIAL_DAYS?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 730);
}

export function tierLabel(tier: string | null | undefined): string {
  return getTier(tier)?.name ?? "—";
}

export function cycleLabel(cycle: string | null | undefined): string {
  if (cycle === "monthly") return "Mensuel";
  if (cycle === "annual") return "Annuel";
  return "—";
}

export function userLimitLabel(tier: string | null | undefined): string {
  const limit = userLimitForTier(tier);
  if (limit == null) return "Utilisateurs illimités";
  return limit === 1 ? "1 utilisateur" : `Jusqu'à ${limit} utilisateurs`;
}

export function formatPrice(
  cents: number | null,
  currency: string = BILLING_CURRENCY,
): string {
  if (cents == null) return "Prix à configurer";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Coût mensuel effectif d'un abonnement annuel, arrondi au cent. */
export function monthlyEquivalentCents(tier: TierDefinition): number {
  return Math.round(tier.annualPriceCents / 12);
}

/** Économie réalisée sur un an en payant à l'année. */
export function annualSavingsCents(tier: TierDefinition): number {
  return Math.max(0, tier.monthlyPriceCents * 12 - tier.annualPriceCents);
}
