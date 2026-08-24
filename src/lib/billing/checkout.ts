/**
 * Stripe Checkout + portail client pour l'abonnement SaaS ConstructionIOS.
 * Toutes les fonctions sont serveur uniquement (clé secrète Stripe).
 */
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, getStripe } from "@/lib/stripe";
import {
  getPricingConfig,
  priceIdForPlan,
  type SubscriptionPlan,
} from "@/lib/pricing-config";

export interface CompanyBillingIdentity {
  companyId: string;
  companyName: string;
  email: string;
}

/** Colonnes Stripe lues sur `companies`. */
export interface CompanyBillingRow {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export function isPlanPurchasable(plan: SubscriptionPlan): boolean {
  return Boolean(priceIdForPlan(getPricingConfig(), plan));
}

async function readBillingRow(companyId: string): Promise<CompanyBillingRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    stripe_customer_id: data.stripe_customer_id ? String(data.stripe_customer_id) : null,
    stripe_subscription_id: data.stripe_subscription_id
      ? String(data.stripe_subscription_id)
      : null,
  };
}

/**
 * Retourne le Stripe Customer de l'entreprise, en le créant au besoin.
 * L'id est persisté immédiatement pour éviter les doublons de clients.
 */
export async function ensureStripeCustomer(
  identity: CompanyBillingIdentity,
): Promise<string> {
  const existing = await readBillingRow(identity.companyId);
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: identity.companyName,
    email: identity.email,
    metadata: { companyId: identity.companyId },
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", identity.companyId);

  if (error) throw error;

  return customer.id;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

/** Crée la session Checkout d'abonnement et retourne l'URL hébergée par Stripe. */
export async function createSubscriptionCheckoutSession(
  identity: CompanyBillingIdentity,
  plan: SubscriptionPlan,
): Promise<CheckoutSessionResult> {
  const pricing = getPricingConfig();
  const priceId = priceIdForPlan(pricing, plan);
  if (!priceId) {
    throw new Error(`Aucun Stripe Price ID configuré pour le plan « ${plan} »`);
  }

  const customerId = await ensureStripeCustomer(identity);
  const stripe = getStripe();
  const appUrl = getAppUrl();

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: { companyId: identity.companyId, plan },
  };
  if (pricing.trialDays > 0) {
    subscriptionData.trial_period_days = pricing.trialDays;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Taxes canadiennes (TPS/TVQ) : nécessite Stripe Tax activé au dashboard.
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    billing_address_collection: "required",
    allow_promotion_codes: true,
    locale: "fr-CA",
    client_reference_id: identity.companyId,
    metadata: { companyId: identity.companyId, plan },
    subscription_data: subscriptionData,
    success_url: `${appUrl}/choose-plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/choose-plan?checkout=cancel`,
  });

  if (!session.url) {
    throw new Error("Stripe n'a pas retourné d'URL de paiement");
  }

  return { url: session.url, sessionId: session.id };
}

/** Portail Stripe : changer de carte, voir les factures, annuler. */
export async function createBillingPortalSession(
  identity: CompanyBillingIdentity,
  returnPath = "/settings",
): Promise<string> {
  const customerId = await ensureStripeCustomer(identity);
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    locale: "fr-CA",
    return_url: `${getAppUrl()}${returnPath}`,
  });

  return session.url;
}
