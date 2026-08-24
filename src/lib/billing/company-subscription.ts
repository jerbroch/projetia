/**
 * Lecture de l'état d'abonnement d'une entreprise pour l'affichage
 * (page Paramètres). Aucune écriture — la source de vérité reste Stripe,
 * répliquée par le webhook.
 */
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { accessTypeLabel } from "@/lib/access-control";
import { planLabel, type SubscriptionPlan } from "@/lib/pricing-config";

export interface CompanySubscriptionSummary {
  accessType: string | null;
  accessTypeLabel: string;
  plan: SubscriptionPlan | null;
  planLabel: string;
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
  plan: null,
  planLabel: "—",
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasStripeCustomer: false,
  hasStripeSubscription: false,
  schemaMissing: false,
};

function toPlan(value: unknown): SubscriptionPlan | null {
  return value === "monthly" || value === "annual" ? value : null;
}

export async function getCompanySubscriptionSummary(
  companyId: string,
): Promise<CompanySubscriptionSummary> {
  if (!isSupabaseConfigured()) return EMPTY;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select(
      "access_type, subscription_status, subscription_plan, subscription_current_period_end, subscription_cancel_at_period_end, stripe_customer_id, stripe_subscription_id",
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

  const plan = toPlan(data.subscription_plan);
  const accessType = data.access_type ? String(data.access_type) : null;

  return {
    accessType,
    accessTypeLabel: accessTypeLabel(accessType),
    plan,
    planLabel: planLabel(plan ?? accessType),
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
