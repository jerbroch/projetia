/**
 * Traduction des statuts Stripe vers le modèle d'accès de ConstructionIOS.
 *
 * `companies.subscription_status` est un ENUM Postgres limité à
 * ('trial', 'active', 'past_due', 'cancelled') — tout statut Stripe doit donc
 * être normalisé avant écriture. Module pur : aucun appel réseau, testable.
 */
import type { BillingCycle, SubscriptionTier } from "@/lib/billing/tiers";

export type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type CompanySubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";

/** Statuts Stripe qui laissent l'entreprise utiliser l'application. */
const ACCESS_GRANTING: ReadonlySet<string> = new Set([
  "active",
  "trialing",
  // Paiement en retard : Stripe relance encore, on garde l'accès (délai de grâce)
  "past_due",
]);

export function subscriptionGrantsAccess(status: string | null | undefined): boolean {
  return status != null && ACCESS_GRANTING.has(status);
}

export function normalizeSubscriptionStatus(
  status: string | null | undefined,
): CompanySubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
      return "past_due";
    default:
      // unpaid, canceled, incomplete, incomplete_expired, paused, inconnu
      return "cancelled";
  }
}

/**
 * Vrai quand l'entreprise a un abonnement Stripe encore vivant, donc modifiable
 * (changement de palier) plutôt que rachetable. Ouvrir un nouveau Checkout dans
 * ce cas créerait un SECOND abonnement sur le même client — double facturation.
 * Un abonnement annulé, lui, se rachète normalement par Checkout.
 */
export function hasModifiableSubscription(company: {
  stripeSubscriptionId?: string | null;
  status?: string | null;
}): boolean {
  if (!company.stripeSubscriptionId) return false;
  return MODIFIABLE_STATUSES.has(company.status ?? "");
}

/** Statuts normalisés pour lesquels l'abonnement Stripe existe encore. */
const MODIFIABLE_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "trial",
  "past_due",
]);

/**
 * Vrai quand les métadonnées d'un abonnement Stripe ne décrivent plus son
 * palier réel.
 *
 * Elles ne sont posées qu'à la création (subscription_data au Checkout) : un
 * changement de palier par le portail client les laisse périmées. Comme elles
 * servent de repli quand le Price ID n'est plus reconnu, une métadonnée périmée
 * désigne le mauvais palier — pire qu'une métadonnée absente.
 */
export function subscriptionMetadataNeedsRealign(
  metadata: Record<string, string> | null | undefined,
  tier: SubscriptionTier,
  cycle: BillingCycle,
): boolean {
  return metadata?.tier !== tier || metadata?.cycle !== cycle;
}

export interface SubscriptionSnapshot {
  status: string | null | undefined;
  /** Cycle de facturation — persisté dans companies.subscription_plan */
  cycle: BillingCycle | null;
  /** Palier — persisté dans companies.subscription_tier */
  tier: SubscriptionTier | null;
  priceId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  /** Timestamps Stripe en secondes */
  currentPeriodEnd?: number | null;
  trialEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export interface ExistingSubscriptionRow {
  accessGrantedAt?: string | null;
  subscriptionStartedAt?: string | null;
}

export type CompanySubscriptionUpdate = Record<string, unknown>;

function toIso(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Patch à appliquer sur `companies` à partir d'un abonnement Stripe.
 * `nowIso` est injecté pour rendre la fonction déterministe en test.
 */
export function buildCompanySubscriptionUpdate(
  snapshot: SubscriptionSnapshot,
  nowIso: string = new Date().toISOString(),
  existing: ExistingSubscriptionRow = {},
): CompanySubscriptionUpdate {
  const hasAccess = subscriptionGrantsAccess(snapshot.status);
  const normalized = normalizeSubscriptionStatus(snapshot.status);
  const periodEnd = toIso(snapshot.currentPeriodEnd);
  const trialEnd = toIso(snapshot.trialEnd);

  const update: CompanySubscriptionUpdate = {
    subscription_status: normalized,
    stripe_subscription_id: snapshot.subscriptionId,
    subscription_price_id: snapshot.priceId,
    subscription_current_period_end: periodEnd,
    subscription_cancel_at_period_end: Boolean(snapshot.cancelAtPeriodEnd),
    subscription_ends_at: periodEnd,
  };

  if (snapshot.customerId) {
    update.stripe_customer_id = snapshot.customerId;
  }

  if (snapshot.cycle) {
    update.subscription_plan = snapshot.cycle;
  }

  if (snapshot.tier) {
    update.subscription_tier = snapshot.tier;
  }

  if (trialEnd) {
    update.trial_ends_at = trialEnd;
  }

  if (hasAccess) {
    // L'accès devient payant : on quitte l'état « pending » et le choix est fait.
    // access_type porte le CYCLE (monthly | annual) — vocabulaire déjà en place
    // dans access-control ; le palier vit dans subscription_tier.
    if (snapshot.cycle) {
      update.access_type = snapshot.cycle;
    }
    update.requires_access_choice = false;
    // Ces deux dates marquent le premier accès payant : on ne les réécrit pas.
    update.access_granted_at = existing.accessGrantedAt ?? nowIso;
    update.subscription_started_at = existing.subscriptionStartedAt ?? nowIso;
    update.pending_plan = null;
  } else {
    update.requires_access_choice = true;
    update.pending_plan = snapshot.cycle ?? null;
  }

  return update;
}
