/**
 * Lecture de l'état d'abonnement d'une entreprise pour l'affichage
 * (page Paramètres). Aucune écriture — la source de vérité reste Stripe,
 * répliquée par le webhook.
 */
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { accessTypeLabel } from "@/lib/access-control";
import { hasModifiableSubscription } from "@/lib/billing/subscription-status";
import {
  cycleLabel,
  isBillingCycle,
  isSubscriptionTier,
  priceCentsForTier,
  getTier,
  tierLabel,
  userLimitForTier,
  userLimitLabel,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";
import { seatUsage, seatWarningMessage, type SeatUsage } from "@/lib/billing/seat-limit";

export interface CompanySubscriptionSummary {
  accessType: string | null;
  accessTypeLabel: string;
  tier: SubscriptionTier | null;
  tierLabel: string;
  cycle: BillingCycle | null;
  cycleLabel: string;
  /** Montant facturé pour ce palier et ce cycle, en cents — null si inconnu */
  priceCents: number | null;
  /** Utilisateurs inclus — null = illimité */
  userLimit: number | null;
  userLimitLabel: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  /**
   * true quand un abonnement Stripe est encore vivant : un changement de palier
   * doit passer par le portail, pas par un nouveau Checkout.
   */
  canSwitchTierInPortal: boolean;
  /** Places occupées et restantes — null quand le décompte est indisponible */
  seats: SeatUsage | null;
  /**
   * Avertissement à afficher AVANT le blocage : dernière place, limite
   * atteinte, ou surnombre après une descente de palier. null = rien à dire.
   */
  seatWarning: string | null;
  /** true quand les colonnes de facturation ne sont pas encore migrées */
  schemaMissing: boolean;
}

const EMPTY: CompanySubscriptionSummary = {
  accessType: null,
  accessTypeLabel: "—",
  tier: null,
  tierLabel: "—",
  cycle: null,
  cycleLabel: "—",
  priceCents: null,
  userLimit: null,
  userLimitLabel: "—",
  seats: null,
  seatWarning: null,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasStripeCustomer: false,
  hasStripeSubscription: false,
  canSwitchTierInPortal: false,
  schemaMissing: false,
};

export async function getCompanySubscriptionSummary(
  companyId: string,
): Promise<CompanySubscriptionSummary> {
  if (!isSupabaseConfigured()) return EMPTY;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select(
      "access_type, subscription_status, subscription_tier, subscription_plan, subscription_current_period_end, subscription_cancel_at_period_end, stripe_customer_id, stripe_subscription_id",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    const lower = error.message.toLowerCase();
    const schemaMissing =
      lower.includes("does not exist") || lower.includes("schema cache");
    if (!schemaMissing) {
      console.error("Lecture de l'abonnement échouée:", error.message);
    }
    return { ...EMPTY, schemaMissing };
  }

  if (!data) return EMPTY;

  const tier = isSubscriptionTier(data.subscription_tier) ? data.subscription_tier : null;
  const cycle = isBillingCycle(data.subscription_plan) ? data.subscription_plan : null;
  const accessType = data.access_type ? String(data.access_type) : null;
  const definition = getTier(tier);

  // Une place = un compte qui se connecte, propriétaire compris — pas une fiche
  // employé. Une lecture en échec laisse `seats` à null plutôt que d'afficher
  // un décompte faux.
  const { data: activeProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active");

  const seats = profilesError
    ? null
    : seatUsage({ activeProfiles: activeProfiles?.length ?? 0 }, tier);

  return {
    accessType,
    accessTypeLabel: accessTypeLabel(accessType),
    tier,
    tierLabel: tierLabel(tier),
    cycle,
    cycleLabel: cycleLabel(cycle),
    priceCents:
      definition && cycle ? priceCentsForTier(definition, cycle) : null,
    userLimit: tier ? userLimitForTier(tier) : null,
    userLimitLabel: tier ? userLimitLabel(tier) : "—",
    seats,
    seatWarning: seats ? seatWarningMessage(seats, tier) : null,
    status: data.subscription_status ? String(data.subscription_status) : null,
    currentPeriodEnd: data.subscription_current_period_end
      ? String(data.subscription_current_period_end)
      : null,
    cancelAtPeriodEnd: Boolean(data.subscription_cancel_at_period_end),
    hasStripeCustomer: Boolean(data.stripe_customer_id),
    hasStripeSubscription: Boolean(data.stripe_subscription_id),
    canSwitchTierInPortal: hasModifiableSubscription({
      stripeSubscriptionId: data.stripe_subscription_id
        ? String(data.stripe_subscription_id)
        : null,
      status: data.subscription_status ? String(data.subscription_status) : null,
    }),
    schemaMissing: false,
  };
}
