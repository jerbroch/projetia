/**
 * Synchronisation Stripe → `companies`.
 * Utilisé par le webhook et par le retour de Checkout (pour ne pas faire
 * attendre l'utilisateur derrière la livraison du webhook).
 */
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { getPricingConfig, planForPriceId, type SubscriptionPlan } from "@/lib/pricing-config";
import {
  buildCompanySubscriptionUpdate,
  type ExistingSubscriptionRow,
} from "@/lib/billing/subscription-status";

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function readPlanMetadata(value: unknown): SubscriptionPlan | null {
  return value === "monthly" || value === "annual" ? value : null;
}

/** Retrouve l'entreprise visée par un abonnement Stripe. */
export async function resolveCompanyId(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromSubscription = subscription.metadata?.companyId;
  if (fromSubscription) return fromSubscription;

  const customerId = asId(subscription.customer);
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (data?.id) return String(data.id);

  // Dernier recours : la métadonnée posée à la création du client Stripe.
  const customer = await getStripe().customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.companyId) {
    return customer.metadata.companyId;
  }

  return null;
}

async function readExistingRow(companyId: string): Promise<ExistingSubscriptionRow> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("access_granted_at, subscription_started_at")
    .eq("id", companyId)
    .maybeSingle();

  return {
    accessGrantedAt: data?.access_granted_at ? String(data.access_granted_at) : null,
    subscriptionStartedAt: data?.subscription_started_at
      ? String(data.subscription_started_at)
      : null,
  };
}

export interface SyncResult {
  companyId: string;
  status: string;
  plan: SubscriptionPlan | null;
}

/** Applique l'état d'un abonnement Stripe sur la ligne `companies`. */
export async function syncSubscriptionToCompany(
  subscription: Stripe.Subscription,
  companyIdHint?: string | null,
): Promise<SyncResult | null> {
  const companyId = companyIdHint ?? (await resolveCompanyId(subscription));
  if (!companyId) {
    console.error(`Stripe: abonnement ${subscription.id} sans entreprise identifiable`);
    return null;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const pricing = getPricingConfig();
  const plan =
    planForPriceId(pricing, priceId) ?? readPlanMetadata(subscription.metadata?.plan);

  const existing = await readExistingRow(companyId);
  const update = buildCompanySubscriptionUpdate(
    {
      status: subscription.status,
      plan,
      priceId,
      subscriptionId: subscription.id,
      customerId: asId(subscription.customer),
      currentPeriodEnd: subscription.current_period_end,
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    new Date().toISOString(),
    existing,
  );

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update(update).eq("id", companyId);
  if (error) throw error;

  return { companyId, status: subscription.status, plan };
}

/** Recharge l'abonnement depuis Stripe puis synchronise (retour de Checkout). */
export async function syncSubscriptionById(
  subscriptionId: string,
  companyIdHint?: string | null,
): Promise<SyncResult | null> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  return syncSubscriptionToCompany(subscription, companyIdHint);
}
