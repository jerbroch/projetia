/**
 * Lecture de l'état d'abonnement d'une entreprise pour l'affichage
 * (page Paramètres). Aucune écriture — la source de vérité reste Stripe,
 * répliquée par le webhook.
 */
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { accessTypeLabel } from "@/lib/access-control";
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
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasStripeCustomer: false,
  hasStripeSubscription: false,
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
    status: data.subscription_status ? String(data.subscription_status) : null,
    currentPeriodEnd: data.subscription_current_period_end
      ? String(data.subscription_current_period_end)
      : null,
    cancelAtPeriodEnd: Boolean(data.subscription_cancel_at_period_end),
    hasStripeCustomer: Boolean(data.stripe_customer_id),
    hasStripeSubscription: Boolean(data.stripe_subscription_id),
    schemaMissing: false,
  };
}
